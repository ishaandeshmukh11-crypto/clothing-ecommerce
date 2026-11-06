'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import AuthForm from '@/components/AuthForm';
import { api } from '@/lib/api';
import { inr, date, STATUS_STYLES } from '@/lib/format';
import { useAuth, useHydrated } from '@/lib/store';

function Account() {
  const hydrated = useHydrated();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const { user, logout, setUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('orders');
  const [p, setP] = useState({});

  useEffect(() => {
    if (!user) return;
    setP({ name: user.name || '', phone: user.phone || '', city: user.city || '', businessName: user.businessName || '', gstin: user.gstin || '', ...(user.address || {}) });
    api('/orders/mine').then(setOrders).catch(() => {});
  }, [user]);

  if (!hydrated) return <div className="container-x py-24" />;

  if (!user) {
    return (
      <div className="container-x max-w-md py-16">
        <h1 className="mb-8 text-center text-4xl">My account</h1>
        <AuthForm onDone={(u) => router.push(u.role === 'admin' ? '/admin' : next || '/account')} />
      </div>
    );
  }

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const { line1, line2, state, pincode, ...rest } = p;
      const d = await api('/auth/me', { method: 'PUT', body: { ...rest, address: { fullName: p.name, phone: p.phone, line1, line2, city: p.city, state, pincode } } });
      setUser(d.user);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err.message);
    }
  };
  const set = (k) => (e) => setP((x) => ({ ...x, [k]: e.target.value }));

  return (
    <div className="container-x py-12">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">My account</div>
          <h1 className="mt-2 text-4xl">Hello, {user.name.split(' ')[0]}</h1>
          {user.role === 'wholesale' && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              Wholesale account: <span className={`badge ${STATUS_STYLES[user.wholesaleStatus]}`}>{user.wholesaleStatus}</span>
              {user.wholesaleStatus === 'pending' && <span className="text-ink-muted">— we&apos;ll notify you once approved</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {user.role === 'admin' && <Link href="/admin" className="btn-accent btn-sm">Open admin panel</Link>}
          <button onClick={() => { logout(); router.push('/'); }} className="btn-outline btn-sm">Log out</button>
        </div>
      </div>

      <div className="mb-8 flex gap-6 border-b border-sand-dark text-xs uppercase tracking-widest">
        {[['orders', 'My orders'], ['profile', 'Profile & address']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`pb-3 ${tab === k ? 'border-b-2 border-ink' : 'text-ink-muted'}`}>{l}</button>
        ))}
      </div>

      {tab === 'orders' ? (
        orders.length === 0 ? (
          <div className="py-16 text-center text-ink-muted">No orders yet. <Link href="/shop" className="text-clay underline">Start shopping</Link></div>
        ) : (
          <div className="divide-y divide-sand-dark border-y border-sand-dark">
            {orders.map((o) => (
              <Link key={o._id} href={`/order/${o._id}`} className="flex flex-wrap items-center justify-between gap-3 py-5 hover:bg-white/60">
                <div>
                  <div className="font-medium">{o.orderNumber}</div>
                  <div className="text-xs text-ink-muted">{date(o.createdAt)} · {o.items.reduce((n, i) => n + i.qty, 0)} items</div>
                </div>
                <span className={`badge ${STATUS_STYLES[o.status]}`}>{o.status}</span>
                <div className="font-medium">{inr(o.total)}</div>
              </Link>
            ))}
          </div>
        )
      ) : (
        <form onSubmit={saveProfile} className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <div><label className="label">Name</label><input value={p.name || ''} onChange={set('name')} className="input" /></div>
          <div><label className="label">Mobile</label><input value={p.phone || ''} onChange={set('phone')} className="input" /></div>
          {user.role === 'wholesale' && (
            <>
              <div><label className="label">Business name</label><input value={p.businessName || ''} onChange={set('businessName')} className="input" /></div>
              <div><label className="label">GSTIN</label><input value={p.gstin || ''} onChange={set('gstin')} className="input uppercase" /></div>
            </>
          )}
          <div className="sm:col-span-2"><label className="label">Address</label><input value={p.line1 || ''} onChange={set('line1')} className="input" /></div>
          <div className="sm:col-span-2"><label className="label">Area / landmark</label><input value={p.line2 || ''} onChange={set('line2')} className="input" /></div>
          <div><label className="label">City</label><input value={p.city || ''} onChange={set('city')} className="input" /></div>
          <div><label className="label">State</label><input value={p.state || ''} onChange={set('state')} className="input" /></div>
          <div><label className="label">Pincode</label><input value={p.pincode || ''} onChange={set('pincode')} className="input" /></div>
          <div className="sm:col-span-2"><button className="btn-primary">Save</button></div>
        </form>
      )}
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="container-x py-24" />}>
      <Account />
    </Suspense>
  );
}
