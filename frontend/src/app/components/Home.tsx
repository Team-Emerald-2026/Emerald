import { Link, useNavigate } from 'react-router-dom';
import { Clock, ShoppingBag, MapPin, ChevronRight } from 'lucide-react';
import ImageWithFallback from './ImageWithFallback';

const HERO_SRC = '/93769-1-633ff99f5178bc6f1cd15c375861655a-1000x690.png';

const quickMenu = [
  {
    to: '/attractions',
    icon: Clock,
    title: '本日の待ち時間',
    desc: '各ブースの混み具合をチェック',
    color: 'var(--primary)',
  },
  {
    to: '/restaurants',
    icon: ShoppingBag,
    title: 'モバイルオーダー',
    desc: '並ばずに注文して受け取り',
    color: 'var(--accent)',
  },
  {
    to: '/map',
    icon: MapPin,
    title: '校内マップ',
    desc: '会場とブースの場所を確認',
    color: '#7c5cff',
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 p-4">
      {/* ヒーローカード */}
      <button
        type="button"
        onClick={() => navigate('/attractions')}
        className="group relative block w-full overflow-hidden rounded-3xl text-left shadow-lg"
        style={{ aspectRatio: '1000 / 690' }}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg,#0f7b5f,#15324a)' }}
          aria-hidden="true"
        />
        <ImageWithFallback
          src={HERO_SRC}
          alt="京都TECH学園祭の会場イメージ"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(8,18,30,0.05) 0%, rgba(8,18,30,0.15) 45%, rgba(8,18,30,0.82) 100%)',
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-sm font-medium text-emerald-200">2026 / KYOTO TECH</p>
          <h1 className="font-display text-3xl font-bold text-white drop-shadow">
            京都TECH学園祭
          </h1>
          <p className="mt-1 text-sm text-white/85">技術と灯りが集まる、二日間の祭。</p>
        </div>
      </button>

      {/* クイックメニュー */}
      <section>
        <h2 className="mb-3 px-1 font-display text-base font-bold text-foreground">
          まずはここから
        </h2>
        <ul className="space-y-3">
          {quickMenu.map(({ to, icon: Icon, title, desc, color }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted"
              >
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="h-6 w-6 text-white" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-foreground">{title}</span>
                  <span className="block text-sm text-muted-foreground">{desc}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
