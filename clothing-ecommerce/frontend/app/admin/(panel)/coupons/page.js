'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { PageHeader, Modal, Toggle, Empty } from '@/components/admin/ui';
import { api } from '@/lib/api';
import { inr, date } from '@/lib/format';

const EMPTY = { code: '', type: 'percent', value: 10, minOrder: 0, maxDiscount: 0, appliesTo: 'retail', usageLimit: 0, expiresAt: '', isActive: true };

export default function CouponsAdmin() {
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api('/coupons').then(setList).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...edit, expiresAt: edit.expiresAt || null };
      if (edit._id) await api(`/coupons/${edit._id}`, { method: 'PUT', body });
      else await api('/coupons', { method: 'POST', body });
      toast.success('Coupon saved');
      setEdit(null);
      load();
    } catch (err) { toast.error(err.message); }
  };
  const remove = async (c) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    await api(`/coupons/${c._id}`, { method: 'DELETE' }).catch((e) => toast.error(e.message));
    load();
  };
  const f = (k, num) => (e) => setEdit({ ...edit, [k]: num ? Number(e.target.value) : e.target.value });

  return (
    <>
      <PageHeader title="Coupons" subtitle="Discount codes customers enter in their bag">
        <button onClick={() => setEdit(EMPTY)} className="a-btn"><Plus size={16} /> New coupon</button>
      </PageHeader>

      <div className="a-card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr><th className="a-th">Code</th><th className="a-th">Discount</th><th className="a-th">Min order</th><th className="a-th">For</th><th className="a-th">Used</th><th className="a-th">Expires</th><th className="a-th">Status</th><th className="a-th" /></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {list.map((c) => (
              <tr key={c._id}>
                <td className="a-td font-mono font-medium text-stone-900">{c.code}</td>
                <td className="a-td">{c.type === 'percent' ? `${c.value}%${c.maxDiscount ? ` (max ${inr(c.maxDiscount)})` : ''}` : inr(c.value)}</td>
                <td className="a-td">{inr(c.minOrder)}</td>
                <td className="a-td capitalize">{c.appliesTo}</td>
                <td className="a-td">{c.used}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                <td className="a-td">{c.expiresAt ? date(c.expiresAt) : 'Never'}</td>
                <td className="a-td"><span className={`badge ${c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>{c.isActive ? 'Active' : 'Off'}</span></td>
                <td className="a-td text-right">
                  <button onClick={() => setEdit({ ...c, expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '' })} className="rounded p-2 text-stone-500 hover:bg-stone-100"><Pencil size={16} /></button>
                  <button onClick={() => remove(c)} className="rounded p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <Empty>No coupons yet.</Empty>}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?._id ? 'Edit coupon' : 'New coupon'}>
        {edit && (
          <form onSubmit={save} className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="a-label">Code *</label><input required value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} className="a-input font-mono" placeholder="DIWALI20" /></div>
            <div><label className="a-label">Type</label><select value={edit.type} onChange={f('type')} className="a-input"><option value="percent">Percent %</option><option value="flat">Flat ₹</option></select></div>
            <div><label className="a-label">Value *</label><input required type="number" min={0} value={edit.value} onChange={f('value', true)} className="a-input" /></div>
            <div><label className="a-label">Minimum order (₹)</label><input type="number" min={0} value={edit.minOrder} onChange={f('minOrder', true)} className="a-input" /></div>
            <div><label className="a-label">Max discount (₹, 0 = no cap)</label><input type="number" min={0} value={edit.maxDiscount} onChange={f('maxDiscount', true)} className="a-input" /></div>
            <div><label className="a-label">Applies to</label><select value={edit.appliesTo} onChange={f('appliesTo')} className="a-input"><option value="retail">Retail only</option><option value="wholesale">Wholesale only</option><option value="all">Everyone</option></select></div>
            <div><label className="a-label">Usage limit (0 = unlimited)</label><input type="number" min={0} value={edit.usageLimit} onChange={f('usageLimit', true)} className="a-input" /></div>
            <div><label className="a-label">Expires on</label><input type="date" value={edit.expiresAt} onChange={f('expiresAt')} className="a-input" /></div>
            <div className="flex items-end"><Toggle checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} label="Active" /></div>
            <div className="col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setEdit(null)} className="a-btn-light">Cancel</button><button className="a-btn">Save</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}
