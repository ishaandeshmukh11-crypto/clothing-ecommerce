'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import { api } from '@/lib/api';
import { buildTree } from '@/lib/categories';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size', '26', '28', '30', '32', '34'];
const PRICES = [
  { label: 'Under ₹999', min: '', max: '999' },
  { label: '₹1,000 – ₹1,999', min: '1000', max: '1999' },
  { label: '₹2,000 – ₹3,999', min: '2000', max: '3999' },
  { label: '₹4,000 & above', min: '4000', max: '' },
];
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Bestselling' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export default function ShopClient() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useMemo(() => Object.fromEntries(params.entries()), [params]);

  useEffect(() => {
    api('/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: '12', ...query }).toString();
    api(`/products?${qs}`)
      .then(setData)
      .catch(() => setData({ items: [], total: 0, page: 1, pages: 0 }))
      .finally(() => setLoading(false));
  }, [query]);

  const update = (patch) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
    setFiltersOpen(false);
  };

  const loadMore = async () => {
    const qs = new URLSearchParams({ limit: '12', ...query, page: String(data.page + 1) }).toString();
    const more = await api(`/products?${qs}`);
    setData((d) => ({ ...more, items: [...d.items, ...more.items] }));
  };

  const tree = buildTree(categories);
  const activeCat = categories.find((c) => c.slug === query.category);
  const parentCat = activeCat?.parent && categories.find((c) => String(c._id) === String(activeCat.parent));
  // Filters like Sleeve / Length / Fit come from the main category
  const attrGroup = parentCat || (activeCat && !activeCat.parent ? activeCat : null);
  const title = query.q ? `Results for “${query.q}”` : activeCat?.name || (query.sale ? 'Sale' : query.newArrival ? 'New Arrivals' : 'All Products');

  const Filters = (
    <div className="space-y-8">
      <div>
        <h4 className="mb-3 text-xs font-medium uppercase tracking-widest">Category</h4>
        <ul className="space-y-2 text-sm">
          <li>
            <button onClick={() => update({ category: '' })} className={!query.category ? 'font-medium text-clay' : 'hover:text-clay'}>All</button>
          </li>
          {tree.map((g) => (
            <li key={g._id}>
              <button onClick={() => update({ category: g.slug })} className={`font-semibold uppercase tracking-wide ${query.category === g.slug ? 'underline underline-offset-4' : 'hover:opacity-60'}`}>
                {g.name} <span className="font-normal text-ink-muted">({g.productCount})</span>
              </button>
              {g.children.length > 0 && (
                <ul className="mb-2 mt-1.5 space-y-1.5 border-l border-sand-dark pl-3">
                  {g.children.map((c) => (
                    <li key={c._id}>
                      <button onClick={() => update({ category: c.slug })} className={query.category === c.slug ? 'font-semibold underline underline-offset-4' : 'text-ink-soft hover:text-ink'}>
                        {c.name} <span className="text-ink-muted">({c.productCount})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="mb-3 text-xs font-medium uppercase tracking-widest">Size</h4>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button key={s} onClick={() => update({ size: query.size === s ? '' : s })}
              className={`min-w-[44px] border px-3 py-2 text-xs ${query.size === s ? 'border-ink bg-ink text-ivory' : 'border-sand-dark hover:border-ink'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      {attrGroup?.attributes?.map((a) => (
        <div key={a.name}>
          <h4 className="mb-3 text-xs font-medium uppercase tracking-widest">{a.name}</h4>
          <div className="flex flex-wrap gap-2">
            {a.options.map((o) => {
              const key = `a_${a.name}`;
              const on = query[key] === o;
              return (
                <button key={o} onClick={() => update({ [key]: on ? '' : o })}
                  className={`border px-3 py-2 text-xs ${on ? 'border-ink bg-ink text-ivory' : 'border-sand-dark hover:border-ink'}`}>
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div>
        <h4 className="mb-3 text-xs font-medium uppercase tracking-widest">Price</h4>
        <ul className="space-y-2 text-sm">
          {PRICES.map((p) => {
            const active = (query.min || '') === p.min && (query.max || '') === p.max;
            return (
              <li key={p.label}>
                <button onClick={() => update(active ? { min: '', max: '' } : { min: p.min, max: p.max })} className={active ? 'font-medium text-clay' : 'hover:text-clay'}>
                  {p.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {Object.keys(query).length > 0 && (
        <button onClick={() => router.push(pathname)} className="text-xs uppercase tracking-widest text-clay link-underline">Clear all filters</button>
      )}
    </div>
  );

  return (
    <div className="container-x py-12">
      <div className="mb-10 border-b border-sand-dark pb-8">
        <div className="eyebrow">{parentCat ? `${parentCat.name} · ` : 'Shop · '}{data.total} products</div>
        <h1 className="section-title mt-3">{title}</h1>
        {activeCat?.description && <p className="mt-3 text-ink-muted">{activeCat.description}</p>}
        {(() => {
          const group = tree.find((g) => g.slug === query.category) || tree.find((g) => parentCat && g._id === parentCat._id);
          if (!group?.children.length) return null;
          return (
            <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto">
              <button onClick={() => update({ category: group.slug })} className={`shrink-0 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider ${query.category === group.slug ? 'border-ink bg-ink text-ivory' : 'border-sand-dark hover:border-ink'}`}>All {group.name}</button>
              {group.children.map((c) => (
                <button key={c._id} onClick={() => update({ category: c.slug })} className={`shrink-0 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider ${query.category === c.slug ? 'border-ink bg-ink text-ivory' : 'border-sand-dark hover:border-ink'}`}>{c.name}</button>
              ))}
            </div>
          );
        })()}
      </div>

      <div className="flex gap-10">
        <aside className="hidden w-56 shrink-0 lg:block">{Filters}</aside>

        <div className="flex-1">
          <div className="mb-6 flex items-center justify-between gap-4">
            <button onClick={() => setFiltersOpen(true)} className="flex items-center gap-2 text-xs uppercase tracking-widest lg:hidden">
              <SlidersHorizontal size={16} /> Filters
            </button>
            <span className="hidden text-sm text-ink-muted lg:block">{data.total} products</span>
            <select value={query.sort || 'newest'} onChange={(e) => update({ sort: e.target.value })} className="border border-sand-dark bg-transparent px-3 py-2 text-sm">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}><div className="aspect-[3/4] animate-pulse bg-sand" /><div className="mt-4 h-4 w-2/3 animate-pulse bg-sand" /></div>
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <div className="py-24 text-center">
              <h3 className="text-2xl">No products found</h3>
              <p className="mt-2 text-ink-muted">Try removing a filter, or ask us on WhatsApp — we may have it in stock.</p>
            </div>
          ) : (
            <>
              <div className="grid-cells grid-cols-2 md:grid-cols-3">
                {data.items.map((p) => <ProductCard key={p._id} product={p} />)}
              </div>
              {data.page < data.pages && (
                <div className="mt-14 text-center">
                  <button onClick={loadMore} className="btn-outline">Load more</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[85%] max-w-sm overflow-y-auto bg-ivory p-6">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-2xl">Filters</h3>
              <button onClick={() => setFiltersOpen(false)}><X size={22} /></button>
            </div>
            {Filters}
          </div>
        </div>
      )}
    </div>
  );
}
