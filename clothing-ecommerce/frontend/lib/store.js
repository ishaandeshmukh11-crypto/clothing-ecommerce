'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect, useState } from 'react';

export const isWholesaleUser = (user) => user?.role === 'wholesale' && user?.wholesaleStatus === 'approved';

export const useAuth = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: ({ token, user }) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'store-auth' }
  )
);

const lineKey = (productId, size, color) => `${productId}|${size || ''}|${color || ''}`;

export const useCart = create(
  persist(
    (set, get) => ({
      items: [], // { key, productId, slug, name, image, size, color, qty, price, wholesalePrice, moq }
      couponCode: '',
      add: (item) => {
        const key = lineKey(item.productId, item.size, item.color);
        const items = [...get().items];
        const existing = items.find((i) => i.key === key);
        if (existing) existing.qty += item.qty;
        else items.push({ ...item, key });
        set({ items });
      },
      setQty: (key, qty) =>
        set({ items: get().items.map((i) => (i.key === key ? { ...i, qty: Math.max(1, qty) } : i)) }),
      remove: (key) => set({ items: get().items.filter((i) => i.key !== key) }),
      clear: () => set({ items: [], couponCode: '' }),
      setCoupon: (couponCode) => set({ couponCode }),
    }),
    { name: 'store-cart' }
  )
);

/** Avoids hydration mismatch for values read from localStorage */
export function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
