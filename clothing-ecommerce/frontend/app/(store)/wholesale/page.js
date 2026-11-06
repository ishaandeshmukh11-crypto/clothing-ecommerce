'use client';

import Link from 'next/link';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { BadgePercent, Boxes, FileText, Truck, MessageCircle, Shuffle } from 'lucide-react';
import AuthForm from '@/components/AuthForm';
import { useSettings } from '@/components/SettingsProvider';
import { api } from '@/lib/api';
import { waLink, STATUS_STYLES } from '@/lib/format';
import { useAuth, useHydrated } from '@/lib/store';

const PERKS = [
  { icon: BadgePercent, title: 'Wholesale prices', text: 'Special rates on every style, visible once your account is approved.' },
  { icon: Shuffle, title: 'Mix sizes freely', text: 'Minimum order is per style — combine any sizes to meet it.' },
  { icon: Boxes, title: 'Fresh stock weekly', text: 'New designs added every week, straight from our production.' },
  { icon: FileText, title: 'GST invoice', text: 'Proper GST billing for your business on every order.' },
  { icon: Truck, title: 'Pan-India dispatch', text: 'Fast dispatch via trusted transport and courier partners.' },
  { icon: MessageCircle, title: 'WhatsApp support', text: 'Catalogues, videos and order help directly on WhatsApp.' },
];

export default function WholesalePage() {
  const s = useSettings();
  const hydrated = useHydrated();
  const { user, setUser } = useAuth();
  const [biz, setBiz] = useState({ businessName: '', gstin: '' });

  const apply = async (e) => {
    e.preventDefault();
    try {
      const d = await api('/auth/me', { method: 'PUT', body: { ...biz, applyWholesale: true } });
      setUser(d.user);
      toast.success('Application received!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <section className="bg-ink py-20 text-ivory">
        <div className="container-x max-w-3xl text-center">
          <div className="eyebrow text-gold">Wholesale & reseller programme</div>
          <h1 className="mt-4 text-5xl leading-tight md:text-6xl">Grow your boutique with {s.storeName}</h1>
          <p className="mx-auto mt-6 max-w-xl text-ivory/70">
            Register in a minute. Once approved, you&apos;ll see wholesale prices and minimum order quantities on every product and can order online or on WhatsApp.
          </p>
        </div>
      </section>

      <section className="container-x grid gap-16 py-20 lg:grid-cols-2">
        <div>
          <h2 className="text-4xl">Why buy from us</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {PERKS.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <Icon size={26} strokeWidth={1.25} className="text-clay" />
                <h3 className="mt-3 text-xl">{title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 border-l-2 border-gold pl-5">
            <h3 className="text-xl">How it works</h3>
            <ol className="mt-3 list-decimal space-y-1 pl-4 text-sm text-ink-soft">
              <li>Fill the wholesale form</li>
              <li>We verify and approve your account (usually same day)</li>
              <li>Log in — wholesale prices and MOQ appear on every product</li>
              <li>Add pieces to your bag and check out, or confirm on WhatsApp</li>
            </ol>
          </div>
          <a href={waLink(s.whatsappNumber, `Hi ${s.storeName}, I'm interested in wholesale. Please share details.`)} target="_blank" rel="noreferrer" className="btn-whatsapp mt-10">
            Talk to our wholesale team
          </a>
        </div>

        <div className="h-fit border border-sand-dark bg-sand p-8 md:p-10">
          {!hydrated ? null : !user ? (
            <>
              <h2 className="mb-6 text-3xl">Wholesale registration</h2>
              <AuthForm wholesaleOnly />
            </>
          ) : user.role === 'wholesale' ? (
            <div className="text-center">
              <h2 className="text-3xl">Your wholesale account</h2>
              <div className="mt-4"><span className={`badge text-sm ${STATUS_STYLES[user.wholesaleStatus]}`}>{user.wholesaleStatus}</span></div>
              <p className="mt-4 text-sm text-ink-muted">
                {user.wholesaleStatus === 'approved'
                  ? 'You are approved. Wholesale prices are now shown across the store.'
                  : user.wholesaleStatus === 'pending'
                    ? 'Thanks for applying! We are reviewing your details and will approve your account shortly.'
                    : 'Your application was not approved. Please contact us on WhatsApp for help.'}
              </p>
              {user.wholesaleStatus === 'approved' && <Link href="/shop" className="btn-primary mt-6">Start ordering</Link>}
            </div>
          ) : user.role === 'customer' ? (
            <form onSubmit={apply} className="space-y-4">
              <h2 className="text-3xl">Upgrade to wholesale</h2>
              <p className="text-sm text-ink-muted">You&apos;re logged in as {user.email}. Add your business details to apply.</p>
              <div><label className="label">Business / shop name</label><input required value={biz.businessName} onChange={(e) => setBiz({ ...biz, businessName: e.target.value })} className="input" /></div>
              <div><label className="label">GSTIN (optional)</label><input value={biz.gstin} onChange={(e) => setBiz({ ...biz, gstin: e.target.value })} className="input uppercase" /></div>
              <button className="btn-primary w-full">Apply for wholesale</button>
            </form>
          ) : (
            <p className="text-sm text-ink-muted">You are logged in as admin.</p>
          )}
        </div>
      </section>
    </>
  );
}
