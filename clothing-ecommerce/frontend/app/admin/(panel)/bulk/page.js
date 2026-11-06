'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FileSpreadsheet, Images, Download, Upload, CheckCircle2, AlertTriangle, Loader2, X } from 'lucide-react';
import { PageHeader, Toggle } from '@/components/admin/ui';
import { api, API_URL } from '@/lib/api';
import { buildTree } from '@/lib/categories';
import { inr } from '@/lib/format';
import { TEMPLATE, downloadText, groupKey, importRows, matchImages, nameFromFilename, parseSheetFile, uploadAll } from '@/lib/bulk';

const SIZE_PRESETS = {
  'XS – XL': ['XS', 'S', 'M', 'L', 'XL'],
  'S – XXL': ['S', 'M', 'L', 'XL', 'XXL'],
  'Plus XL – 5XL': ['XL', 'XXL', '3XL', '4XL', '5XL'],
  'Waist 26 – 34': ['26', '28', '30', '32', '34'],
  'Free Size': ['Free Size'],
};

function Progress({ label, done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-stone-600"><span>{label}</span><span>{done} / {total}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-200"><div className="h-full bg-stone-900 transition-all" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Results({ result, onClose }) {
  if (!result) return null;
  const errors = result.results.filter((r) => r.status === 'error');
  return (
    <div className="a-card mt-6 p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 size={18} className="text-emerald-600" /> Import finished</div>
        <button onClick={onClose} className="text-stone-400"><X size={18} /></button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Created', result.created, 'text-emerald-700'], ['Updated', result.updated, 'text-blue-700'], ['Skipped', result.skipped, 'text-stone-600'], ['Errors', result.errors, 'text-red-600']].map(([l, n, c]) => (
          <div key={l} className="rounded-lg bg-stone-50 p-3"><div className="text-xs text-stone-500">{l}</div><div className={`text-2xl font-semibold ${c}`}>{n}</div></div>
        ))}
      </div>
      {errors.length > 0 && (
        <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errors.map((e) => <div key={e.row}>Row {e.row}{e.name ? ` (${e.name})` : ''}: {e.message}</div>)}
        </div>
      )}
      <Link href="/admin/products" className="a-btn mt-4">View products</Link>
    </div>
  );
}

// ---------------------------------------------------------------- Spreadsheet mode
function SheetImport({ settings }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [photos, setPhotos] = useState([]);
  const [opts, setOpts] = useState({ createMissingCategories: true, updateExisting: true, aiDescriptions: false });
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const sheetInput = useRef(null);
  const photoInput = useRef(null);

  const onSheet = async (file) => {
    if (!file) return;
    try {
      const r = await parseSheetFile(file);
      setRows(r);
      setFileName(file.name);
      setResult(null);
      if (!r.length) toast.error('No rows found in this file');
    } catch (e) {
      toast.error(`Could not read file: ${e.message}`);
    }
  };

  const preview = useMemo(
    () => rows.map((r) => ({ ...r, _photos: matchImages(r, photos), _problem: !r.price && !r.sku ? 'Price missing' : !r.category && !r.subcategory && !r.sku ? 'Category missing' : '' })),
    [rows, photos]
  );
  const problems = preview.filter((r) => r._problem).length;

  const run = async () => {
    try {
      const needed = preview.flatMap((r) => r._photos);
      let urlMap = new Map();
      if (needed.length) {
        setBusy({ label: 'Uploading photos', done: 0, total: new Set(needed).size });
        urlMap = await uploadAll(needed, (done, total) => setBusy({ label: 'Uploading photos', done, total }));
      }
      const payload = preview.map(({ _photos, _problem, ...r }) => ({
        ...r,
        images: _photos.length ? _photos.map((f) => urlMap.get(f)) : /^https?:/.test(r.images || '') ? String(r.images).split(/\s*[|,]\s*/) : undefined,
      }));
      setBusy({ label: 'Creating products', done: 0, total: payload.length });
      const res = await importRows(payload, opts, (done, total) => setBusy({ label: 'Creating products', done, total }));
      setResult(res);
      toast.success(`${res.created} created, ${res.updated} updated`);
      setRows([]);
      setPhotos([]);
      setFileName('');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const exportInventory = async () => {
    try {
      const token = JSON.parse(localStorage.getItem('store-auth') || '{}')?.state?.token;
      const res = await fetch(`${API_URL}/api/products/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      downloadText(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, (await res.text()).replace(/^﻿/, ''));
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="a-card p-5">
          <div className="text-sm font-semibold">1. Get the sheet</div>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">Fill one row per product in Excel or Google Sheets. Leave <b>name</b> or <b>description</b> empty and we write them for you. Extra columns like Sleeve, Length or Fit become filters.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => downloadText('product-upload-template.csv', TEMPLATE)} className="a-btn-light"><Download size={16} /> Template</button>
            <button onClick={exportInventory} className="a-btn-light"><Download size={16} /> Current stock</button>
          </div>
          <p className="mt-2 text-[11px] text-stone-400">Tip: download current stock, change numbers, upload again to update stock in bulk (matched by SKU).</p>
        </div>
        <div className="a-card p-5">
          <div className="text-sm font-semibold">2. Upload sheet (.xlsx or .csv)</div>
          <button onClick={() => sheetInput.current?.click()} className="mt-3 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 p-5 text-sm text-stone-500 hover:border-stone-500"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onSheet(e.dataTransfer.files[0]); }}>
            <FileSpreadsheet size={24} /> {fileName ? <span className="font-medium text-stone-800">{fileName} · {rows.length} rows</span> : 'Choose or drop file'}
          </button>
          <input ref={sheetInput} type="file" accept=".xlsx,.csv" hidden onChange={(e) => onSheet(e.target.files[0])} />
        </div>
        <div className="a-card p-5">
          <div className="text-sm font-semibold">3. Add photos (optional)</div>
          <p className="mt-1 text-xs text-stone-500">Name photos by SKU (<code>TOP-101_1.jpg</code>, <code>TOP-101_2.jpg</code>) or list file names in the <b>images</b> column.</p>
          <button onClick={() => photoInput.current?.click()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 p-4 text-sm text-stone-500 hover:border-stone-500"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setPhotos((p) => [...p, ...e.dataTransfer.files]); }}>
            <Images size={20} /> {photos.length ? `${photos.length} photos selected` : 'Choose or drop photos'}
          </button>
          <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={(e) => setPhotos((p) => [...p, ...e.target.files])} />
        </div>
      </div>

      {preview.length > 0 && (
        <div className="a-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 p-4">
            <div className="text-sm font-semibold">Preview · {preview.length} products {problems > 0 && <span className="ml-2 text-xs font-normal text-red-600">{problems} need fixing</span>}</div>
            <div className="flex flex-wrap gap-4">
              <Toggle checked={opts.createMissingCategories} onChange={(v) => setOpts({ ...opts, createMissingCategories: v })} label="Create new categories" />
              <Toggle checked={opts.updateExisting} onChange={(v) => setOpts({ ...opts, updateExisting: v })} label="Update if SKU exists" />
              {settings?.aiEnabled && <Toggle checked={opts.aiDescriptions} onChange={(v) => setOpts({ ...opts, aiDescriptions: v })} label="AI descriptions" />}
            </div>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 bg-stone-50"><tr>{['', 'SKU', 'Name', 'Category', 'Price', 'Sizes', 'Details', 'Photos'].map((h) => <th key={h} className="a-th">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-stone-100">
                {preview.slice(0, 200).map((r, i) => (
                  <tr key={i} className={r._problem ? 'bg-red-50' : ''}>
                    <td className="a-td">{r._problem ? <span title={r._problem}><AlertTriangle size={16} className="text-red-500" /></span> : <CheckCircle2 size={16} className="text-emerald-600" />}</td>
                    <td className="a-td font-mono text-xs">{r.sku || '—'}</td>
                    <td className="a-td">{r.name || <span className="text-stone-400">auto</span>}</td>
                    <td className="a-td">{[r.category, r.subcategory].filter(Boolean).join(' › ') || '—'}</td>
                    <td className="a-td">{r.price ? inr(String(r.price).replace(/[^\d.]/g, '')) : <span className="text-red-600">{r._problem ? 'missing' : 'keep'}</span>}</td>
                    <td className="a-td text-xs">{r.sizes || (r.stock ? `stock ${r.stock}` : '—')}</td>
                    <td className="a-td text-xs">{Object.entries(r.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}</td>
                    <td className="a-td">{r._photos.length || <span className="text-stone-400">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-stone-200 p-4">
            {busy ? <div className="flex-1"><Progress {...busy} /></div> : <span className="text-xs text-stone-500">Rows with problems will be reported and skipped; everything else is imported.</span>}
            <button onClick={run} disabled={!!busy} className="a-btn">{busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Import {preview.length} products</button>
          </div>
        </div>
      )}
      <Results result={result} onClose={() => setResult(null)} />
    </div>
  );
}

// ---------------------------------------------------------------- Photo batch mode
function PhotoImport({ categories, settings }) {
  const tree = buildTree(categories);
  const [mainId, setMainId] = useState('');
  const [subId, setSubId] = useState('');
  const [files, setFiles] = useState([]);
  const [grouping, setGrouping] = useState('group'); // group | each
  const [d, setD] = useState({ price: '', mrp: '', wholesalePrice: '', moq: 6, preset: 'XS – XL', stock: 10, fabric: '', colors: '' });
  const [attrs, setAttrs] = useState({});
  const [names, setNames] = useState({});
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const [aiDescriptions, setAi] = useState(false);
  const input = useRef(null);

  const main = tree.find((g) => g._id === mainId);
  const sub = main?.children.find((c) => c._id === subId);

  const groups = useMemo(() => {
    const map = new Map();
    for (const f of files) {
      const key = grouping === 'group' ? groupKey(f.name) || f.name : f.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    }
    return [...map.entries()].map(([key, list], i) => ({ key, files: list.sort((a, b) => a.name.localeCompare(b.name)), index: i }));
  }, [files, grouping]);

  const thumbs = useMemo(() => new Map(files.map((f) => [f, URL.createObjectURL(f)])), [files]);
  useEffect(() => () => thumbs.forEach((u) => URL.revokeObjectURL(u)), [thumbs]);

  const defaultName = (g) => {
    const fromFile = nameFromFilename(g.files[0].name);
    if (fromFile) return fromFile;
    const base = [d.colors.split(',')[0]?.trim(), (sub || main)?.name?.replace(/(ss|sh|ch|x)es$/i, (m) => m.slice(0, -2)).replace(/(?<!s)s$/i, '')].filter(Boolean).join(' ');
    return `${base || 'Product'} ${g.index + 1}`;
  };

  const run = async () => {
    if (!main) return toast.error('Choose a category');
    if (!d.price) return toast.error('Enter the selling price');
    if (!groups.length) return toast.error('Add some photos');
    try {
      setBusy({ label: 'Uploading photos', done: 0, total: files.length });
      const urls = await uploadAll(files, (done, total) => setBusy({ label: 'Uploading photos', done, total }));
      const sizes = SIZE_PRESETS[d.preset].map((l) => `${l}:${d.stock}`).join(', ');
      const rows = groups.map((g) => ({
        name: names[g.key] ?? defaultName(g),
        category: main.name,
        subcategory: sub?.name,
        price: d.price,
        mrp: d.mrp,
        wholesalePrice: d.wholesalePrice,
        moq: d.moq,
        sizes,
        colors: d.colors,
        fabric: d.fabric,
        attributes: attrs,
        images: g.files.map((f) => urls.get(f)),
      }));
      setBusy({ label: 'Creating products', done: 0, total: rows.length });
      const res = await importRows(rows, { createMissingCategories: false, updateExisting: false, aiDescriptions }, (done, total) => setBusy({ label: 'Creating products', done, total }));
      setResult(res);
      toast.success(`${res.created} products created`);
      setFiles([]);
      setNames({});
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };
  const f = (k) => (e) => setD({ ...d, [k]: e.target.value });

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="a-card h-fit space-y-4 p-5">
        <div className="text-sm font-semibold">Same details for every photo</div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="a-label">Category *</label>
            <select value={mainId} onChange={(e) => { setMainId(e.target.value); setSubId(''); setAttrs({}); }} className="a-input">
              <option value="">Choose</option>{tree.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select></div>
          <div><label className="a-label">Type</label>
            <select value={subId} onChange={(e) => setSubId(e.target.value)} className="a-input" disabled={!main?.children.length}>
              <option value="">All / general</option>{main?.children.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select></div>
          <div><label className="a-label">Selling price ₹ *</label><input type="number" value={d.price} onChange={f('price')} className="a-input" /></div>
          <div><label className="a-label">MRP ₹</label><input type="number" value={d.mrp} onChange={f('mrp')} className="a-input" /></div>
          <div><label className="a-label">Wholesale ₹</label><input type="number" value={d.wholesalePrice} onChange={f('wholesalePrice')} className="a-input" /></div>
          <div><label className="a-label">MOQ pcs</label><input type="number" value={d.moq} onChange={f('moq')} className="a-input" /></div>
          <div><label className="a-label">Sizes</label><select value={d.preset} onChange={f('preset')} className="a-input">{Object.keys(SIZE_PRESETS).map((k) => <option key={k}>{k}</option>)}</select></div>
          <div><label className="a-label">Stock per size</label><input type="number" value={d.stock} onChange={f('stock')} className="a-input" /></div>
          <div><label className="a-label">Fabric</label><input value={d.fabric} onChange={f('fabric')} className="a-input" /></div>
          <div><label className="a-label">Colour</label><input value={d.colors} onChange={f('colors')} placeholder="optional" className="a-input" /></div>
        </div>
        {main?.attributes?.map((a) => (
          <div key={a.name}><label className="a-label">{a.name}</label>
            <select value={attrs[a.name] || ''} onChange={(e) => setAttrs({ ...attrs, [a.name]: e.target.value })} className="a-input">
              <option value="">—</option>{a.options.map((o) => <option key={o}>{o}</option>)}
            </select></div>
        ))}
        {settings?.aiEnabled && <Toggle checked={aiDescriptions} onChange={setAi} label="Write descriptions with AI" />}
        <p className="text-xs text-stone-500">Each product gets its own name and description automatically. You can edit any of them later.</p>
      </div>

      <div className="space-y-4">
        <div className="a-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold">Photos {files.length > 0 && `· ${files.length} photos → ${groups.length} products`}</div>
            <div className="flex gap-1 rounded-lg bg-stone-100 p-1 text-xs">
              {[['group', 'Group by file name'], ['each', '1 photo = 1 product']].map(([k, l]) => (
                <button key={k} onClick={() => setGrouping(k)} className={`rounded-md px-3 py-1.5 ${grouping === k ? 'bg-white font-medium shadow-sm' : 'text-stone-500'}`}>{l}</button>
              ))}
            </div>
          </div>
          <button onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setFiles((p) => [...p, ...[...e.dataTransfer.files].filter((x) => x.type.startsWith('image/'))]); }}
            className="mt-4 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 p-8 text-sm text-stone-500 hover:border-stone-500">
            <Images size={28} /> Choose or drop photos — select 50 or 100 at once
            <span className="text-xs text-stone-400">“Group by file name” puts DR101_1.jpg + DR101_2.jpg into one product</span>
          </button>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => setFiles((p) => [...p, ...e.target.files])} />
        </div>

        {groups.length > 0 && (
          <div className="a-card p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {groups.map((g) => (
                <div key={g.key} className="overflow-hidden rounded-lg border border-stone-200">
                  <div className="relative aspect-[4/5] bg-stone-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbs.get(g.files[0])} alt="" className="h-full w-full object-cover" />
                    {g.files.length > 1 && <span className="absolute right-1 top-1 rounded bg-stone-900/80 px-1.5 text-[10px] text-white">{g.files.length} photos</span>}
                    <button onClick={() => setFiles((p) => p.filter((x) => !g.files.includes(x)))} className="absolute left-1 top-1 rounded bg-white/90 p-0.5 text-stone-600"><X size={14} /></button>
                  </div>
                  <input value={names[g.key] ?? defaultName(g)} onChange={(e) => setNames({ ...names, [g.key]: e.target.value })} className="w-full border-t border-stone-200 px-2 py-1.5 text-xs outline-none focus:bg-stone-50" />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              {busy ? <div className="flex-1"><Progress {...busy} /></div> : <span className="text-xs text-stone-500">{groups.length} products will be created in {sub?.name || main?.name || '—'}</span>}
              <button onClick={run} disabled={!!busy} className="a-btn">{busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Create {groups.length} products</button>
            </div>
          </div>
        )}
        <Results result={result} onClose={() => setResult(null)} />
      </div>
    </div>
  );
}

export default function BulkUpload() {
  const [tab, setTab] = useState('photos');
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    api('/categories?all=1').then(setCategories).catch(() => {});
    api('/settings').then(setSettings).catch(() => {});
  }, []);

  return (
    <>
      <PageHeader title="Bulk upload" subtitle="Add hundreds of products at once — names, descriptions and tags are written automatically." />
      <div className="mb-6 flex gap-2">
        {[['photos', 'From photos', Images], ['sheet', 'From Excel / CSV', FileSpreadsheet]].map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${tab === k ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}>
            <Icon size={16} /> {l}
          </button>
        ))}
      </div>
      {tab === 'photos' ? <PhotoImport categories={categories} settings={settings} /> : <SheetImport settings={settings} />}
    </>
  );
}
