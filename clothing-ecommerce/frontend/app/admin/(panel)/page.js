'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IndianRupee, ShoppingCart, Clock, Users, UserCheck, Shirt } from 'lucide-react';
import { PageHeader } from '@/components/admin/ui';
import { SellerAppCard } from '@/components/admin/SellerApp';
import { api, img } from '@/lib/api';
import { inr, dateTime, STATUS_STYLES } from '@/lib/format';

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api('/admin/stats').then(setD).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="a-card p-6 text-sm text-red-600">{err}</div>;
  if (!d) return <div className="text-sm text-stone-500">Loading dashboard…</div>;

  const maxRev = Math.max(...d.sales.map((x) => x.revenue), 1);
  const cards = [
    { label: 'Total revenue', value: inr(d.revenue), sub: `Retail ${inr(d.retailRevenue)} · Wholesale ${inr(d.wholesaleRevenue)}`, icon: IndianRupee },
    { label: 'Orders', value: d.totalOrders, sub: `${d.todayOrders} today`, icon: ShoppingCart },
    { label: 'Pending orders', value: d.pendingOrders, sub: 'Need confirmation', icon: Clock, href: '/admin/orders?status=pending' },
    { label: 'Customers', value: d.customers, sub: `${d.products} products listed`, icon: Users },
    { label: 'Wholesale requests', value: d.wholesalePending, sub: 'Awaiting approval', icon: UserCheck, href: '/admin/customers?wholesaleStatus=pending' },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your store at a glance">
        <Link href="/admin/products/new" className="a-btn"><Shirt size={16} /> Add product</Link>
      </PageHeader>

      <div className="mb-6"><SellerAppCard /></div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map(({ label, value, sub, icon: Icon, href }) => {
          const body = (
            <div className="a-card h-full p-4">
              <div className="flex items-center justify-between text-stone-500">
                <span className="text-xs font-medium">{label}</span><Icon size={16} />
              </div>
              <div className="mt-2 text-2xl font-semibold text-stone-900">{value}</div>
              <div className="mt-1 text-xs text-stone-500">{sub}</div>
            </div>
          );
          return href ? <Link key={label} href={href} className="hover:opacity-80">{body}</Link> : <div key={label}>{body}</div>;
        })}
      </div>

      {d.bySource && (
        <div className="mt-4 grid grid-cols-3 gap-4">
          {[['website', 'Website', '🌐'], ['whatsapp', 'WhatsApp', '💬'], ['instagram', 'Instagram', '📸']].map(([k, l, e]) => (
            <Link key={k} href={`/admin/orders?source=${k}`} className="a-card p-4 hover:opacity-80">
              <div className="text-xs font-medium text-stone-500">{e} {l} orders · 14 days</div>
              <div className="mt-1 text-2xl font-semibold">{d.bySource[k] || 0}</div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="a-card p-5 lg:col-span-2">
          <div className="mb-4 text-sm font-medium">Sales — last 14 days</div>
          <div className="flex h-48 items-end gap-1.5">
            {d.sales.map((x) => (
              <div key={x.date} className="group relative flex flex-1 flex-col items-center justify-end">
                <div className="absolute -top-8 hidden whitespace-nowrap rounded bg-stone-900 px-2 py-1 text-[10px] text-white group-hover:block">
                  {inr(x.revenue)} · {x.orders} orders
                </div>
                <div className="w-full rounded-t bg-stone-800 transition group-hover:bg-amber-700" style={{ height: `${Math.max((x.revenue / maxRev) * 100, 2)}%` }} />
                <div className="mt-1 text-[10px] text-stone-400">{x.date.slice(8)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="a-card p-5">
          <div className="mb-4 text-sm font-medium">Low stock (≤ 5 pcs)</div>
          {d.lowStock.length === 0 ? (
            <p className="text-sm text-stone-500">All products are well stocked.</p>
          ) : (
            <ul className="space-y-3">
              {d.lowStock.map((p) => (
                <li key={p._id} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(p.images?.[0])} alt="" className="h-10 w-8 rounded object-cover" />
                  <Link href={`/admin/products/${p._id}`} className="flex-1 truncate text-sm hover:underline">{p.name}</Link>
                  <span className={`badge ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{p.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="a-card mt-6 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="text-sm font-medium">Recent orders</div>
          <Link href="/admin/orders" className="text-xs text-stone-500 hover:underline">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-stone-200 bg-stone-50">
              <tr><th className="a-th">Order</th><th className="a-th">Customer</th><th className="a-th">Type</th><th className="a-th">Total</th><th className="a-th">Status</th><th className="a-th">Date</th></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {d.recentOrders.map((o) => (
                <tr key={o._id} className="hover:bg-stone-50">
                  <td className="a-td"><Link href={`/admin/orders/${o._id}`} className="font-medium text-stone-900 hover:underline">{o.orderNumber}</Link></td>
                  <td className="a-td">{o.customer?.name}</td>
                  <td className="a-td capitalize">{o.customerType}</td>
                  <td className="a-td">{inr(o.total)}</td>
                  <td className="a-td"><span className={`badge ${STATUS_STYLES[o.status]}`}>{o.status}</span></td>
                  <td className="a-td text-stone-500">{dateTime(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {d.recentOrders.length === 0 && <p className="p-6 text-center text-sm text-stone-500">No orders yet.</p>}
        </div>
      </div>
    </>
  );
}
