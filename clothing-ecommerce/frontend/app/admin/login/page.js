'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth, useHydrated } from '@/lib/store';

export default function AdminLogin() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { user, setAuth } = useAuth();
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hydrated && user?.role === 'admin') router.replace('/admin');
  }, [hydrated, user, router]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: f });
      if (data.user.role !== 'admin') throw new Error('This account does not have admin access');
      setAuth(data);
      router.replace('/admin');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4 font-sans">
      <form onSubmit={submit} className="a-card w-full max-w-sm p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-900 text-white"><Lock size={20} /></div>
        <h1 className="text-center font-sans text-xl font-semibold tracking-normal">Admin sign in</h1>
        <p className="mb-6 mt-1 text-center text-sm text-stone-500">Manage products, orders and customers</p>
        <div className="space-y-4">
          <div><label className="a-label">Email</label><input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="a-input" autoComplete="username" /></div>
          <div><label className="a-label">Password</label><input required type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="a-input" autoComplete="current-password" /></div>
          <button disabled={busy} className="a-btn w-full py-2.5">{busy ? 'Signing in…' : 'Sign in'}</button>
        </div>
      </form>
    </div>
  );
}
