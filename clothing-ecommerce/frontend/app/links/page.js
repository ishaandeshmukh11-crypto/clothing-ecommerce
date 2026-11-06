import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { serverApi, img } from '@/lib/api';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { buildTree } from '@/lib/categories';
import { waLink } from '@/lib/format';

export const metadata = { title: 'Links' };

// "Link in bio" page for Instagram — every link is tagged so orders count as Instagram
export default async function LinksPage() {
  const [s, categories, ig] = await Promise.all([
    serverApi('/settings', DEFAULT_SETTINGS),
    serverApi('/categories', []),
    serverApi('/social/instagram', { posts: [] }),
  ]);
  const tree = buildTree(categories);
  const tag = (path) => `${path}${path.includes('?') ? '&' : '?'}src=instagram`;
  const btn = 'flex items-center justify-between border border-ink px-5 py-4 text-[13px] font-bold uppercase tracking-[0.06em] transition hover:bg-ink hover:text-ivory';

  return (
    <main className="mx-auto min-h-screen max-w-md bg-ivory px-5 py-10">
      <div className="text-center">
        <div className="display-xl text-6xl">{s.storeName}</div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{s.tagline}</p>
      </div>

      <div className="mt-8 space-y-2.5">
        <a href={waLink(s.whatsappNumber, "Hi! I'd like to shop 🛍️")} className="flex items-center justify-between bg-whatsapp px-5 py-4 text-[13px] font-bold uppercase tracking-[0.06em] text-white">
          💬 Shop on WhatsApp <ArrowUpRight size={16} />
        </a>
        <Link href={tag('/shop?newArrival=1')} className={`${btn} bg-ink text-ivory`}>New arrivals <ArrowUpRight size={16} /></Link>
        {tree.map((g) => (
          <Link key={g._id} href={tag(`/shop?category=${g.slug}`)} className={btn}>{g.name} <ArrowUpRight size={16} /></Link>
        ))}
        <Link href={tag('/shop?sale=1')} className={`${btn} text-sale`}>Sale <ArrowUpRight size={16} /></Link>
        <Link href={tag('/')} className={btn}>Visit website <ArrowUpRight size={16} /></Link>
        <Link href={tag('/wholesale')} className={btn}>Wholesale enquiry <ArrowUpRight size={16} /></Link>
      </div>

      {ig.posts?.length > 0 && (
        <div className="mt-10">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em]">Latest on Instagram</div>
          <div className="grid grid-cols-3 gap-1">
            {ig.posts.slice(0, 9).map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden bg-sand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{s.phone} · {s.address}</p>
    </main>
  );
}
