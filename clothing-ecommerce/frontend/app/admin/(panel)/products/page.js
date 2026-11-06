'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Search, ExternalLink } from 'lucide-react';
import { PageHeader, Toggle, Empty } from '@/components/admin/ui';
import { api, img } from '@/lib/api';
import { inr } from '@/lib/format';

export default function ProductsAdmin() {
  const [data, setData] = useState({ items: [], total: 0, pages: 0, page: 1 });
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ all: '1', limit: '20', page: String(page), ...(q && { q }), ...(category && { category }) });
    api(`/products?${qs}`).then(setData).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { api('/categories?all=1').then(setCategories).catch(() => {}); }, []);
  useEffect(load, [page, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (p, field) => {
    try {
      await api(`/products/${p._id}`, { method: 'PUT', body: { [field]: !p[field] } });
      setData((d) => ({ ...d, items: d.items.map((x) => (x._id === p._id ? { ...x, [field]: !p[field] } : x)) }));
    } catch (e) { toast.error(e.message); }
  };
  const remove = async (p) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await api(`/products/${p._id}`, { method: 'DELETE' });
      toast.success('Product deleted');
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Products" subtitle={`${data.total} products`}>
        <Link href="/admin/products/new" className="a-btn"><Plus size={16} /> Add product</Link>
      </PageHeader>

      <div className="a-card mb-4 flex flex-wrap gap-3 p-3">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }} className="flex flex-1 items-center gap-2">
          <Search size={16} className="text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, tag or SKU" className="flex-1 bg-transparent text-sm outline-none" />
        </form>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="a-input w-auto">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c._id} value={c.slug}>{c.name}</option>)}
        </select>
      </div>

      <div className="a-card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="a-th">Product</th><th className="a-th">Retail</th><th className="a-th">Wholesale</th>
              <th className="a-th">Stock</th><th className="a-th">Featured</th><th className="a-th">Visible</th><th className="a-th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {data.items.map((p) => (
              <tr key={p._id} className="hover:bg-stone-50">
                <td className="a-td">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(p.images?.[0])} alt="" className="h-14 w-11 rounded object-cover" />
                    <div>
                      <Link href={`/admin/products/${p._id}`} className="font-medium text-stone-900 hover:underline">{p.name}</Link>
                      <div className="text-xs text-stone-500">{p.category?.name || 'Uncategorised'}{p.sku ? ` · ${p.sku}` : ''}</div>
                    </div>
                  </div>
                </td>
                <td className="a-td">{inr(p.price)}{p.mrp > p.price && <div className="text-xs text-stone-400 line-through">{inr(p.mrp)}</div>}</td>
                <td className="a-td">{p.wholesalePrice ? <>{inr(p.wholesalePrice)}<div className="text-xs text-stone-500">MOQ {p.moq}</div></> : <span className="text-stone-400">—</span>}</td>
                <td className="a-td">
                  <span className={`badge ${p.totalStock === 0 ? 'bg-red-100 text-red-700' : p.totalStock <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-700'}`}>{p.totalStock}</span>
                </td>
                <td className="a-td"><Toggle checked={p.isFeatured} onChange={() => toggle(p, 'isFeatured')} /></td>
                <td className="a-td"><Toggle checked={p.isActive} onChange={() => toggle(p, 'isActive')} /></td>
                <td className="a-td">
                  <div className="flex justify-end gap-1">
                    <Link href={`/product/${p.slug}`} target="_blank" className="rounded p-2 text-stone-500 hover:bg-stone-100" title="View"><ExternalLink size={16} /></Link>
                    <Link href={`/admin/products/${p._id}`} className="rounded p-2 text-stone-500 hover:bg-stone-100" title="Edit"><Pencil size={16} /></Link>
                    <button onClick={() => remove(p)} className="rounded p-2 text-red-500 hover:bg-red-50" title="Delete"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && data.items.length === 0 && <Empty>No products yet. Click “Add product” to create your first one.</Empty>}
      </div>

      {data.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="a-btn-light">Previous</button>
          <span className="px-3 text-stone-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="a-btn-light">Next</button>
        </div>
      )}
    </>
  );
}
