// Makes the admin panel installable as the "Seller app" on Android & iPhone
export const metadata = {
  title: 'Seller',
  manifest: '/seller-manifest',
  appleWebApp: { capable: true, title: 'Seller', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/apple-touch-icon.png', icon: '/icons/seller-192.png' },
};

export const viewport = { themeColor: '#111111', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function AdminRootLayout({ children }) {
  return children;
}
