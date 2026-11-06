export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const SERVER_API_URL = (process.env.API_URL_INTERNAL || API_URL).replace(/\/$/, '');

function getToken() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('store-auth') || '{}')?.state?.token || null;
  } catch {
    return null;
  }
}

/**
 * Browser-side API call. Automatically sends the login token.
 * Throws an Error with a friendly `message` on failure.
 */
export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !form) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Something went wrong. Please try again.');
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Server-side fetch for Server Components. Returns `fallback` if the API is unreachable. */
export async function serverApi(path, fallback = null) {
  try {
    const res = await fetch(`${SERVER_API_URL}/api${path}`, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

/** Turns stored image paths (e.g. /uploads/x.jpg) into full URLs */
export function img(src) {
  if (!src) return '/placeholder.svg';
  if (/^(https?:|data:|blob:)/.test(src)) return src;
  return `${API_URL}${src.startsWith('/') ? '' : '/'}${src}`;
}
