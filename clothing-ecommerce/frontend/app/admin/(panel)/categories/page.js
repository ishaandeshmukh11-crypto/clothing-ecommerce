'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { PageHeader, ImageUploader, Modal, Toggle, Empty } from '@/components/admin/ui';
import { api, img } from '@/lib/api';
import { buildTree } from '@/lib/categories';

const EMPTY = { name: '', slug: '', description: '', image: '', sortOrder: 0, isActive: true, parent: '', attributes: [] };

export default function CategoriesAdmin() {
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api('/categories?all=1').then(setList).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (edit._id) await api(`/categories/${edit._id}`, { method: 'PUT', body: edit });
      else await api('/categories', { method: 'POST', body: edit });
      toast.success('Category saved');
      setEdit(null);
      load();
    } catch (err) { toast.error(err.message); }
  };
  const remove = async (c) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try { await api(`/categories/${c._id}`, { method: 'DELETE' }); load(); } catch (err) { toast.error(err.message); }
  };

  return (
    <>
      <PageHeader title="Categories" subtitle="Main categories (Tops, Dresses, Pants…) appear in the store menu; types (Bodyfit, Gowns, Korean…) appear inside them. Filters like Sleeve or Length are set on the main category.">
        <button onClick={() => setEdit(EMPTY)} className="a-btn"><Plus size={16} /> Add main category</button>
      </PageHeader>

      <div className="space-y-6">
        {buildTree(list).map((g) => (
          <div key={g._id} className="a-card overflow-hidden">
            <div className="flex items-center gap-4 border-b border-stone-200 bg-stone-50 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(g.image)} alt="" className="h-14 w-11 rounded object-cover" />
              <div className="flex-1">
                <div className="font-semibold text-stone-900">{g.name} {!g.isActive && <span className="badge ml-1 bg-stone-200 text-stone-600">Hidden</span>}</div>
                <div className="text-xs text-stone-500">Main category · {g.children.length} types · {g.productCount} products{g.attributes?.length ? ` · Filters: ${g.attributes.map((a) => a.name).join(', ')}` : ''}</div>
              </div>
              <button onClick={() => setEdit({ ...EMPTY, parent: g._id })} className="a-btn-light px-2.5 py-1 text-xs"><Plus size={14} /> Add type</button>
              <button onClick={() => setEdit({ ...g, parent: '' })} className="rounded p-2 text-stone-500 hover:bg-stone-200"><Pencil size={16} /></button>
              <button onClick={() => remove(g)} className="rounded p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
            </div>
            <div className="divide-y divide-stone-100">
              {g.children.map((c) => (
                <div key={c._id} className="flex items-center gap-4 px-4 py-3 pl-8">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(c.image)} alt="" className="h-10 w-8 rounded object-cover" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-stone-800">{c.name} {!c.isActive && <span className="badge ml-1 bg-stone-100 text-stone-600">Hidden</span>}</div>
                    <div className="text-xs text-stone-500">/{c.slug} · {c.productCount} products</div>
                  </div>
                  <button onClick={() => setEdit({ ...c, parent: c.parent || '' })} className="rounded p-2 text-stone-500 hover:bg-stone-100"><Pencil size={16} /></button>
                  <button onClick={() => remove(c)} className="rounded p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                </div>
              ))}
              {g.children.length === 0 && <div className="px-8 py-3 text-xs text-stone-500">No sub-categories yet.</div>}
            </div>
          </div>
        ))}
      </div>
      {list.length === 0 && <div className="a-card"><Empty>No categories yet.</Empty></div>}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?._id ? 'Edit category' : edit?.parent ? 'New sub-category' : 'New main category'}>
        {edit && (
          <form onSubmit={save} className="space-y-4">
            <div><label className="a-label">Name *</label><input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="a-input" /></div>
            <div>
              <label className="a-label">Belongs to</label>
              <select value={edit.parent || ''} onChange={(e) => setEdit({ ...edit, parent: e.target.value })} className="a-input">
                <option value="">— None (this is a main category) —</option>
                {list.filter((c) => !c.parent && c._id !== edit._id).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            {!edit.parent && (
              <div className="rounded-lg bg-stone-50 p-3">
                <div className="mb-1 text-xs font-medium text-stone-700">Filters for this category</div>
                <p className="mb-3 text-xs text-stone-500">e.g. Sleeve → Spaghetti, Sleeveless, Half sleeves. Shown as filters in the shop and as dropdowns when adding products.</p>
                {(edit.attributes || []).map((a, i) => (
                  <div key={i} className="mb-2 flex gap-2">
                    <input value={a.name} placeholder="Filter name" onChange={(e) => setEdit({ ...edit, attributes: edit.attributes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} className="a-input w-32" />
                    <input value={Array.isArray(a.options) ? a.options.join(', ') : a.options} placeholder="Options, comma separated" onChange={(e) => setEdit({ ...edit, attributes: edit.attributes.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)) })} className="a-input flex-1" />
                    <button type="button" onClick={() => setEdit({ ...edit, attributes: edit.attributes.filter((_, j) => j !== i) })} className="px-1 text-stone-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setEdit({ ...edit, attributes: [...(edit.attributes || []), { name: '', options: '' }] })} className="a-btn-light px-2.5 py-1 text-xs"><Plus size={14} /> Add filter</button>
              </div>
            )}
            <div><label className="a-label">URL slug (optional)</label><input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} className="a-input" placeholder="auto from name" /></div>
            <div><label className="a-label">Description</label><textarea rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className="a-input" /></div>
            <div><label className="a-label">Image</label><ImageUploader single value={edit.image ? [edit.image] : []} onChange={(v) => setEdit({ ...edit, image: v[0] || '' })} /></div>
            <div className="flex items-center gap-6">
              <div><label className="a-label">Sort order</label><input type="number" value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} className="a-input w-24" /></div>
              <Toggle checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} label="Visible" />
            </div>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setEdit(null)} className="a-btn-light">Cancel</button><button className="a-btn">Save</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}
