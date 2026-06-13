import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Tent, ShoppingBag, MapPin, Sun, Moon } from 'lucide-react';

/** ライト/ダークの切替ボタン。選択は localStorage('theme') に保存。 */
function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      aria-label={dark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
      className="absolute right-3 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full text-foreground/80 hover:bg-muted transition-colors"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

const tabs = [
  { to: '/', label: 'ホーム', icon: Home, end: true },
  { to: '/attractions', label: 'ブース', icon: Tent, end: false },
  { to: '/restaurants', label: '注文', icon: ShoppingBag, end: false },
  { to: '/map', label: '校内', icon: MapPin, end: false },
];

export default function Layout() {
  const { pathname } = useLocation();

  // 注文タブは /restaurants/* の子パスでもアクティブにする
  const isActive = (to: string, end: boolean) => {
    if (end) return pathname === to;
    return pathname === to || pathname.startsWith(to + '/');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      {/* ヘッダー */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-center border-b border-border bg-card/90 px-4 backdrop-blur">
        <span className="font-display text-lg font-bold tracking-wide text-foreground">
          京都TECH学園祭
        </span>
        <ThemeToggle />
      </header>

      {/* メイン */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* 下部固定ナビ */}
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md border-t border-border bg-card/95 backdrop-blur">
        {tabs.map(({ to, label, icon: Icon, end }) => {
          const active = isActive(to, end);
          return (
            <NavLink
              key={to}
              to={to}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs transition-colors"
              style={{ color: active ? 'var(--primary)' : 'var(--muted-foreground)' }}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
              <span className={active ? 'font-bold' : ''}>{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
