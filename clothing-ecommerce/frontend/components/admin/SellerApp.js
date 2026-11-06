'use client';

/**
 * Seller app helpers: registers the service worker, push notifications, the "Install app"
 * prompt, and a live order watcher that pings while the app is open.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

const Ctx = createContext(null);
export const useSellerApp = () => useContext(Ctx);

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone);

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.18].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.16);
    });
  } catch {}
}

export function SellerAppProvider({ children }) {
  const [reg, setReg] = useState(null);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState('default');
  const [server, setServer] = useState({ enabled: false, publicKey: null });
  const [installEvent, setInstallEvent] = useState(null);
  const [newOrders, setNewOrders] = useState(0);
  const lastSeen = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('Notification' in window) setPermission(Notification.permission);
    api('/push/public-key').then(setServer).catch(() => {});
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/seller-sw.js', { scope: '/admin' }).then(async (r) => {
        setReg(r);
        const sub = await r.pushManager?.getSubscription();
        setSubscribed(!!sub);
      }).catch(() => {});
    }
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // Live watcher: checks for new orders every 30s while the app is open
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const d = await api('/orders?limit=1');
        const latest = d.items?.[0];
        if (latest) {
          if (lastSeen.current && latest._id !== lastSeen.current) {
            setNewOrders((n) => n + 1);
            beep();
            toast.success(`New order ${latest.orderNumber} · ₹${latest.total} (${latest.source || 'website'})`, { duration: 8000 });
          }
          lastSeen.current = latest._id;
        }
      } catch {}
      if (!stop) setTimeout(tick, 30000);
    };
    tick();
    return () => {
      stop = true;
    };
  }, []);

  const enableNotifications = useCallback(async () => {
    if (!('Notification' in window) || !reg?.pushManager) {
      toast.error(isIOS() && !isStandalone() ? 'On iPhone: tap Share → “Add to Home Screen”, open the app from there, then enable notifications.' : 'This browser does not support notifications.');
      return;
    }
    if (!server.enabled || !server.publicKey) {
      toast.error('Push is not set up on the server yet (VAPID keys missing). Ask your developer.');
      return;
    }
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p !== 'granted') {
      toast.error('Notifications are blocked. Allow them in your phone settings for this app.');
      return;
    }
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(server.publicKey) }));
    await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), device: navigator.userAgent } });
    setSubscribed(true);
    toast.success('Order notifications are ON for this phone');
  }, [reg, server]);

  const disableNotifications = useCallback(async () => {
    const sub = await reg?.pushManager?.getSubscription();
    if (sub) {
      await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
    setSubscribed(false);
  }, [reg]);

  const sendTest = useCallback(async () => {
    try {
      const r = await api('/push/test', { method: 'POST' });
      toast.success(`Test sent to ${r.sent} device(s)`);
    } catch (e) {
      toast.error(e.message);
    }
  }, []);

  const install = useCallback(async () => {
    if (installEvent) {
      installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
    } else if (isIOS()) {
      toast('On iPhone: tap the Share button, then “Add to Home Screen”.', { duration: 7000 });
    } else {
      toast('Open the browser menu (⋮) and tap “Install app” or “Add to Home screen”.', { duration: 7000 });
    }
  }, [installEvent]);

  return (
    <Ctx.Provider value={{ subscribed, permission, server, installed: isStandalone(), canInstall: !!installEvent || isIOS(), enableNotifications, disableNotifications, sendTest, install, newOrders, clearNew: () => setNewOrders(0) }}>
      {children}
    </Ctx.Provider>
  );
}

/** Card shown on the dashboard */
export function SellerAppCard() {
  const app = useSellerApp();
  if (!app) return null;
  return (
    <div className="a-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-white">
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 20 L12 4 L21 20 Z M9 20 L12 14 L15 20" fill="currentColor" /></svg>
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold">Seller app on your phone</div>
        <p className="text-xs text-stone-500">
          Get a notification for every order from the website, WhatsApp and Instagram, and manage stock on the go.
          {app.subscribed ? ' Notifications are ON for this device.' : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!app.installed && <button onClick={app.install} className="a-btn-light">Install app</button>}
        {app.subscribed ? (
          <>
            <button onClick={app.sendTest} className="a-btn-light">Send test</button>
            <button onClick={app.disableNotifications} className="a-btn-light">Turn off</button>
          </>
        ) : (
          <button onClick={app.enableNotifications} className="a-btn">🔔 Enable order notifications</button>
        )}
      </div>
    </div>
  );
}
