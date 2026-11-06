'use client';

import { useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from './store';

/** Asks the server to price the cart (wholesale/retail prices, MOQ, stock, coupon, shipping). */
export function useQuote(items, couponCode) {
  const token = useAuth((s) => s.token);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const payload = JSON.stringify(items.map(({ productId, size, color, qty }) => ({ productId, size, color, qty })));

  useEffect(() => {
    if (!items.length) {
      setQuote(null);
      setError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      api('/orders/quote', { method: 'POST', body: { items: JSON.parse(payload), couponCode: couponCode || undefined } })
        .then((q) => !cancelled && (setQuote(q), setError('')))
        .catch((e) => !cancelled && (setError(e.message), setQuote(null)))
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [payload, couponCode, token]); // eslint-disable-line react-hooks/exhaustive-deps

  return { quote, error, loading };
}
