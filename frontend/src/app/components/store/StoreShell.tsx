import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LogOut,
  ShoppingCart,
  LayoutDashboard,
  Users,
  Megaphone,
  History,
  Store,
  MoreHorizontal,
} from 'lucide-react';
import { useFestival, logoutStore } from '../../lib/festivalStore';
import { logoutBooth } from '../../lib/api';

const links = [
  { to: '/store', label: 'レジ', icon: ShoppingCart, end: true },
  { to: '/store/ticket', label: '呼び出し', icon: Megaphone, end: false },
  { to: '/store/dashboard', label: 'ダッシュボード', icon: LayoutDashboard, end: false },
  { to: '/store/waiting', label: '待ち人数', icon: Users, end: false },
  { to: '/store/served', label: '提供済み', icon: History, end: false },
  { to: '/store/profile', label: '店舗情報', icon: Store, end: false },
];

const primaryHrefs = new Set(['/store', '/store/ticket']);

export default function StoreShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const session = useFestival((s) => s.session);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [moreOpen]);

  if (!session) return <Navigate to="/store/login" replace />;

  const primary = links.filter((link) => primaryHrefs.has(link.to));
  const secondary = links.filter((link) => !primaryHrefs.has(link.to));
  const moreActive = secondary.some((link) =>
    link.end ? pathname === link.to : pathname === link.to || pathname.startsWith(`${link.to}/`),
  );

  const renderLink = (link: (typeof links)[number], compact = false) => {
    const Icon = link.icon;
    return (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.end}
        className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          compact ? 'w-full' : ''
        }`}
        style={({ isActive }) => ({
          backgroundColor: isActive ? 'var(--primary)' : 'var(--muted)',
          color: isActive ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
        })}
      >
        <Icon className="h-4 w-4" />
        {link.label}
      </NavLink>
    );
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">店舗管理</p>
          <h1 className="truncate font-display text-base font-bold text-foreground">{title}</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            void logoutBooth(session.token).catch((error) => {
              console.error('Logout API failed', error);
            });
            logoutStore();
            navigate('/store/login');
          }}
          className="flex min-h-11 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
        >
          <LogOut className="h-4 w-4" />
          ログアウト
        </button>
      </header>

      <nav className="sticky top-14 z-10 border-b border-border bg-card/95 px-2 py-2 backdrop-blur">
        <div className="hidden gap-1 md:flex">
          {links.map((link) => renderLink(link))}
        </div>
        <div className="flex gap-1 md:hidden">
          {primary.map((link) => renderLink(link))}
          <div className="relative ml-auto" ref={moreRef}>
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen((open) => !open)}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
              style={{
                backgroundColor: moreActive || moreOpen ? 'var(--primary)' : 'var(--muted)',
                color:
                  moreActive || moreOpen ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
              その他
            </button>
            {moreOpen && (
              <div
                role="menu"
                className="absolute right-0 z-30 mt-1 min-w-44 space-y-1 rounded-xl border border-border bg-card p-1.5 shadow-lg"
              >
                {secondary.map((link) => renderLink(link, true))}
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
