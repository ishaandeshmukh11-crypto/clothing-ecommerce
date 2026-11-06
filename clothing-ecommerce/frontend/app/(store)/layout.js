import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ChatWidget from '@/components/ChatWidget';
import { SettingsProvider } from '@/components/SettingsProvider';
import { serverApi } from '@/lib/api';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

export default async function StoreLayout({ children }) {
  const [settings, categories] = await Promise.all([
    serverApi('/settings', DEFAULT_SETTINGS),
    serverApi('/categories', []),
  ]);

  return (
    <SettingsProvider value={settings}>
      <Header categories={categories} />
      <main className="min-h-[60vh]">{children}</main>
      <Footer categories={categories} />
      <ChatWidget />
    </SettingsProvider>
  );
}
