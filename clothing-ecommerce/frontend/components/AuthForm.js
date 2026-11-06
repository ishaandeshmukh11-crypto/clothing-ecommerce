'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';

/** Login / register form. `wholesaleOnly` shows the wholesale signup directly. */
export default function AuthForm({ wholesaleOnly = false, onDone }) {
  const setAuth = useAuth((s) => s.setAuth);
  const [mode, setMode] = useState(wholesaleOnly ? 'register' : 'login');
  const [type, setType] = useState(wholesaleOnly ? 'wholesale' : 'retail');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', businessName: '', gstin: '', city: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data =
        mode === 'login'
          ? await api('/auth/login', { method: 'POST', body: { email: f.email, password: f.password } })
          : await api('/auth/register', { method: 'POST', body: { ...f, accountType: type } });
      setAuth(data);
      toast.success(mode === 'login' ? `Welcome back, ${data.user.name.split(' ')[0]}` : type === 'wholesale' ? 'Application received! We will approve your account shortly.' : 'Account created');
      onDone?.(data.user);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {!wholesaleOnly && (
        <div className="mb-8 grid grid-cols-2 border-b border-sand-dark text-center text-xs uppercase tracking-widest">
          {['login', 'register'].map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`pb-3 ${mode === m ? 'border-b-2 border-ink text-ink' : 'text-ink-muted'}`}>
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' && !wholesaleOnly && (
          <div className="grid grid-cols-2 gap-2">
            {[['retail', 'Retail customer'], ['wholesale', 'Wholesale buyer']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setType(v)} className={`border px-3 py-2.5 text-xs uppercase tracking-wider ${type === v ? 'border-ink bg-ink text-ivory' : 'border-sand-dark'}`}>
                {l}
              </button>
            ))}
          </div>
        )}
        {mode === 'register' && (
          <>
            <div><label className="label">Full name</label><input required value={f.name} onChange={set('name')} className="input" /></div>
            <div><label className="label">Mobile (WhatsApp)</label><input required value={f.phone} onChange={set('phone')} inputMode="tel" className="input" /></div>
          </>
        )}
        {mode === 'register' && type === 'wholesale' && (
          <>
            <div><label className="label">Business / shop name</label><input required value={f.businessName} onChange={set('businessName')} className="input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">GSTIN (optional)</label><input value={f.gstin} onChange={set('gstin')} className="input uppercase" /></div>
              <div><label className="label">City</label><input value={f.city} onChange={set('city')} className="input" /></div>
            </div>
          </>
        )}
        <div><label className="label">Email</label><input required type="email" value={f.email} onChange={set('email')} className="input" autoComplete="email" /></div>
        <div><label className="label">Password</label><input required type="password" minLength={6} value={f.password} onChange={set('password')} className="input" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>
        <button disabled={busy} className="btn-primary w-full">
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : type === 'wholesale' ? 'Apply for wholesale account' : 'Create account'}
        </button>
        {wholesaleOnly && (
          <p className="text-center text-xs text-ink-muted">
            Already registered? <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-clay underline">{mode === 'login' ? 'Create an account' : 'Sign in'}</button>
          </p>
        )}
      </form>
    </div>
  );
}
