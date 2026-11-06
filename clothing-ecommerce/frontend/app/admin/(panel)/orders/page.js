'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';
import { PageHeader, Empty } from '@/components/admin/ui';
import { api } from '@/lib/api';
import { inr, dateTime, STATUS_STYLES } from '@/lib/format';

const STATUSES = ['', 'pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

function Orders() {
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get('status') || '');
  const [type, setType] = useState('');
  const [source, setSource] = useState(params.get('source') || '');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '25', ...(status && { status }), ...(type && { type }), ...(source && { source }), ...(q && { q }) });
    api(`/orders?${qs}`).then(setData).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [status, type, source, page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title="Orders" subtitle={`${data.total} orders`} />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button key={s || 'all'} onClick={() => { setStatus(s); setPage(1); }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${status === s ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="a-card mb-4 flex flex-wrap gap-3 p-3">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }} className="flex flex-1 items-center gap-2">
          <Search size={16} className="text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order number, name, phone or email" className="flex-1 bg-transparent text-sm outline-none" />
        </form>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="a-input w-auto">
          <option value="">Retail + wholesale</option><option value="retail">Retail</option><option value="wholesale">Wholesale</option>
        </select>
        <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} className="a-input w-auto">
          <option value="">All channels</option><option value="website">🌐 Website</option><option value="whatsapp">💬 WhatsApp</option><option value="instagram">📸 Instagram</option>
        </select>
      </div>

      <div className="a-card overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr><th className="a-th">Order</th><th className="a-th">Customer</th><th className="a-th">Type</th><th className="a-th">Items</th><th className="a-th">Total</th><th className="a-th">Payment</th><th className="a-th">Status</th><th className="a-th">Date</th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {data.items.map((o) => (
              <tr key={o._id} className="hover:bg-stone-50">
                <td className="a-td"><Link href={`/admin/orders/${o._id}`} className="font-medium text-stone-900 hover:underline">{o.orderNumber}</Link></td>
                <td className="a-td">{o.customer?.name}<div className="text-xs text-stone-500">{o.customer?.phone}</div></td>
                <td className="a-td"><span className={`badge ${o.customerType === 'wholesale' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-700'}`}>{o.customerType}</span><div className="mt-1 text-xs text-stone-500">{{ whatsapp: '💬 WhatsApp', instagram: '📸 Instagram', admin: 'Admin' }[o.source] || '🌐 Website'}</div></td>
                <td className="a-td">{o.items.reduce((n, i) => n + i.qty, 0)}</td>
                <td className="a-td font-medium">{inr(o.total)}</td>
                <td className="a-td uppercase text-xs">{o.paymentMethod}<div><span className={`badge ${STATUS_STYLES[o.paymentStatus]} normal-case`}>{o.paymentStatus}</span></div></td>
                <td className="a-td"><span className={`badge ${STATUS_STYLES[o.status]}`}>{o.status}</span></td>
                <td className="a-td text-stone-500">{dateTime(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && data.items.length === 0 && <Empty>No orders found.</Empty>}
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

export default function OrdersAdmin() {
  return <Suspense fallback={null}><Orders /></Suspense>;
}
