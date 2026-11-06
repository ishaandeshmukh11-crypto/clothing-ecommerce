import { Suspense } from 'react';
import ShopClient from './ShopClient';

export const metadata = { title: 'Shop' };

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="container-x py-24 text-center text-ink-muted">Loading…</div>}>
      <ShopClient />
    </Suspense>
  );
}
