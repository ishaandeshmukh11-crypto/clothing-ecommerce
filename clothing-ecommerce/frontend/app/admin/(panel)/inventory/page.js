'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Search, Minus, Plus, ChevronDown, Pencil, Upload } from 'lucide-react';
import { PageHeader, Toggle, Empty } from '@/components/admin/ui';
import { api, img } from '@/lib/api';
import { inr } from '@/lib/format';
import { buildTree } from '@/lib/categories';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'low', label: 'Low stock' },
  { key: 'out', label: 'Out of stock' },
  { key: 'hidden', label: 'Hidden' },
];

function Row({ p, onChange }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [price, setPrice] = useState(p.price);
  const total = p.sizes.reduce((n, s) => n + s.stock, 0);

  const patch = async (body, msg) => {
    setSaving(true);
    try {
      const r = await api(`/products/${p._id}/stock`, { method: 'PATCH', body });
      onChange({ ...p, ...r });
      if (msg) toast.success(msg);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`a-card overflow-hidden ${p.isActive ? '' : 'opacity-60'}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-3 text-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img(p.images?.[0])} alt="" className="h-16 w-12 shrink-0 rounded object-cover" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-stone-900">{p.name}</div>
          <div className="text-xs text-stone-500">{p.sku} · {inr(p.price)}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {p.sizes.map((s) => (
              <span key={s.label} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${s.stock === 0 ? 'bg-red-100 text-red-700' : s.stock <= 3 ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>
                {s.label} {s.stock}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-semibold ${total === 0 ? 'text-red-600' : total <= 5 ? 'text-amber-700' : 'text-stone-900'}`}>{total}</div>
          <ChevronDown size={16} className={`ml-auto text-stone-400 transition ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-stone-100 bg-stone-50 p-3">
          {p.sizes.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="w-14 text-sm font-medium">{s.label}</span>
              <button disabled={saving || s.stock === 0} onClick={() => patch({ size: s.label, delta: -1 })} className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-300 bg-white active:bg-stone-100 disabled:opacity-40"><Minus size={16} /></button>
              <input type="number" inputMode="numeric" defaultValue={s.stock} key={s.stock} onBlur={(e) => Number(e.target.value) !== s.stock && patch({ size: s.label, stock: Number(e.target.value) }, `${s.label} set to ${e.target.value}`)}
                className="h-10 w-16 rounded-lg border border-stone-300 text-center text-sm" />
              <button disabled={saving} onClick={() => patch({ size: s.label, delta: 1 })} className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-300 bg-white active:bg-stone-100"><Plus size={16} /></button>
              <button disabled={saving} onClick={() => patch({ size: s.label, delta: 10 })} className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-xs">+10</button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 pt-3">
            <label className="flex items-center gap-2 text-sm">₹
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => Number(price) !== p.price && patch({ price: Number(price) }, 'Price updated')} className="h-10 w-24 rounded-lg border border-stone-300 px-2 text-sm" />
            </label>
            <Toggle checked={p.isActive} onChange={(v) => patch({ isActive: v }, v ? 'Visible in store' : 'Hidden from store')} label="Visible" />
            <Link href={`/admin/products/${p._id}`} className="ml-auto flex items-center gap-1 text-xs text-stone-600 underline"><Pencil size={12} /> Full edit</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Inventory() {
  const params = useSearchParams();
  const [filter, setFilter] = useState(params.get('low') ? 'low' : '');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [cats, setCats] = useState([]);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    const qs = new URLSearchParams({ all: '1', limit: '30', page: String(page), sort: filter ? 'stock_asc' : 'newest', ...(q && { q }), ...(category && { category }), ...(filter === 'hidden' ? { hidden: '1' } : filter ? { stock: filter } : {}) });
    try {
      const d = await api(`/products?${qs}`);
      setData((prev) => (page > 1 ? { ...d, items: [...prev.items, ...d.items] } : d));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter, q, category]);

  useEffect(() => { api('/categories?all=1').then(setCats).catch(() => {}); }, []);
  useEffect(() => { load(1); }, [filter, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (np) => setData((d) => ({ ...d, items: d.items.map((x) => (x._id === np._id ? np : x)) }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Inventory" subtitle={`${data.total} products · tap one to change stock per size`}>
        <Link href="/admin/bulk" className="a-btn-light"><Upload size={16} /> Bulk update</Link>
      </PageHeader>

      <div className="sticky top-14 z-20 -mx-4 mb-4 space-y-3 bg-stone-100 px-4 pb-3 pt-1 lg:top-0">
        <form onSubmit={(e) => { e.preventDefault(); load(1); }} className="a-card flex items-center gap-2 px-3 py-2.5">
          <Search size={16} className="text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or SKU" className="flex-1 bg-transparent text-sm outline-none" />
        </form>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${filter === f.key ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}>{f.label}</button>
          ))}
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-stone-200">
            <option value="">All categories</option>
            {buildTree(cats).map((g) => (
              <optgroup key={g._id} label={g.name}>
                <option value={g.slug}>All {g.name}</option>
                {g.children.map((c) => <option key={c._id} value={c.slug}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {data.items.map((p) => <Row key={p._id} p={p} onChange={update} />)}
      </div>
      {!loading && data.items.length === 0 && <div className="a-card"><Empty>Nothing here.</Empty></div>}
      {data.page < data.pages && (
        <button onClick={() => load(data.page + 1)} disabled={loading} className="a-btn-light mt-4 w-full">{loading ? 'Loading…' : 'Load more'}</button>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return <Suspense fallback={null}><Inventory /></Suspense>;
}
