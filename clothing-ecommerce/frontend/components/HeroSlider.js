'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { img } from '@/lib/api';

export default function HeroSlider({ slides = [], storeName, tagline }) {
  const list = slides.length
    ? slides
    : [{ title: tagline || 'Clothing for every occasion', subtitle: `Discover the latest from ${storeName}.`, ctaLabel: 'Shop now', ctaLink: '/shop' }];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), 6000);
    return () => clearInterval(t);
  }, [list.length]);

  const s = list[i];

  return (
    <section className="relative h-[82vh] min-h-[540px] overflow-hidden bg-sand">
      {list.map((sl, idx) => (
        <div key={idx} className={`absolute inset-0 transition-opacity duration-1000 ${idx === i ? 'opacity-100' : 'opacity-0'}`}>
          {sl.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img(sl.image)} alt="" className={`h-full w-full object-cover transition-transform duration-[7000ms] ${idx === i ? 'scale-105' : 'scale-100'}`} />
          )}
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/5 via-transparent to-ink/40" />

      {/* Giant wordmark, StyleU-style */}
      <div className="pointer-events-none absolute inset-x-0 top-[8%] select-none text-center">
        <div className="display-xl text-[26vw] text-ivory/85 mix-blend-normal md:text-[21vw]" style={{ textShadow: '0 2px 30px rgba(0,0,0,.08)' }}>
          {storeName}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 pb-10 md:pb-14">
        <div className="container-x flex flex-col items-center text-center text-ivory">
          {s.eyebrow && <span className="pill mb-4">{s.eyebrow}</span>}
          <h1 key={i} className="max-w-3xl text-3xl animate-fadeUp md:text-5xl">{s.title}</h1>
          {s.subtitle && <p className="mt-3 max-w-md text-[11px] font-semibold uppercase leading-relaxed tracking-[0.08em] text-ivory/85">{s.subtitle}</p>}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href={s.ctaLink || '/shop'} className="btn bg-ivory text-ink hover:bg-white">{s.ctaLabel || 'Shop now'}</Link>
          </div>
          {list.length > 1 && (
            <div className="mt-8 flex gap-2">
              {list.map((_, idx) => (
                <button key={idx} onClick={() => setI(idx)} aria-label={`Slide ${idx + 1}`} className={`h-[3px] transition-all ${idx === i ? 'w-10 bg-ivory' : 'w-5 bg-ivory/40'}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
