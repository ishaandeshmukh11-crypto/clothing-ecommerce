import { serverApi } from '@/lib/api';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { inr, waLink } from '@/lib/format';

export const metadata = { title: 'Contact, Shipping & Returns' };

export default async function ContactPage() {
  const s = await serverApi('/settings', DEFAULT_SETTINGS);
  return (
    <div className="container-x max-w-4xl py-16">
      <div className="text-center">
        <div className="eyebrow">Help</div>
        <h1 className="mt-3 text-5xl">We&apos;re here for you</h1>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {[['Call us', s.phone], ['Email', s.email], ['Visit', s.address]].map(([t, v]) => (
          <div key={t} className="border border-sand-dark bg-sand p-6 text-center">
            <div className="text-xs uppercase tracking-widest text-ink-muted">{t}</div>
            <div className="mt-2 font-display text-xl">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <a href={waLink(s.whatsappNumber, `Hi ${s.storeName}!`)} target="_blank" rel="noreferrer" className="btn-whatsapp">Chat on WhatsApp</a>
      </div>

      <div className="mt-20 space-y-12 text-ink-soft">
        <section>
          <h2 className="text-3xl text-ink">Shipping</h2>
          <p className="mt-3 leading-relaxed">
            We deliver {s.deliveryTime}. Retail orders ship for {inr(s.shippingFee)}, and shipping is free on orders above {inr(s.freeShippingAbove)}.
            You&apos;ll receive tracking details on WhatsApp as soon as your parcel is dispatched.
          </p>
          <p className="mt-3 leading-relaxed">{s.wholesaleShippingNote}</p>
        </section>
        <section>
          <h2 className="text-3xl text-ink">Returns & exchange</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed">{s.returnPolicy}</p>
        </section>
      </div>
    </div>
  );
}
