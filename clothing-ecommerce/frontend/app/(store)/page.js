import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import HeroSlider from '@/components/HeroSlider';
import ProductCard from '@/components/ProductCard';
import InstagramStrip from '@/components/InstagramStrip';
import { serverApi, img } from '@/lib/api';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { waLink, inr } from '@/lib/format';
import { buildTree } from '@/lib/categories';

function SectionHead({ title, href, label = 'See all' }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
      <h2 className="section-title">{title}</h2>
      {href && (
        <Link href={href} className="mb-2 flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] hover:opacity-60">
          {label} <ArrowUpRight size={14} />
        </Link>
      )}
    </div>
  );
}

function ProductGrid({ items, href, label }) {
  return (
    <>
      <div className="grid-cells grid-cols-2 md:grid-cols-4">
        {items.map((p) => <ProductCard key={p._id} product={p} />)}
      </div>
      {href && (
        <Link href={href} className="block border-x border-b border-sand-dark py-4 text-center text-[11px] font-semibold uppercase tracking-[0.1em] transition hover:bg-ink hover:text-ivory">
          {label}
        </Link>
      )}
    </>
  );
}

export default async function HomePage() {
  const [settings, categories, featured, latest] = await Promise.all([
    serverApi('/settings', DEFAULT_SETTINGS),
    serverApi('/categories', []),
    serverApi('/products?featured=1&limit=8', { items: [] }),
    serverApi('/products?sort=newest&limit=8', { items: [] }),
  ]);
  const tree = buildTree(categories);
  const promo = settings.heroSlides?.[1]?.image || settings.heroSlides?.[0]?.image;

  return (
    <>
      <HeroSlider slides={settings.heroSlides} storeName={settings.storeName} tagline={settings.tagline} />

      {/* New arrivals */}
      {latest.items?.length > 0 && (
        <section className="container-x pt-16 md:pt-24">
          <SectionHead title="New Arrivals" href="/shop?newArrival=1" />
          <ProductGrid items={latest.items} href="/shop?newArrival=1" label="See all new arrivals" />
        </section>
      )}

      {/* Promo banner — free shipping / wholesale */}
      <section className="container-x pt-16 md:pt-24">
        <div className="relative overflow-hidden bg-ink">
          {promo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img(promo)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-ink/60 to-ink/10" />
          <div className="relative flex min-h-[340px] flex-col justify-between gap-10 p-6 text-ivory md:min-h-[420px] md:p-10">
            <span className="pill w-fit">• Just launched</span>
            <div>
              <div className="display-xl text-5xl md:text-8xl">Free express<br />shipping</div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <p className="max-w-md text-[11px] font-semibold uppercase leading-relaxed tracking-[0.08em] text-ivory/80">
                  On every retail order above {inr(settings.freeShippingAbove)}. Delivery {settings.deliveryTime}.
                </p>
                <Link href="/shop" className="btn bg-ivory px-5 py-3 text-ink hover:bg-white">Shop clothing</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Best sellers */}
      {featured.items?.length > 0 && (
        <section className="container-x pt-16 md:pt-24">
          <SectionHead title="Best Sellers" href="/shop?sort=popular" />
          <ProductGrid items={featured.items} href="/shop?sort=popular" label="See all products" />
        </section>
      )}

      {/* Shop by category — main groups with their sub-categories */}
      {tree.length > 0 && (
        <section className="container-x pt-16 md:pt-24">
          <SectionHead title="Shop by category" href="/shop" label="Shop all" />
          <div className={`grid-cells grid-cols-1 ${tree.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {tree.map((g) => (
              <div key={g._id} className="bg-ivory p-3 md:p-4">
                <Link href={`/shop?category=${g.slug}`} className="group relative block aspect-[4/5] overflow-hidden bg-sand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(g.image)} alt={g.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 md:p-5">
                    <span className="display-xl text-5xl md:text-6xl">{g.name}</span>
                    <span className="pill bg-ink text-ivory">{g.productCount} styles <ArrowUpRight size={12} /></span>
                  </div>
                </Link>
                {g.children.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-3">
                    {g.children.map((c) => (
                      <Link key={c._id} href={`/shop?category=${c.slug}`} className="rounded-full border border-sand-dark px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition hover:border-ink hover:bg-ink hover:text-ivory">
                        {c.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <InstagramStrip />

      {/* Wholesale */}
      <section className="container-x pt-16 md:pt-24">
        <div className="grid border border-sand-dark md:grid-cols-2">
          <div className="p-6 md:p-10">
            <span className="pill bg-ink text-ivory">• For boutiques & resellers</span>
            <h2 className="mt-6 text-5xl md:text-7xl">Wholesale<br />made simple</h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-ink-soft">
              Register once, get approved, and see wholesale prices on every product. Mix sizes freely to meet the minimum
              order and check out online — or send your order on WhatsApp.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              <Link href="/wholesale" className="btn-primary">Register as wholesaler</Link>
              <a href={waLink(settings.whatsappNumber, `Hi ${settings.storeName}, I want wholesale rates and catalogue.`)} target="_blank" rel="noreferrer" className="btn-outline">Ask on WhatsApp</a>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-sand-dark md:grid-cols-1 md:border-l md:border-t-0">
            {[['Low', 'MOQ per style'], ['GST', 'Invoice on all orders'], ['24H', 'Dispatch on stock']].map(([a, b]) => (
              <div key={a} className="flex flex-col justify-center border-r border-sand-dark p-5 last:border-r-0 md:border-b md:border-r-0 md:p-8 md:last:border-b-0">
                <div className="display-xl text-4xl md:text-6xl">{a}</div>
                <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
