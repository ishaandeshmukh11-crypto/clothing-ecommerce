import '@fontsource-variable/inter-tight';
import './globals.css';
import Providers from '@/components/Providers';
import { serverApi } from '@/lib/api';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const s = await serverApi('/settings', DEFAULT_SETTINGS);
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: { default: `${s.storeName} — ${s.tagline}`, template: `%s | ${s.storeName}` },
    description: `${s.tagline}. Shop retail or buy wholesale online. Order easily on WhatsApp.`,
    openGraph: { siteName: s.storeName, type: 'website' },
  };
}

export const viewport = { themeColor: '#ffffff' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
