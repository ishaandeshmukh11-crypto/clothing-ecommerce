'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Search, Check, X, MessageCircle } from 'lucide-react';
import { PageHeader, Empty } from '@/components/admin/ui';
import { api } from '@/lib/api';
import { inr, date, waLink, STATUS_STYLES } from '@/lib/format';

const TABS = [
  { key: 'all', label: 'All customers', query: {} },
  { key: 'pending', label: 'Wholesale requests', query: { wholesaleStatus: 'pending' } },
  { key: 'wholesale', label: 'Approved wholesale', query: { wholesaleStatus: 'approved' } },
  { key: 'retail', label: 'Retail', query: { role: 'customer' } },
];

function Customers() {
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get('wholesaleStatus') === 'pending' ? 'pending' : 'all');
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const t = TABS.find((x) => x.key === tab);
    const qs = new URLSearchParams({ ...t.query, ...(q && { q }) });
    api(`/admin/users?${qs}`).then(setList).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = async (u, body, msg) => {
    try {
      await api(`/admin/users/${u._id}`, { method: 'PUT', body });
      toast.success(msg);
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Customers & Wholesale" subtitle="Approve wholesale buyers so they see wholesale prices" />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${tab === t.key ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}>{t.label}</button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="a-card mb-4 flex items-center gap-2 p-3">
        <Search size={16} className="text-stone-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone or business" className="flex-1 bg-transparent text-sm outline-none" />
      </form>

      <div className="a-card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr><th className="a-th">Customer</th><th className="a-th">Business</th><th className="a-th">Type</th><th className="a-th">Orders</th><th className="a-th">Spent</th><th className="a-th">Joined</th><th className="a-th text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {list.map((u) => (
              <tr key={u._id} className={`hover:bg-stone-50 ${u.isBlocked ? 'opacity-50' : ''}`}>
                <td className="a-td"><div className="font-medium text-stone-900">{u.name}</div><div className="text-xs text-stone-500">{u.email} · {u.phone}</div></td>
                <td className="a-td">{u.businessName || '—'}{u.gstin && <div className="text-xs text-stone-500">GST {u.gstin}</div>}{u.city && <div className="text-xs text-stone-500">{u.city}</div>}</td>
                <td className="a-td">
                  {u.role === 'wholesale' ? <span className={`badge ${STATUS_STYLES[u.wholesaleStatus]}`}>wholesale · {u.wholesaleStatus}</span> : <span className="badge bg-stone-100 text-stone-700">retail</span>}
                  {u.isBlocked && <span className="badge ml-1 bg-red-100 text-red-700">blocked</span>}
                </td>
                <td className="a-td">{u.orders}</td>
                <td className="a-td">{inr(u.spent)}</td>
                <td className="a-td text-stone-500">{date(u.createdAt)}</td>
                <td className="a-td">
                  <div className="flex flex-wrap justify-end gap-1">
                    {u.role === 'wholesale' && u.wholesaleStatus !== 'approved' && (
                      <button onClick={() => update(u, { wholesaleStatus: 'approved' }, 'Wholesale approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs text-white hover:bg-emerald-700"><Check size={14} /> Approve</button>
                    )}
                    {u.role === 'wholesale' && u.wholesaleStatus === 'pending' && (
                      <button onClick={() => update(u, { wholesaleStatus: 'rejected' }, 'Request rejected')} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs text-red-600 ring-1 ring-red-200 hover:bg-red-50"><X size={14} /> Reject</button>
                    )}
                    {u.role === 'customer' && (
                      <button onClick={() => update(u, { wholesaleStatus: 'approved' }, 'Upgraded to wholesale')} className="rounded-lg px-2.5 py-1 text-xs text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50">Make wholesale</button>
                    )}
                    {u.phone && <a href={waLink(u.phone.replace(/\D/g, '').length === 10 ? `91${u.phone.replace(/\D/g, '')}` : u.phone, `Hi ${u.name},`)} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-emerald-700 ring-1 ring-stone-200 hover:bg-emerald-50" title="WhatsApp"><MessageCircle size={14} /></a>}
                    <button onClick={() => update(u, { isBlocked: !u.isBlocked }, u.isBlocked ? 'Unblocked' : 'Blocked')} className="rounded-lg px-2.5 py-1 text-xs text-stone-500 ring-1 ring-stone-200 hover:bg-stone-50">{u.isBlocked ? 'Unblock' : 'Block'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && list.length === 0 && <Empty>No customers here yet.</Empty>}
      </div>
    </>
  );
}

export default function CustomersAdmin() {
  return <Suspense fallback={null}><Customers /></Suspense>;
}
