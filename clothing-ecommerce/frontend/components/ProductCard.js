'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { img } from '@/lib/api';
import { inr, discountPct } from '@/lib/format';
import { useAuth, useHydrated, isWholesaleUser } from '@/lib/store';

export default function ProductCard({ product }) {
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const wholesale = hydrated && isWholesaleUser(user) && product.wholesalePrice;
  const off = discountPct(product.price, product.mrp);
  const outOfStock = (product.totalStock ?? 1) <= 0;
  const [first, second] = product.images || [];

  return (
    <Link href={`/product/${product.slug}`} className="group block bg-ivory p-3 md:p-4">
      <div className="relative aspect-[4/5] overflow-hidden bg-sand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img(first)} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
        {second && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img(second)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-700 group-hover:opacity-100" />
        )}
        <span className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-ivory/90 text-ink">
          <Heart size={13} strokeWidth={2} />
        </span>
        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1">
          {outOfStock ? (
            <span className="pill bg-ink text-ivory">Sold out</span>
          ) : product.isNewArrival ? (
            <span className="pill">New</span>
          ) : null}
        </div>
      </div>
      <div className="flex items-start justify-between gap-3 pt-3">
        <div className="min-w-0">
          <h3 className="truncate text-[11px] font-bold uppercase tracking-[0.04em]">{product.name}</h3>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[11px] font-medium">
            {wholesale ? (
              <>
                <span>{inr(product.wholesalePrice)}</span>
                <span className="text-ink-muted">wholesale · MOQ {product.moq}</span>
              </>
            ) : (
              <>
                <span>{inr(product.price)}</span>
                {off > 0 && <span className="text-ink-muted line-through">{inr(product.mrp)}</span>}
                {off > 0 && <span className="text-sale">−{off}%</span>}
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
