'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { useSettings } from '@/components/SettingsProvider';
import { api, img } from '@/lib/api';
import { inr, dateTime, waLink, STATUS_STYLES } from '@/lib/format';

const STEPS = ['pending', 'confirmed', 'packed', 'shipped', 'delivered'];

export default function OrderPage({ params }) {
  const { id } = use(params);
  const key = useSearchParams().get('key') || '';
  const s = useSettings();
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api(`/orders/${id}${key ? `?key=${key}` : ''}`).then(setOrder).catch((e) => setErr(e.message));
  }, [id, key]);

  if (err) return <div className="container-x py-28 text-center"><h1 className="text-3xl">Order not found</h1><p className="mt-2 text-ink-muted">{err}</p></div>;
  if (!order) return <div className="container-x py-28 text-center text-ink-muted">Loading your order…</div>;

  const stepIndex = STEPS.indexOf(order.status);

  return (
    <div className="container-x max-w-3xl py-14">
      <div className="text-center">
        <CheckCircle2 size={48} strokeWidth={1.25} className="mx-auto text-clay" />
        <h1 className="mt-4 text-4xl md:text-5xl">Thank you, {order.customer?.name?.split(' ')[0]}!</h1>
        <p className="mt-3 text-ink-muted">
          Your order <span className="font-medium text-ink">{order.orderNumber}</span> has been received. We&apos;ll keep you updated on WhatsApp.
        </p>
      </div>

      {order.status !== 'cancelled' ? (
        <div className="mt-12 grid grid-cols-5 gap-1">
          {STEPS.map((st, i) => (
            <div key={st} className="text-center">
              <div className={`h-1 ${i <= stepIndex ? 'bg-clay' : 'bg-sand-dark'}`} />
              <div className={`mt-2 text-[10px] uppercase tracking-widest ${i <= stepIndex ? 'text-ink' : 'text-ink-muted'}`}>{st}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-10 text-center"><span className={`badge ${STATUS_STYLES.cancelled}`}>Cancelled</span></div>
      )}

      <div className="mt-12 border border-sand-dark bg-sand p-6 md:p-8">
        <div className="flex flex-wrap justify-between gap-4 border-b border-sand-dark pb-4 text-sm">
          <div><div className="text-xs uppercase tracking-widest text-ink-muted">Placed</div>{dateTime(order.createdAt)}</div>
          <div><div className="text-xs uppercase tracking-widest text-ink-muted">Payment</div>{order.paymentMethod.toUpperCase()} · <span className={`badge ${STATUS_STYLES[order.paymentStatus]}`}>{order.paymentStatus}</span></div>
          {order.trackingNumber && <div><div className="text-xs uppercase tracking-widest text-ink-muted">Tracking</div>{order.courier} {order.trackingNumber}</div>}
        </div>
        <div className="divide-y divide-sand-dark">
          {order.items.map((i, idx) => (
            <div key={idx} className="flex gap-4 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(i.image)} alt="" className="h-20 w-16 bg-sand object-cover" />
              <div className="flex-1 text-sm">
                <div>{i.name}</div>
                <div className="text-xs text-ink-muted">Size {i.size}{i.color ? ` · ${i.color}` : ''} · Qty {i.qty}</div>
              </div>
              <div className="text-sm">{inr(i.price * i.qty)}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t border-sand-dark pt-4 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{inr(order.subtotal)}</span></div>
          {order.discount > 0 && <div className="flex justify-between text-clay"><span>Discount</span><span>−{inr(order.discount)}</span></div>}
          <div className="flex justify-between"><span>Shipping</span><span>{order.customerType === 'wholesale' ? 'To be confirmed' : order.shipping ? inr(order.shipping) : 'Free'}</span></div>
          <div className="flex justify-between text-base font-medium"><span>Total</span><span>{inr(order.total)}</span></div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href={waLink(s.whatsappNumber, `Hi ${s.storeName}, I have a question about my order ${order.orderNumber}.`)} target="_blank" rel="noreferrer" className="btn-whatsapp">
          Questions? Chat on WhatsApp
        </a>
        <Link href="/shop" className="btn-outline">Continue shopping</Link>
      </div>
    </div>
  );
}
