'use client';

import Link from 'next/link';
import { useSettings } from './SettingsProvider';
import { waLink } from '@/lib/format';
import { buildTree } from '@/lib/categories';

export default function Footer({ categories = [] }) {
  const s = useSettings();
  const tree = buildTree(categories);
  const col = 'mb-4 text-[11px] font-bold uppercase tracking-[0.1em]';
  const link = 'text-[13px] text-ink-soft hover:text-ink';
  return (
    <footer className="mt-24 border-t border-sand-dark">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div>
          <div className={col}>Shop</div>
          <ul className="space-y-2">
            <li><Link href="/shop" className={link}>All products</Link></li>
            <li><Link href="/shop?newArrival=1" className={link}>New arrivals</Link></li>
            {tree.map((c) => <li key={c._id}><Link href={`/shop?category=${c.slug}`} className={link}>{c.name}</Link></li>)}
            <li><Link href="/shop?sale=1" className={link}>Sale</Link></li>
          </ul>
        </div>
        <div>
          <div className={col}>Help</div>
          <ul className="space-y-2">
            <li><Link href="/wholesale" className={link}>Wholesale / Reseller</Link></li>
            <li><Link href="/account" className={link}>My account & orders</Link></li>
            <li><Link href="/contact" className={link}>Shipping & returns</Link></li>
            <li><Link href="/contact" className={link}>Contact us</Link></li>
          </ul>
        </div>
        <div>
          <div className={col}>Visit</div>
          <ul className="space-y-2 text-[13px] text-ink-soft">
            <li>{s.address}</li>
            <li>{s.phone}</li>
            <li>{s.email}</li>
            {s.instagram && <li><a href={s.instagram} target="_blank" rel="noreferrer" className={link}>Instagram ↗</a></li>}
            {s.facebook && <li><a href={s.facebook} target="_blank" rel="noreferrer" className={link}>Facebook ↗</a></li>}
          </ul>
        </div>
        <div>
          <div className={col}>Catalogue on WhatsApp</div>
          <p className="text-[13px] text-ink-soft">Get the latest designs, videos and wholesale rates straight on WhatsApp.</p>
          <a href={waLink(s.whatsappNumber, `Hi ${s.storeName}, please share your latest catalogue.`)} target="_blank" rel="noreferrer" className="btn-primary mt-4">Chat on WhatsApp</a>
        </div>
      </div>
      <div className="container-x overflow-hidden">
        <div className="display-xl select-none text-center text-[22vw] leading-[0.8] text-ink lg:text-[230px]">{s.storeName}</div>
      </div>
      <div className="container-x flex flex-wrap justify-between gap-2 border-t border-sand-dark py-5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
        <span>© {new Date().getFullYear()} {s.storeName}</span>
        <span>{s.tagline}</span>
      </div>
    </footer>
  );
}
