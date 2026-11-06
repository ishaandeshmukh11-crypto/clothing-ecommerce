'use client';

import { useEffect, useState } from 'react';
import { Instagram } from 'lucide-react';
import { api } from '@/lib/api';
import { useSettings } from './SettingsProvider';
import { waLink } from '@/lib/format';

// Latest Instagram posts (when connected) + one-tap links between Instagram, WhatsApp and the store
export default function InstagramStrip() {
  const s = useSettings();
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    api('/social/instagram').then((d) => setPosts(d.posts || [])).catch(() => {});
  }, []);
  const handle = s.instagram ? `@${s.instagram.replace(/\/$/, '').split('/').pop()}` : '';

  return (
    <section className="container-x pt-16 md:pt-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <h2 className="section-title">{posts.length ? 'On Instagram' : 'Shop your way'}</h2>
        <div className="flex flex-wrap gap-2">
          {s.instagram && <a href={s.instagram} target="_blank" rel="noreferrer" className="btn-outline btn-sm"><Instagram size={14} /> {handle || 'Follow us'}</a>}
          <a href={waLink(s.whatsappNumber, "Hi! I'd like to shop 🛍️")} target="_blank" rel="noreferrer" className="btn-whatsapp btn-sm">Shop on WhatsApp</a>
        </div>
      </div>
      {posts.length > 0 ? (
        <div className="grid grid-cols-3 gap-1 md:grid-cols-6">
          {posts.slice(0, 6).map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="group relative aspect-square overflow-hidden bg-sand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt={p.caption || ''} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            </a>
          ))}
        </div>
      ) : (
        <div className="grid-cells grid-cols-1 md:grid-cols-3">
          {[
            ['01', 'Browse here', 'Filter by type, sleeve, length and fit — then check out in seconds.'],
            ['02', 'Order on WhatsApp', 'Send “Hi” to see categories, pick your size and order right inside WhatsApp.'],
            ['03', 'Find us on Instagram', 'New drops every week. DM us any style and we reply instantly.'],
          ].map(([n, t, d]) => (
            <div key={n} className="bg-ivory p-6 md:p-8">
              <div className="display-xl text-5xl text-sand-dark">{n}</div>
              <div className="mt-4 text-[13px] font-bold uppercase tracking-[0.06em]">{t}</div>
              <p className="mt-2 text-sm text-ink-soft">{d}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
