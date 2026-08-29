import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Tent, Hash, MapPin, Sun, Moon } from 'lucide-react';

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
      title="テーマ変更"
      aria-label={dark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
      className="group absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-foreground/80 transition-colors hover:bg-muted"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      <span className="pointer-events-none absolute right-0 top-full z-30 mt-1 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        テーマ変更
      </span>
    </button>
  );
}

const tabs = [
  { to: '/', label: 'ホーム', icon: Home, end: true },
  { to: '/attractions', label: 'ブース', icon: Tent, end: false },
  { to: '/restaurants', label: '呼び出し', icon: Hash, end: false },
  { to: '/map', label: 'マップ', icon: MapPin, end: false },
];

export default function Layout() {
  const { pathname } = useLocation();

  // 呼び出しタブは /restaurants 配下でもアクティブにする
  const isActive = (to: string, end: boolean) => {
    if (end) return pathname === to;
    return pathname === to || pathname.startsWith(to + '/');
  };

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-background">
      {/* ヘッダー */}
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-center border-b border-border bg-card/90 px-4 backdrop-blur">
        <span className="font-display text-lg font-bold tracking-wide text-foreground">
          京都TECH学園祭
        </span>
        <ThemeToggle />
      </header>

      {/* メイン：下部ナビは文書フローに置くので、ここでは余白で隠さない */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* 下部ナビ（fixed にしないことでコンテンツ重なりを防ぐ） */}
      <nav
        className="flex shrink-0 border-t border-border bg-card/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {tabs.map(({ to, label, icon: Icon, end }) => {
          const active = isActive(to, end);
          return (
            <NavLink
              key={to}
              to={to}
              className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors"
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
