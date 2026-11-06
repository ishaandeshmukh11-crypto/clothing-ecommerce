'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertCircle, Lock } from 'lucide-react';
import { useSettings } from '@/components/SettingsProvider';
import { api, img } from '@/lib/api';
import { inr, waLink } from '@/lib/format';
import { useAuth, useCart, useHydrated, isWholesaleUser } from '@/lib/store';
import { useQuote } from '@/lib/useQuote';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman & Nicobar', 'Chandigarh', 'Dadra & Nagar Haveli and Daman & Diu', 'Lakshadweep'];

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function CheckoutPage() {
  const s = useSettings();
  const router = useRouter();
  const hydrated = useHydrated();
  const { items, couponCode, clear } = useCart();
  const user = useAuth((st) => st.user);
  const wholesale = isWholesaleUser(user);
  const { quote, error } = useQuote(hydrated ? items : [], couponCode);
  const [placing, setPlacing] = useState(false);

  const methods = [
    s.razorpayEnabled && { id: 'razorpay', title: 'Pay online', text: 'UPI, cards, net-banking & wallets — secured by Razorpay' },
    s.codEnabled && !wholesale && { id: 'cod', title: 'Cash on delivery', text: 'Pay when your order arrives' },
    s.whatsappOrderEnabled && { id: 'whatsapp', title: 'Confirm on WhatsApp', text: 'Send your order to us on WhatsApp and pay as agreed' },
  ].filter(Boolean);

  const [f, setF] = useState({ name: '', email: '', phone: '', businessName: '', gstin: '', line1: '', line2: '', city: '', state: '', pincode: '', notes: '', paymentMethod: '' });
  useEffect(() => {
    if (user) {
      const a = user.address || {};
      setF((x) => ({ ...x, name: x.name || user.name || '', email: x.email || user.email || '', phone: x.phone || user.phone || '', businessName: user.businessName || '', gstin: user.gstin || '', line1: a.line1 || x.line1, line2: a.line2 || x.line2, city: a.city || user.city || x.city, state: a.state || x.state, pincode: a.pincode || x.pincode }));
    }
  }, [user]);
  useEffect(() => {
    if (!f.paymentMethod && methods[0]) setF((x) => ({ ...x, paymentMethod: methods[0].id }));
  }, [methods.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (hydrated && !items.length && !placing) router.replace('/cart');
  }, [hydrated, items.length, placing, router]);

  const goToOrder = (order, accessKey) => {
    clear();
    router.push(`/order/${order._id}?key=${accessKey}`);
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(f.phone.replace(/\D/g, '').slice(-10))) return toast.error('Please enter a valid 10-digit mobile number');
    if (!/^\d{6}$/.test(f.pincode)) return toast.error('Please enter a valid 6-digit pincode');
    setPlacing(true);
    try {
      const { order, accessKey } = await api('/orders', {
        method: 'POST',
        body: {
          items: items.map(({ productId, size, color, qty }) => ({ productId, size, color, qty })),
          couponCode: couponCode || undefined,
          customer: { name: f.name, email: f.email, phone: f.phone, businessName: f.businessName, gstin: f.gstin },
          shippingAddress: { line1: f.line1, line2: f.line2, city: f.city, state: f.state, pincode: f.pincode },
          notes: f.notes,
          paymentMethod: f.paymentMethod,
          source: (() => { try { return sessionStorage.getItem('store-src') || 'website'; } catch { return 'website'; } })(),
        },
      });

      if (f.paymentMethod === 'whatsapp') {
        const lines = order.items.map((i) => `• ${i.name} (${i.size}${i.color ? `, ${i.color}` : ''}) × ${i.qty} = ${inr(i.price * i.qty)}`).join('\n');
        const msg = `Hi ${s.storeName}! I'd like to confirm my order *${order.orderNumber}*\n\n${lines}\n\nTotal: ${inr(order.total)}\nName: ${f.name}\nPhone: ${f.phone}\nAddress: ${[f.line1, f.line2, f.city, f.state, f.pincode].filter(Boolean).join(', ')}`;
        window.open(waLink(s.whatsappNumber, msg), '_blank');
        return goToOrder(order, accessKey);
      }

      if (f.paymentMethod === 'razorpay') {
        const ok = await loadRazorpay();
        if (!ok) throw new Error('Could not load the payment window. Check your internet and try again.');
        const r = await api('/payments/razorpay/create', { method: 'POST', body: { orderId: order._id, key: accessKey } });
        const rzp = new window.Razorpay({
          key: r.keyId,
          amount: r.amount,
          currency: r.currency,
          name: r.storeName,
          order_id: r.razorpayOrderId,
          prefill: r.prefill,
          theme: { color: '#1c1917' },
          handler: async (resp) => {
            try {
              await api('/payments/razorpay/verify', { method: 'POST', body: { orderId: order._id, key: accessKey, ...resp } });
              toast.success('Payment successful');
            } catch (err) {
              toast.error(err.message);
            }
            goToOrder(order, accessKey);
          },
          modal: {
            ondismiss: () => {
              toast('Payment not completed. You can retry from your order page.');
              goToOrder(order, accessKey);
            },
          },
        });
        rzp.open();
        return;
      }

      goToOrder(order, accessKey);
    } catch (err) {
      toast.error(err.message);
      setPlacing(false);
    }
  };

  if (!hydrated) return <div className="container-x py-24" />;

  return (
    <div className="container-x py-12">
      <h1 className="mb-10 text-4xl md:text-5xl">Checkout</h1>
      {!user && (
        <p className="mb-8 text-sm text-ink-muted">
          Have an account? <Link href="/account?next=/checkout" className="text-clay underline">Log in</Link> for faster checkout and order tracking. Wholesale buyers must log in to get wholesale prices.
        </p>
      )}

      <form onSubmit={placeOrder} className="grid gap-12 lg:grid-cols-[1fr_400px]">
        <div className="space-y-10">
          <section>
            <h2 className="mb-5 text-2xl">Contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Full name *</label><input required value={f.name} onChange={set('name')} className="input" /></div>
              <div><label className="label">Mobile (WhatsApp) *</label><input required value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="10-digit number" className="input" /></div>
              <div className="sm:col-span-2"><label className="label">Email</label><input type="email" value={f.email} onChange={set('email')} className="input" /></div>
              {wholesale && (
                <>
                  <div><label className="label">Business name</label><input value={f.businessName} onChange={set('businessName')} className="input" /></div>
                  <div><label className="label">GSTIN</label><input value={f.gstin} onChange={set('gstin')} className="input uppercase" /></div>
                </>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-5 text-2xl">Delivery address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="label">House / flat, street *</label><input required value={f.line1} onChange={set('line1')} className="input" /></div>
              <div className="sm:col-span-2"><label className="label">Area, landmark</label><input value={f.line2} onChange={set('line2')} className="input" /></div>
              <div><label className="label">City *</label><input required value={f.city} onChange={set('city')} className="input" /></div>
              <div><label className="label">Pincode *</label><input required value={f.pincode} onChange={set('pincode')} inputMode="numeric" maxLength={6} className="input" /></div>
              <div className="sm:col-span-2">
                <label className="label">State *</label>
                <select required value={f.state} onChange={set('state')} className="input">
                  <option value="">Select state</option>
                  {STATES.map((st) => <option key={st}>{st}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2"><label className="label">Order notes</label><textarea rows={2} value={f.notes} onChange={set('notes')} placeholder="Any special instructions" className="input" /></div>
            </div>
          </section>

          <section>
            <h2 className="mb-5 text-2xl">Payment</h2>
            {methods.length === 0 && <p className="text-sm text-clay">No payment method is enabled. Please contact the store.</p>}
            <div className="space-y-3">
              {methods.map((m) => (
                <label key={m.id} className={`flex cursor-pointer items-start gap-3 border p-4 transition ${f.paymentMethod === m.id ? 'border-ink bg-white' : 'border-sand-dark'}`}>
                  <input type="radio" name="pm" checked={f.paymentMethod === m.id} onChange={() => setF((x) => ({ ...x, paymentMethod: m.id }))} className="mt-1 accent-ink" />
                  <div>
                    <div className="text-sm font-medium">{m.title}</div>
                    <div className="text-xs text-ink-muted">{m.text}</div>
                  </div>
                </label>
              ))}
            </div>
            {wholesale && <p className="mt-3 text-xs text-ink-muted">{s.wholesaleShippingNote}</p>}
          </section>
        </div>

        <aside className="h-fit border border-sand-dark bg-sand p-6 md:p-8 lg:sticky lg:top-32">
          <h2 className="text-2xl">Your order</h2>
          <div className="mt-6 max-h-72 space-y-4 overflow-y-auto">
            {(quote?.lines || []).map((l, idx) => (
              <div key={idx} className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img(l.image)} alt="" className="h-20 w-16 shrink-0 bg-sand object-cover" />
                <div className="flex-1 text-sm">
                  <div className="font-normal leading-snug">{l.name}</div>
                  <div className="text-xs text-ink-muted">Size {l.size}{l.color ? ` · ${l.color}` : ''} · Qty {l.qty}</div>
                </div>
                <div className="text-sm">{inr(l.price * l.qty)}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2 border-t border-sand-dark pt-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{quote ? inr(quote.subtotal) : '—'}</span></div>
            {quote?.discount > 0 && <div className="flex justify-between text-clay"><span>Discount ({quote.couponCode})</span><span>−{inr(quote.discount)}</span></div>}
            <div className="flex justify-between"><span>Shipping</span><span>{wholesale ? 'Confirmed later' : quote ? (quote.shipping ? inr(quote.shipping) : 'Free') : '—'}</span></div>
            <div className="flex justify-between border-t border-sand-dark pt-3 text-base font-medium"><span>Total</span><span>{quote ? inr(quote.total) : '—'}</span></div>
          </div>
          {error && <div className="mt-4 flex gap-2 border border-clay/30 bg-clay/5 p-3 text-xs text-clay"><AlertCircle size={16} className="shrink-0" /> {error} <Link href="/cart" className="underline">Edit bag</Link></div>}
          <button disabled={placing || !quote || !methods.length} className="btn-primary mt-6 w-full">
            <Lock size={14} /> {placing ? 'Placing order…' : f.paymentMethod === 'razorpay' ? `Pay ${quote ? inr(quote.total) : ''}` : 'Place order'}
          </button>
        </aside>
      </form>
    </div>
  );
}
