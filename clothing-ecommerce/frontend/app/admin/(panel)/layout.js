'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShoppingCart, Shirt, FolderTree, Users, TicketPercent, Bot, Settings, ExternalLink, LogOut, Menu, X, Boxes, Upload, Link2 } from 'lucide-react';
import { SellerAppProvider, useSellerApp } from '@/components/admin/SellerApp';
import { useAuth, useHydrated } from '@/lib/store';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { href: '/admin/products', label: 'Products', icon: Shirt },
  { href: '/admin/bulk', label: 'Bulk upload', icon: Upload },
  { href: '/admin/categories', label: 'Categories', icon: FolderTree },
  { href: '/admin/customers', label: 'Customers & Wholesale', icon: Users },
  { href: '/admin/coupons', label: 'Coupons', icon: TicketPercent },
  { href: '/admin/chatbot', label: 'Chatbot & WhatsApp', icon: Bot },
  { href: '/admin/channels', label: 'Instagram & links', icon: Link2 },
  { href: '/admin/settings', label: 'Store settings', icon: Settings },
];

const TABS = [
  { href: '/admin', label: 'Home', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/inventory', label: 'Stock', icon: Boxes },
  { href: '/admin/bulk', label: 'Upload', icon: Upload },
];

function OrdersBadge() {
  const app = useSellerApp();
  if (!app?.newOrders) return null;
  return <span className="ml-auto rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">{app.newOrders}</span>;
}

export default function AdminLayout({ children }) {
  return (
    <SellerAppProvider>
      <AdminShell>{children}</AdminShell>
    </SellerAppProvider>
  );
}

function AdminShell({ children }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hydrated && user?.role !== 'admin') router.replace('/admin/login');
  }, [hydrated, user, router]);
  useEffect(() => setOpen(false), [pathname]);

  if (!hydrated || user?.role !== 'admin') {
    return <div className="flex min-h-screen items-center justify-center bg-stone-100 text-sm text-stone-500">Loading…</div>;
  }

  const isActive = (href) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <div className="text-xs font-medium uppercase tracking-widest text-stone-400">Admin panel</div>
        <div className="mt-1 text-sm text-stone-300">{user.name}</div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-normal transition ${isActive(href) ? 'bg-white/10 text-white' : 'text-stone-400 hover:bg-white/5 hover:text-white'}`}>
            <Icon size={18} strokeWidth={1.75} /> {label}
            {href === '/admin/orders' && <OrdersBadge />}
          </Link>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-white/10 p-3">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-400 hover:text-white">
          <ExternalLink size={18} strokeWidth={1.75} /> View store
        </Link>
        <button onClick={() => { logout(); router.replace('/admin/login'); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-400 hover:text-white">
          <LogOut size={18} strokeWidth={1.75} /> Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-stone-800">
      <aside className="fixed inset-y-0 left-0 hidden w-60 bg-stone-900 lg:block">{Sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-stone-900">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 text-stone-400"><X size={20} /></button>
            {Sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-stone-200 bg-white px-4 lg:hidden">
          <button onClick={() => setOpen(true)}><Menu size={22} /></button>
          <span className="text-sm font-medium">Seller</span>
        </header>
        <main className="mx-auto max-w-7xl p-4 pb-24 md:p-8 lg:pb-8">{children}</main>
        {/* Bottom tab bar — feels like a native app on the phone */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
          {TABS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] ${isActive(href) ? 'text-stone-900' : 'text-stone-400'}`}>
              <Icon size={20} strokeWidth={isActive(href) ? 2.25 : 1.75} /> {label}
              {href === '/admin/orders' && <span className="absolute right-[30%] top-1"><OrdersBadge /></span>}
            </Link>
          ))}
          <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10px] text-stone-400"><Menu size={20} strokeWidth={1.75} /> More</button>
        </nav>
      </div>
    </div>
  );
}
