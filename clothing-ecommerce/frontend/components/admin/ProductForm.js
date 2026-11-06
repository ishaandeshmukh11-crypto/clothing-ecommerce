'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { ImageUploader, PageHeader, Toggle } from './ui';
import { api } from '@/lib/api';
import { buildTree } from '@/lib/categories';

const PRESETS = {
  'XS – XL': ['XS', 'S', 'M', 'L', 'XL'],
  'S – XXL': ['S', 'M', 'L', 'XL', 'XXL'],
  'XS – 3XL': ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  'Plus XL – 5XL': ['XL', 'XXL', '3XL', '4XL', '5XL'],
  'Waist 26 – 34': ['26', '28', '30', '32', '34'],
  'Free Size': ['Free Size'],
};

const EMPTY = {
  name: '', sku: '', description: '', category: '', images: [], price: '', mrp: '', wholesalePrice: '', moq: 6,
  sizes: PRESETS['XS – XL'].map((label) => ({ label, stock: 0 })), colors: [], fabric: '', care: '', tags: '',
  isFeatured: false, isNewArrival: true, isActive: true, attributes: {},
};

export default function ProductForm({ id }) {
  const router = useRouter();
  const [p, setP] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/categories?all=1').then(setCategories).catch(() => {});
    if (id) {
      api(`/products/id/${id}`)
        .then((d) => setP({ ...EMPTY, ...d, category: d.category?._id || '', tags: (d.tags || []).join(', '), wholesalePrice: d.wholesalePrice ?? '', mrp: d.mrp ?? '' }))
        .catch((e) => toast.error(e.message))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const set = (k) => (e) => setP((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const setSize = (i, k, v) => setP((x) => ({ ...x, sizes: x.sizes.map((s, j) => (j === i ? { ...s, [k]: k === 'stock' ? Math.max(0, parseInt(v, 10) || 0) : v } : s)) }));
  const setColor = (i, k, v) => setP((x) => ({ ...x, colors: x.colors.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));

  const save = async (e) => {
    e.preventDefault();
    if (!p.images.length) return toast.error('Please add at least one image');
    setSaving(true);
    const body = {
      ...p,
      price: Number(p.price),
      mrp: p.mrp === '' ? undefined : Number(p.mrp),
      wholesalePrice: p.wholesalePrice === '' ? null : Number(p.wholesalePrice),
      moq: Number(p.moq) || 1,
      sizes: p.sizes.filter((s) => s.label.trim()),
      colors: p.colors.filter((c) => c.name.trim()),
      attributes: Object.fromEntries(Object.entries(p.attributes || {}).filter(([, v]) => v)),
      description: p.description, // left empty → server writes one automatically
    };
    try {
      if (id) await api(`/products/${id}`, { method: 'PUT', body });
      else await api('/products', { method: 'POST', body });
      toast.success(id ? 'Product updated' : 'Product created');
      router.push('/admin/products');
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  };

  const selectedCat = categories.find((c) => c._id === p.category);
  const mainCat = selectedCat?.parent ? categories.find((c) => String(c._id) === String(selectedCat.parent)) : selectedCat;
  const attrDefs = mainCat?.attributes || [];

  if (loading) return <div className="text-sm text-stone-500">Loading…</div>;
  const totalStock = p.sizes.reduce((n, s) => n + (Number(s.stock) || 0), 0);

  return (
    <form onSubmit={save}>
      <PageHeader title={id ? 'Edit product' : 'Add product'} subtitle={id ? p.name : 'Fill the details and publish'}>
        <Link href="/admin/products" className="a-btn-light">Cancel</Link>
        <button disabled={saving} className="a-btn">{saving ? 'Saving…' : 'Save product'}</button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="a-card space-y-4 p-5">
            <div><label className="a-label">Product name *</label><input required value={p.name} onChange={set('name')} className="a-input" placeholder="e.g. Ribbed Square Neck Bodyfit Top" /></div>
            <div><label className="a-label">Description <span className="font-normal text-stone-400">— leave empty and we will write one automatically</span></label><textarea rows={5} value={p.description} onChange={set('description')} className="a-input" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="a-label">Fabric</label><input value={p.fabric} onChange={set('fabric')} className="a-input" placeholder="100% Cotton" /></div>
              <div><label className="a-label">Care instructions</label><input value={p.care} onChange={set('care')} className="a-input" placeholder="Hand wash cold" /></div>
            </div>
          </section>

          <section className="a-card p-5">
            <div className="mb-3 text-sm font-medium">Images <span className="font-normal text-stone-500">(first image is the cover; drag & drop supported)</span></div>
            <ImageUploader value={p.images} onChange={(images) => setP((x) => ({ ...x, images }))} />
          </section>

          <section className="a-card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">Sizes & stock <span className="font-normal text-stone-500">· total {totalStock} pcs</span></div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(PRESETS).map(([name, list]) => (
                  <button type="button" key={name} onClick={() => setP((x) => ({ ...x, sizes: list.map((label) => ({ label, stock: x.sizes.find((s) => s.label === label)?.stock || 0 })) }))}
                    className="rounded-full border border-stone-300 px-2.5 py-1 text-xs hover:bg-stone-100">{name}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {p.sizes.map((s, i) => (
                <div key={i} className="flex items-center gap-1 rounded-lg border border-stone-200 p-2">
                  <input value={s.label} onChange={(e) => setSize(i, 'label', e.target.value)} className="w-16 rounded border border-stone-200 px-2 py-1 text-sm" />
                  <input type="number" min={0} value={s.stock} onChange={(e) => setSize(i, 'stock', e.target.value)} className="w-full rounded border border-stone-200 px-2 py-1 text-sm" title="Stock" />
                  <button type="button" onClick={() => setP((x) => ({ ...x, sizes: x.sizes.filter((_, j) => j !== i) }))} className="text-stone-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setP((x) => ({ ...x, sizes: [...x.sizes, { label: '', stock: 0 }] }))} className="flex items-center justify-center gap-1 rounded-lg border-2 border-dashed border-stone-300 p-2 text-xs text-stone-500"><Plus size={14} /> Size</button>
            </div>
          </section>

          <section className="a-card p-5">
            <div className="mb-3 text-sm font-medium">Colours</div>
            <div className="flex flex-wrap gap-2">
              {p.colors.map((c, i) => (
                <div key={i} className="flex items-center gap-1 rounded-lg border border-stone-200 p-2">
                  <input type="color" value={c.hex} onChange={(e) => setColor(i, 'hex', e.target.value)} className="h-7 w-7 cursor-pointer rounded border-0" />
                  <input value={c.name} onChange={(e) => setColor(i, 'name', e.target.value)} placeholder="Name" className="w-24 rounded border border-stone-200 px-2 py-1 text-sm" />
                  <button type="button" onClick={() => setP((x) => ({ ...x, colors: x.colors.filter((_, j) => j !== i) }))} className="text-stone-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setP((x) => ({ ...x, colors: [...x.colors, { name: '', hex: '#7a2e24' }] }))} className="flex items-center gap-1 rounded-lg border-2 border-dashed border-stone-300 px-3 text-xs text-stone-500"><Plus size={14} /> Colour</button>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="a-card space-y-4 p-5">
            <div className="text-sm font-medium">Retail pricing</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="a-label">Selling price (₹) *</label><input required type="number" min={0} value={p.price} onChange={set('price')} className="a-input" /></div>
              <div><label className="a-label">MRP (₹)</label><input type="number" min={0} value={p.mrp} onChange={set('mrp')} className="a-input" /></div>
            </div>
          </section>

          <section className="a-card space-y-4 border-amber-200 bg-amber-50/40 p-5">
            <div>
              <div className="text-sm font-medium">Wholesale pricing</div>
              <p className="text-xs text-stone-500">Only approved wholesale buyers see this. Leave empty to sell retail only.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="a-label">Wholesale price (₹)</label><input type="number" min={0} value={p.wholesalePrice} onChange={set('wholesalePrice')} className="a-input" /></div>
              <div><label className="a-label">MOQ (pcs)</label><input type="number" min={1} value={p.moq} onChange={set('moq')} className="a-input" /></div>
            </div>
          </section>

          <section className="a-card space-y-4 p-5">
            <div>
              <label className="a-label">Category</label>
              <select value={p.category} onChange={set('category')} className="a-input">
                <option value="">Uncategorised</option>
                {buildTree(categories).map((g) =>
                  g.children.length ? (
                    <optgroup key={g._id} label={g.name}>
                      <option value={g._id}>{g.name} (general)</option>
                      {g.children.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </optgroup>
                  ) : (
                    <option key={g._id} value={g._id}>{g.name}</option>
                  )
                )}
              </select>
              {categories.length === 0 && <Link href="/admin/categories" className="mt-1 block text-xs text-amber-700 underline">Create a category first</Link>}
            </div>
            {attrDefs.length > 0 && (
              <div className="space-y-3 rounded-lg bg-stone-50 p-3">
                <div className="text-xs font-medium text-stone-600">Details (used for filters & the auto description)</div>
                {attrDefs.map((a) => (
                  <div key={a.name}>
                    <label className="a-label">{a.name}</label>
                    <select value={p.attributes?.[a.name] || ''} onChange={(e) => setP((x) => ({ ...x, attributes: { ...(x.attributes || {}), [a.name]: e.target.value } }))} className="a-input">
                      <option value="">—</option>
                      {a.options.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
            <div><label className="a-label">SKU</label><input value={p.sku} onChange={set('sku')} className="a-input" /></div>
            <div><label className="a-label">Tags (comma separated)</label><input value={p.tags} onChange={set('tags')} className="a-input" placeholder="cotton, festive, blue" /><p className="mt-1 text-xs text-stone-500">Tags help search and the chatbot find this product.</p></div>
          </section>

          <section className="a-card space-y-3 p-5">
            <Toggle checked={p.isActive} onChange={set('isActive')} label="Visible in store" />
            <Toggle checked={p.isFeatured} onChange={set('isFeatured')} label="Featured on home page" />
            <Toggle checked={p.isNewArrival} onChange={set('isNewArrival')} label="Mark as new arrival" />
          </section>
        </div>
      </div>
    </form>
  );
}
