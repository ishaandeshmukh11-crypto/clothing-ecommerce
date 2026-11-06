import { serverApi } from '@/lib/api';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

export const dynamic = 'force-dynamic';

// Web-app manifest for the installable seller app (admin panel on the phone home screen)
export async function GET() {
  const s = await serverApi('/settings', DEFAULT_SETTINGS);
  const manifest = {
    name: `${s.storeName} Seller`,
    short_name: String(s.storeName).slice(0, 12),
    description: 'Orders, inventory and notifications for your store',
    id: '/admin',
    start_url: '/admin',
    scope: '/admin',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#111111',
    theme_color: '#111111',
    icons: [
      { src: '/icons/seller-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/seller-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/seller-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Orders', url: '/admin/orders', icons: [{ src: '/icons/seller-192.png', sizes: '192x192' }] },
      { name: 'Inventory', url: '/admin/inventory', icons: [{ src: '/icons/seller-192.png', sizes: '192x192' }] },
      { name: 'Bulk upload', url: '/admin/bulk', icons: [{ src: '/icons/seller-192.png', sizes: '192x192' }] },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' } });
}
