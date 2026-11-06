'use client';

import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';

// Refresh the logged-in user once per visit (e.g. wholesale approval may have changed)
function AuthRefresher() {
  const token = useAuth((s) => s.token);
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logout);
  useEffect(() => {
    if (!token) return;
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch((e) => e.status === 401 && logout());
  }, [token, setUser, logout]);
  return null;
}

// Remembers which channel the visitor came from (Instagram, WhatsApp, a shared link) for order tracking
function SourceTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('store-src')) return;
      const src = new URLSearchParams(window.location.search).get('src') || (/instagram\.com/i.test(document.referrer) ? 'instagram' : /whatsapp|wa\.me/i.test(document.referrer) ? 'whatsapp' : '');
      if (src) sessionStorage.setItem('store-src', src.toLowerCase());
    } catch {}
  }, []);
  return null;
}

export default function Providers({ children }) {
  return (
    <>
      <AuthRefresher />
      <SourceTracker />
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: { borderRadius: 0, background: '#1c1917', color: '#faf7f2', fontSize: 14 },
          success: { iconTheme: { primary: '#b8925a', secondary: '#1c1917' } },
        }}
      />
    </>
  );
}
