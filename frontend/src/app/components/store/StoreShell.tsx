import type { ReactNode } from 'react';
import { Navigate, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, ShoppingCart, LayoutDashboard, Users, Megaphone, History } from 'lucide-react';
import { useFestival, logoutStore } from '../../lib/festivalStore';

const links = [
  { to: '/store', label: 'レジ', icon: ShoppingCart, end: true },
  { to: '/store/dashboard', label: 'ダッシュボード', icon: LayoutDashboard, end: false },
  { to: '/store/waiting', label: '待ち人数', icon: Users, end: false },
  { to: '/store/ticket', label: '受付番号', icon: Megaphone, end: false },
  { to: '/store/served', label: '提供済み', icon: History, end: false },
];

export default function StoreShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const session = useFestival((s) => s.session);
  const navigate = useNavigate();

  if (!session) return <Navigate to="/store/login" replace />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">店舗 {session}</p>
          <h1 className="truncate font-display text-base font-bold text-foreground">{title}</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            logoutStore();
            navigate('/store/login');
          }}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
        >
          <LogOut className="h-4 w-4" />
          ログアウト
        </button>
      </header>

      <nav className="sticky top-14 z-10 flex gap-1 overflow-x-auto border-b border-border bg-card/95 px-2 py-2 backdrop-blur">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            style={({ isActive }) => ({
              backgroundColor: isActive ? 'var(--primary)' : 'var(--muted)',
              color: isActive ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
            })}
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
