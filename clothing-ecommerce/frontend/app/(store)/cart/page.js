'use client';

import Link from 'next/link';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Minus, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useSettings } from '@/components/SettingsProvider';
import { api, img } from '@/lib/api';
import { inr } from '@/lib/format';
import { useAuth, useCart, useHydrated, isWholesaleUser } from '@/lib/store';
import { useQuote } from '@/lib/useQuote';

export default function CartPage() {
  const s = useSettings();
  const hydrated = useHydrated();
  const { items, setQty, remove, couponCode, setCoupon } = useCart();
  const user = useAuth((st) => st.user);
  const wholesale = isWholesaleUser(user);
  const { quote, error, loading } = useQuote(hydrated ? items : [], couponCode);
  const [code, setCode] = useState('');

  if (!hydrated) return <div className="container-x py-24" />;

  if (!items.length) {
    return (
      <div className="container-x py-28 text-center">
        <h1 className="text-4xl">Your bag is empty</h1>
        <p className="mt-3 text-ink-muted">Discover our latest collections and find something you love.</p>
        <Link href="/shop" className="btn-primary mt-8">Continue shopping</Link>
      </div>
    );
  }

  const applyCoupon = async () => {
    if (!code.trim()) return;
    try {
      const r = await api('/coupons/validate', { method: 'POST', body: { code, subtotal: quote?.subtotal || 0 } });
      setCoupon(r.code);
      toast.success(`Coupon applied — you save ${inr(r.discount)}`);
      setCode('');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const priceFor = (i) => (wholesale && i.wholesalePrice ? i.wholesalePrice : i.price);

  // MOQ hints per product for wholesale buyers
  const qtyByProduct = items.reduce((m, i) => ({ ...m, [i.productId]: (m[i.productId] || 0) + i.qty }), {});

  return (
    <div className="container-x py-12">
      <h1 className="mb-10 text-4xl md:text-5xl">Shopping bag</h1>
      <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
        <div className="divide-y divide-sand-dark border-y border-sand-dark">
          {items.map((i) => {
            const short = wholesale && i.wholesalePrice && qtyByProduct[i.productId] < i.moq;
            return (
              <div key={i.key} className="flex gap-4 py-6">
                <Link href={`/product/${i.slug}`} className="w-24 shrink-0 bg-sand md:w-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(i.image)} alt={i.name} className="aspect-[3/4] w-full object-cover" />
                </Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex justify-between gap-4">
                    <div>
                      <Link href={`/product/${i.slug}`} className="font-display text-xl hover:text-clay">{i.name}</Link>
                      <div className="mt-1 text-xs uppercase tracking-wider text-ink-muted">
                        Size {i.size}{i.color ? ` · ${i.color}` : ''}
                      </div>
                    </div>
                    <div className="text-right text-sm font-medium">{inr(priceFor(i) * i.qty)}</div>
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">{inr(priceFor(i))} each</div>
                  {short && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-clay">
                      <AlertCircle size={14} /> Add {i.moq - qtyByProduct[i.productId]} more pcs of this style (any size) to meet MOQ {i.moq}
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <div className="flex items-center border border-sand-dark">
                      <button className="p-2" onClick={() => setQty(i.key, i.qty - 1)} aria-label="Decrease"><Minus size={14} /></button>
                      <span className="w-10 text-center text-sm">{i.qty}</span>
                      <button className="p-2" onClick={() => setQty(i.key, i.qty + 1)} aria-label="Increase"><Plus size={14} /></button>
                    </div>
                    <button onClick={() => remove(i.key)} className="flex items-center gap-1 text-xs uppercase tracking-wider text-ink-muted hover:text-clay">
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="h-fit border border-sand-dark bg-sand p-6 md:p-8 lg:sticky lg:top-32">
          <h2 className="text-2xl">Order summary</h2>
          {wholesale && <div className="mt-3 inline-block bg-gold/15 px-2 py-1 text-[11px] uppercase tracking-widest text-clay">Wholesale pricing applied</div>}

          <div className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{quote ? inr(quote.subtotal) : '—'}</span></div>
            {quote?.discount > 0 && (
              <div className="flex justify-between text-clay">
                <span>Coupon {quote.couponCode} <button className="ml-1 underline" onClick={() => setCoupon('')}>remove</button></span>
                <span>−{inr(quote.discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{wholesale ? 'Confirmed later' : quote ? (quote.shipping ? inr(quote.shipping) : 'Free') : '—'}</span>
            </div>
            {!wholesale && quote && quote.shipping > 0 && (
              <p className="text-xs text-ink-muted">Add {inr(s.freeShippingAbove - (quote.subtotal - quote.discount))} more for free shipping.</p>
            )}
            <div className="flex justify-between border-t border-sand-dark pt-4 text-base font-medium">
              <span>Total</span><span>{quote ? inr(quote.total) : '—'}</span>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex gap-2 border border-clay/30 bg-clay/5 p-3 text-xs text-clay">
              <AlertCircle size={16} className="shrink-0" /> {error}
            </div>
          )}

          {!couponCode && (
            <div className="mt-6 flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Coupon code" className="input py-2.5" />
              <button onClick={applyCoupon} className="btn-outline btn-sm">Apply</button>
            </div>
          )}

          <Link href="/checkout" aria-disabled={!quote || loading}
            className={`btn-primary mt-6 w-full ${!quote || loading ? 'pointer-events-none opacity-50' : ''}`}>
            Proceed to checkout
          </Link>
          <Link href="/shop" className="mt-3 block text-center text-xs uppercase tracking-widest text-ink-muted hover:text-ink">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
