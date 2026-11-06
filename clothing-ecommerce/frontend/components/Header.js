'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useSettings } from './SettingsProvider';
import { useAuth, useCart, useHydrated, isWholesaleUser } from '@/lib/store';
import { buildTree, categoryHref } from '@/lib/categories';
import { img } from '@/lib/api';

function Logo({ name }) {
  return (
    <span className="flex items-center gap-1.5 text-lg font-extrabold tracking-[-0.03em] md:text-xl">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 20 L12 4 L21 20 Z M9 20 L12 14 L15 20" fill="currentColor" /></svg>
      {name}
    </span>
  );
}

const linkCls = 'whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] hover:opacity-60 transition';

export default function Header({ categories = [] }) {
  const s = useSettings();
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const count = useCart((st) => st.items.reduce((n, i) => n + i.qty, 0));
  const user = useAuth((st) => st.user);
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState(null); // id of the open main category (desktop)
  const [expanded, setExpanded] = useState(null); // mobile accordion
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const tree = buildTree(categories);

  useEffect(() => {
    setOpen(false);
    setSearchOpen(false);
    setMega(null);
  }, [pathname]);

  const submit = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/shop?q=${encodeURIComponent(q.trim())}`);
  };

  const activeGroup = tree.find((g) => g._id === mega);

  return (
    <>
      {s.announcement && (
        <div className="bg-ink py-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-ivory">
          <div className="container-x truncate">• {s.announcement}</div>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-sand-dark bg-ivory/95 backdrop-blur" onMouseLeave={() => setMega(null)}>
        <div className="container-x grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-4 md:h-16">
          <div className="flex items-center gap-6">
            <button className="-ml-2 p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu size={20} strokeWidth={1.75} />
            </button>
            <Link href="/wholesale" className={`${linkCls} hidden lg:inline`}>Wholesale</Link>
            <Link href="/contact" className={`${linkCls} hidden lg:inline`}>Help</Link>
          </div>

          <Link href="/" aria-label="Home"><Logo name={s.storeName} /></Link>

          <div className="flex items-center justify-end gap-0 lg:gap-6">
            {hydrated && isWholesaleUser(user) && (
              <span className="hidden rounded-full border border-ink px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider xl:inline">Wholesale</span>
            )}
            <button onClick={() => setSearchOpen((v) => !v)} className={`${linkCls} hidden lg:inline`}>Search</button>
            <Link href="/account" className={`${linkCls} hidden lg:inline`}>Account</Link>
            <Link href="/cart" className={`${linkCls} hidden lg:inline`}>Cart ({hydrated ? count : 0})</Link>

            <button className="p-2 lg:hidden" onClick={() => setSearchOpen((v) => !v)} aria-label="Search"><Search size={19} strokeWidth={1.75} /></button>
            <Link href="/account" className="p-2 lg:hidden" aria-label="Account"><User size={19} strokeWidth={1.75} /></Link>
            <Link href="/cart" className="relative -mr-2 p-2 lg:hidden" aria-label="Cart">
              <ShoppingBag size={19} strokeWidth={1.75} />
              {hydrated && count > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[9px] font-bold text-ivory">{count}</span>
              )}
            </Link>
          </div>
        </div>

        {/* Desktop category row — fits many categories with the logo centred above */}
        <div className="hidden border-t border-sand-dark/70 lg:block">
            <nav className="container-x hidden h-11 items-center justify-center gap-7 lg:flex">
              <Link href="/shop?newArrival=1" className={`${linkCls} flex h-11 items-center border-b-2 border-transparent`} onMouseEnter={() => setMega(null)}>New In</Link>
              {tree.map((g) => (
                <Link key={g._id} href={categoryHref(g)} onMouseEnter={() => setMega(g.children.length ? g._id : null)}
                  className={`${linkCls} flex h-11 items-center gap-1 border-b-2 ${mega === g._id ? 'border-ink' : 'border-transparent'}`}>
                  {g.name}
                </Link>
              ))}
              <Link href="/shop?sale=1" className={`${linkCls} flex h-11 items-center border-b-2 border-transparent text-sale`} onMouseEnter={() => setMega(null)}>Sale</Link>
            </nav>
        </div>

        {/* Desktop mega menu */}
        {activeGroup && (
          <div className="absolute inset-x-0 top-full hidden border-b border-sand-dark bg-ivory shadow-[0_20px_40px_-20px_rgba(0,0,0,0.15)] lg:block">
            <div className="container-x grid grid-cols-[1fr_1fr_280px] gap-10 py-10">
              <div>
                <div className="eyebrow mb-4">Shop {activeGroup.name}</div>
                <ul className="space-y-2.5">
                  <li><Link href={categoryHref(activeGroup)} className="text-2xl font-extrabold uppercase tracking-[-0.03em] hover:opacity-60">All {activeGroup.name}</Link></li>
                  {activeGroup.children.map((c) => (
                    <li key={c._id}><Link href={categoryHref(c)} className="text-2xl font-extrabold uppercase tracking-[-0.03em] hover:opacity-60">{c.name}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="eyebrow mb-4">Featured</div>
                <ul className="space-y-2 text-sm">
                  <li><Link href={`/shop?category=${activeGroup.slug}&newArrival=1`} className="hover:underline">New arrivals</Link></li>
                  <li><Link href={`/shop?category=${activeGroup.slug}&sort=popular`} className="hover:underline">Bestsellers</Link></li>
                  <li><Link href={`/shop?category=${activeGroup.slug}&sale=1`} className="hover:underline">On sale</Link></li>
                </ul>
              </div>
              <Link href={categoryHref(activeGroup)} className="group block">
                <div className="aspect-[4/5] overflow-hidden bg-sand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(activeGroup.image)} alt={activeGroup.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
                </div>
                <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.04em]">{activeGroup.name} · {activeGroup.productCount} styles</div>
              </Link>
            </div>
          </div>
        )}

        {searchOpen && (
          <div className="border-t border-sand-dark bg-ivory py-4 animate-fadeUp">
            <form onSubmit={submit} className="container-x flex gap-2">
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tops, dresses, Korean pants, denims…" className="input" />
              <button className="btn-primary">Search</button>
            </form>
          </div>
        )}
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto bg-ivory p-6 animate-fadeUp">
            <div className="mb-8 flex items-center justify-between">
              <Logo name={s.storeName} />
              <button onClick={() => setOpen(false)} aria-label="Close menu"><X size={22} /></button>
            </div>
            <ul>
              <li><Link href="/shop?newArrival=1" className="block border-b border-sand-dark py-3 text-2xl font-extrabold uppercase tracking-[-0.03em]">New In</Link></li>
              {tree.map((g) => (
                <li key={g._id} className="border-b border-sand-dark">
                  <button onClick={() => setExpanded(expanded === g._id ? null : g._id)} className="flex w-full items-center justify-between py-3 text-2xl font-extrabold uppercase tracking-[-0.03em]">
                    {g.name}
                    {g.children.length > 0 && <ChevronDown size={20} className={`transition ${expanded === g._id ? 'rotate-180' : ''}`} />}
                  </button>
                  {expanded === g._id && (
                    <ul className="space-y-2.5 pb-4 pl-1">
                      <li><Link href={categoryHref(g)} className="text-sm font-semibold uppercase tracking-wider">All {g.name}</Link></li>
                      {g.children.map((c) => (
                        <li key={c._id}><Link href={categoryHref(c)} className="text-sm uppercase tracking-wider text-ink-soft">{c.name}</Link></li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
              {[{ href: '/shop?sale=1', label: 'Sale' }, { href: '/wholesale', label: 'Wholesale' }, { href: '/account', label: 'My account' }, { href: '/contact', label: 'Contact' }].map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className={`block border-b border-sand-dark py-3 text-2xl font-extrabold uppercase tracking-[-0.03em] ${n.label === 'Sale' ? 'text-sale' : ''}`}>{n.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
