'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/admin/ui';
import { api, API_URL } from '@/lib/api';

function Qr({ text }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    import('qrcode').then((QR) => QR.toDataURL(text, { margin: 1, width: 360 })).then(setSrc).catch(() => {});
  }, [text]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="QR code" className="h-36 w-36 rounded-lg border border-stone-200" />
  ) : <div className="h-36 w-36 rounded-lg bg-stone-100" />;
}

function LinkRow({ title, desc, url, qr }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed — long-press the link to copy');
    }
  };
  return (
    <div className="a-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-1 text-xs text-stone-500">{desc}</p>
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-stone-100 px-3 py-2 text-xs">{url}</code>
          <button onClick={copy} className="a-btn-light px-3"><Copy size={14} /></button>
          <a href={url} target="_blank" rel="noreferrer" className="a-btn-light px-3"><ExternalLink size={14} /></a>
        </div>
      </div>
      {qr && <Qr text={url} />}
    </div>
  );
}

const Status = ({ ok, label }) => (
  <div className="flex items-center gap-2 text-sm">{ok ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-stone-400" />}<span className={ok ? '' : 'text-stone-500'}>{label}</span></div>
);

export default function Channels() {
  const [s, setS] = useState(null);
  const [site, setSite] = useState('');
  useEffect(() => {
    setSite(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin);
    api('/settings').then(setS).catch((e) => toast.error(e.message));
  }, []);
  if (!s) return <div className="text-sm text-stone-500">Loading…</div>;

  const waShop = `https://wa.me/${s.whatsappNumber}?text=${encodeURIComponent("Hi! I'd like to shop 🛍️")}`;

  return (
    <>
      <PageHeader title="Instagram, WhatsApp & website" subtitle="One set of links that connects all your channels. Every order shows which channel it came from." />

      <div className="space-y-4">
        <LinkRow title="📸 Instagram bio link" desc="Put this in your Instagram bio. Customers see your categories, WhatsApp shopping and website in one tap — orders are tagged “Instagram”." url={`${site}/links`} qr />
        <LinkRow title="💬 Shop on WhatsApp" desc="Opens WhatsApp and starts the shopping menu (categories → product → size → checkout). Use it in Instagram stories, status, flyers or print the QR at your shop." url={waShop} qr />
        <LinkRow title="🌐 Website (for Instagram posts & ads)" desc="Use this link in Instagram stories, posts and ads so orders are counted as Instagram." url={`${site}/?src=instagram`} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="a-card space-y-3 p-5">
          <div className="text-sm font-semibold">Connections</div>
          <Status ok={s.whatsappApiConnected} label="WhatsApp Business API — shopping & auto replies" />
          <Status ok={s.instagramConnected} label="Instagram — DM auto replies & feed on website" />
          <Status ok={s.razorpayEnabled} label="Razorpay — online payment & WhatsApp payment links" />
          <Status ok={s.pushEnabled} label="Seller app notifications" />
          <Status ok={!!s.instagram} label={s.instagram ? `Instagram profile: ${s.instagram}` : 'Instagram profile link (add it in Store settings)'} />
        </div>
        <div className="a-card p-5 text-xs leading-relaxed text-stone-600">
          <div className="mb-2 text-sm font-semibold text-stone-900">How it all connects</div>
          <ul className="list-disc space-y-1.5 pl-4">
            <li><b>Instagram →</b> bio link and story links open your store or WhatsApp shop. DMs get instant replies with products and links.</li>
            <li><b>WhatsApp →</b> customers browse, pick size, and check out inside WhatsApp. Product messages include the website link.</li>
            <li><b>Website →</b> every page has “Order on WhatsApp” and “Share” buttons; the chat assistant hands off to WhatsApp.</li>
            <li><b>Seller app →</b> every order from all three lands in the same Orders list and pings your phone.</li>
          </ul>
          <div className="mt-3 rounded-lg bg-stone-50 p-3">Webhook for WhatsApp & Instagram (Meta developer console):<div className="mt-1 break-all font-mono text-stone-800">{API_URL}/api/whatsapp/webhook</div></div>
        </div>
      </div>
    </>
  );
}
