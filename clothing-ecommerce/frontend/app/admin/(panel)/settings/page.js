'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader, ImageUploader, Toggle } from '@/components/admin/ui';
import { api } from '@/lib/api';

function Section({ title, desc, children }) {
  return (
    <section className="a-card grid gap-6 p-5 md:grid-cols-3">
      <div><div className="text-sm font-medium">{title}</div>{desc && <p className="mt-1 text-xs text-stone-500">{desc}</p>}</div>
      <div className="space-y-4 md:col-span-2">{children}</div>
    </section>
  );
}

export default function SettingsAdmin() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api('/settings').then(setS).catch((e) => toast.error(e.message)); }, []);

  if (!s) return <div className="text-sm text-stone-500">Loading…</div>;
  const f = (k, num) => (e) => setS({ ...s, [k]: num ? Number(e.target.value) : e.target.value });
  const setSlide = (i, k, v) => setS({ ...s, heroSlides: s.heroSlides.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });

  const save = async () => {
    setSaving(true);
    try {
      const d = await api('/settings', { method: 'PUT', body: s });
      setS(d);
      toast.success('Settings saved');
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Store settings" subtitle="Changes appear on the website immediately">
        <button onClick={save} disabled={saving} className="a-btn">{saving ? 'Saving…' : 'Save settings'}</button>
      </PageHeader>

      <div className="space-y-6">
        <Section title="Brand" desc="Store name, tagline and the strip at the very top of the site.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="a-label">Store name</label><input value={s.storeName} onChange={f('storeName')} className="a-input" /></div>
            <div><label className="a-label">Tagline</label><input value={s.tagline} onChange={f('tagline')} className="a-input" /></div>
          </div>
          <div><label className="a-label">Announcement bar</label><input value={s.announcement} onChange={f('announcement')} className="a-input" /></div>
        </Section>

        <Section title="Home page banners" desc="Large slides at the top of the home page. Use wide photos (1600×1000 or bigger).">
          {s.heroSlides.map((sl, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-stone-200 p-4">
              <div className="flex items-center justify-between"><span className="text-xs font-medium text-stone-500">Slide {i + 1}</span>
                <button onClick={() => setS({ ...s, heroSlides: s.heroSlides.filter((_, j) => j !== i) })} className="text-red-500"><Trash2 size={16} /></button></div>
              <ImageUploader single value={sl.image ? [sl.image] : []} onChange={(v) => setSlide(i, 'image', v[0] || '')} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="a-label">Small heading</label><input value={sl.eyebrow || ''} onChange={(e) => setSlide(i, 'eyebrow', e.target.value)} className="a-input" /></div>
                <div><label className="a-label">Title</label><input value={sl.title || ''} onChange={(e) => setSlide(i, 'title', e.target.value)} className="a-input" /></div>
                <div className="sm:col-span-2"><label className="a-label">Subtitle</label><input value={sl.subtitle || ''} onChange={(e) => setSlide(i, 'subtitle', e.target.value)} className="a-input" /></div>
                <div><label className="a-label">Button text</label><input value={sl.ctaLabel || ''} onChange={(e) => setSlide(i, 'ctaLabel', e.target.value)} className="a-input" /></div>
                <div><label className="a-label">Button link</label><input value={sl.ctaLink || ''} onChange={(e) => setSlide(i, 'ctaLink', e.target.value)} className="a-input" placeholder="/shop?category=dresses" /></div>
              </div>
            </div>
          ))}
          <button onClick={() => setS({ ...s, heroSlides: [...s.heroSlides, { title: '', ctaLabel: 'Shop now', ctaLink: '/shop' }] })} className="a-btn-light"><Plus size={16} /> Add slide</button>
        </Section>

        <Section title="Contact & social" desc="WhatsApp number receives all chat and order messages.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="a-label">WhatsApp number (with country code)</label><input value={s.whatsappNumber} onChange={f('whatsappNumber')} className="a-input" placeholder="919876543210" /></div>
            <div><label className="a-label">Phone (display)</label><input value={s.phone} onChange={f('phone')} className="a-input" /></div>
            <div><label className="a-label">Email</label><input value={s.email} onChange={f('email')} className="a-input" /></div>
            <div><label className="a-label">Address</label><input value={s.address} onChange={f('address')} className="a-input" /></div>
            <div><label className="a-label">Instagram URL</label><input value={s.instagram} onChange={f('instagram')} className="a-input" /></div>
            <div><label className="a-label">Facebook URL</label><input value={s.facebook} onChange={f('facebook')} className="a-input" /></div>
          </div>
        </Section>

        <Section title="Shipping & policies" desc="Also used by the chatbot to answer customers.">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="a-label">Retail shipping fee (₹)</label><input type="number" value={s.shippingFee} onChange={f('shippingFee', true)} className="a-input" /></div>
            <div><label className="a-label">Free shipping above (₹)</label><input type="number" value={s.freeShippingAbove} onChange={f('freeShippingAbove', true)} className="a-input" /></div>
            <div><label className="a-label">Min wholesale order (₹)</label><input type="number" value={s.wholesaleMinOrderValue} onChange={f('wholesaleMinOrderValue', true)} className="a-input" /></div>
          </div>
          <div><label className="a-label">Delivery time</label><input value={s.deliveryTime} onChange={f('deliveryTime')} className="a-input" /></div>
          <div><label className="a-label">Wholesale shipping note</label><input value={s.wholesaleShippingNote} onChange={f('wholesaleShippingNote')} className="a-input" /></div>
          <div><label className="a-label">Return / exchange policy</label><textarea rows={3} value={s.returnPolicy} onChange={f('returnPolicy')} className="a-input" /></div>
        </Section>

        <Section title="Payments" desc="Online payment turns on automatically when Razorpay keys are added on the server.">
          <Toggle checked={s.codEnabled} onChange={(v) => setS({ ...s, codEnabled: v })} label="Cash on delivery (retail orders)" />
          <Toggle checked={s.whatsappOrderEnabled} onChange={(v) => setS({ ...s, whatsappOrderEnabled: v })} label="Allow “Confirm order on WhatsApp”" />
          <div className="text-sm text-stone-600">Razorpay online payment: <span className={`badge ${s.razorpayEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>{s.razorpayEnabled ? 'Connected' : 'Not configured'}</span></div>
        </Section>
      </div>

      <div className="mt-6 flex justify-end"><button onClick={save} disabled={saving} className="a-btn">{saving ? 'Saving…' : 'Save settings'}</button></div>
    </>
  );
}
