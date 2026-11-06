'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, MessageCircle } from 'lucide-react';
import { PageHeader } from '@/components/admin/ui';
import { api, img } from '@/lib/api';
import { inr, dateTime, waLink, STATUS_STYLES } from '@/lib/format';

const STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

export default function OrderDetail({ params }) {
  const { id } = use(params);
  const [o, setO] = useState(null);
  const [form, setForm] = useState({ status: '', note: '', courier: '', trackingNumber: '', paymentStatus: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api(`/orders/${id}`).then((d) => {
      setO(d);
      setForm({ status: d.status, note: '', courier: d.courier || '', trackingNumber: d.trackingNumber || '', paymentStatus: d.paymentStatus });
    }).catch((e) => toast.error(e.message));
  }, [id]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const d = await api(`/orders/${id}`, { method: 'PUT', body: form });
      setO(d);
      setForm((f) => ({ ...f, note: '' }));
      toast.success('Order updated — customer notified on WhatsApp (if connected)');
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  if (!o) return <div className="text-sm text-stone-500">Loading…</div>;
  const a = o.shippingAddress || {};
  const customerMsg = `Hi ${o.customer.name}, this is regarding your order ${o.orderNumber} (${inr(o.total)}).`;

  return (
    <>
      <div className="print:hidden">
        <Link href="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900"><ArrowLeft size={16} /> Orders</Link>
        <PageHeader title={`Order ${o.orderNumber}`} subtitle={`Placed ${dateTime(o.createdAt)} · ${o.customerType} order`}>
          <a href={waLink(o.customer.phone?.replace(/\D/g, '').length === 10 ? `91${o.customer.phone.replace(/\D/g, '')}` : o.customer.phone, customerMsg)} target="_blank" rel="noreferrer" className="a-btn-light"><MessageCircle size={16} /> WhatsApp customer</a>
          <button onClick={() => window.print()} className="a-btn-light"><Printer size={16} /> Print invoice</button>
        </PageHeader>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="a-card">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div className="text-sm font-medium">Items</div>
              <div className="flex gap-2"><span className={`badge ${STATUS_STYLES[o.status]}`}>{o.status}</span><span className={`badge ${STATUS_STYLES[o.paymentStatus]}`}>{o.paymentMethod.toUpperCase()} · {o.paymentStatus}</span></div>
            </div>
            <div className="divide-y divide-stone-100">
              {o.items.map((i, idx) => (
                <div key={idx} className="flex items-center gap-4 px-5 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(i.image)} alt="" className="h-16 w-12 rounded object-cover" />
                  <div className="flex-1 text-sm">
                    <Link href={`/product/${i.slug}`} target="_blank" className="font-medium hover:underline">{i.name}</Link>
                    <div className="text-xs text-stone-500">Size {i.size}{i.color ? ` · ${i.color}` : ''}</div>
                  </div>
                  <div className="text-sm text-stone-500">{inr(i.price)} × {i.qty}</div>
                  <div className="w-24 text-right text-sm font-medium">{inr(i.price * i.qty)}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1 border-t border-stone-200 px-5 py-4 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{inr(o.subtotal)}</span></div>
              {o.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Discount {o.couponCode && `(${o.couponCode})`}</span><span>−{inr(o.discount)}</span></div>}
              <div className="flex justify-between"><span>Shipping</span><span>{inr(o.shipping)}</span></div>
              <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{inr(o.total)}</span></div>
            </div>
          </div>

          <div className="a-card p-5 print:hidden">
            <div className="mb-3 text-sm font-medium">Timeline</div>
            <ol className="space-y-3 border-l border-stone-200 pl-4">
              {[...o.statusHistory].reverse().map((h, i) => (
                <li key={i} className="text-sm">
                  <span className={`badge ${STATUS_STYLES[h.status]}`}>{h.status}</span>
                  <span className="ml-2 text-xs text-stone-500">{dateTime(h.at)}</span>
                  {h.note && <div className="mt-1 text-stone-600">{h.note}</div>}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-6">
          <div className="a-card space-y-1 p-5 text-sm">
            <div className="mb-2 font-medium">Customer</div>
            <div>{o.customer.name}</div>
            {o.customer.businessName && <div className="text-stone-600">{o.customer.businessName}</div>}
            {o.customer.gstin && <div className="text-stone-600">GSTIN: {o.customer.gstin}</div>}
            <div className="text-stone-600">{o.customer.phone}</div>
            {o.customer.email && <div className="text-stone-600">{o.customer.email}</div>}
            <div className="pt-3 font-medium">Ship to</div>
            <div className="text-stone-600">{[a.line1, a.line2].filter(Boolean).join(', ')}<br />{a.city}, {a.state} {a.pincode}</div>
            {o.notes && (<><div className="pt-3 font-medium">Notes</div><div className="text-stone-600">{o.notes}</div></>)}
          </div>

          <form onSubmit={save} className="a-card space-y-3 p-5 print:hidden">
            <div className="text-sm font-medium">Update order</div>
            <div><label className="a-label">Order status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="a-input capitalize">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {form.status === 'cancelled' && o.status !== 'cancelled' && <p className="mt-1 text-xs text-amber-700">Stock will be returned to inventory.</p>}
            </div>
            <div><label className="a-label">Payment status</label>
              <select value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })} className="a-input capitalize">
                {['pending', 'paid', 'failed', 'refunded'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="a-label">Courier</label><input value={form.courier} onChange={(e) => setForm({ ...form, courier: e.target.value })} className="a-input" placeholder="Delhivery" /></div>
              <div><label className="a-label">Tracking no.</label><input value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} className="a-input" /></div>
            </div>
            <div><label className="a-label">Internal note</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="a-input" /></div>
            <button disabled={saving} className="a-btn w-full">{saving ? 'Saving…' : 'Save changes'}</button>
          </form>
        </div>
      </div>
    </>
  );
}
