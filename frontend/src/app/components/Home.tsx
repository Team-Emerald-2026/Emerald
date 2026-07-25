import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, ShoppingBag, MapPin, ChevronRight, Sparkles } from 'lucide-react';
import {
  fetchMapFacilities,
  fetchRestaurants,
  type BackendMapFacility,
  type BackendStore,
} from '../lib/api';
import { Skeleton, SkeletonText } from './Skeleton';

/** ヒーロー背景動画（YouTube UI を避けるためローカルファイルを使用） */
const HERO_VIDEO_SRC = '/hero.mp4';

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
    title: 'マップ',
    desc: '会場とブースの場所を確認',
    color: '#7c5cff',
  },
];

interface RecommendedBooth {
  id: string;
  name: string;
  area: string;
  wait: number;
  popular: boolean;
}

function toArea(store: BackendStore, facility?: BackendMapFacility): string {
  if (!facility) return store.description ?? '場所未設定';

  const floor = Number(facility.floor);
  return Number.isFinite(floor) ? `${floor}F` : '場所未設定';
}

function toWaitLabel(min: number) {
  return min <= 0 ? 'すぐ入れる' : `${min}分待ち`;
}

function RecommendationSkeleton() {
  return (
    <li>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonText className="w-3/5" />
          <SkeletonText className="w-2/5" />
        </div>
        <Skeleton className="h-7 w-16 shrink-0 rounded-lg" />
      </div>
    </li>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [recommendedBooths, setRecommendedBooths] = useState<RecommendedBooth[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetchRestaurants(controller.signal),
      fetchMapFacilities(controller.signal),
    ])
      .then(([stores, facilities]) => {
        const facilityByStoreId = new Map(facilities.map((facility) => [facility.store_id, facility]));
        const nextBooths = stores
          .filter((store) => store.is_open)
          .map((store) => {
            const wait = Number(store.current_wait_min);
            const queueCount = Number(store.current_queue_count);
            return {
              id: store.id,
              name: store.name,
              area: toArea(store, facilityByStoreId.get(store.id)),
              wait: Number.isFinite(wait) ? wait : 0,
              popular: queueCount >= 8 || wait >= 15,
            };
          })
          .sort((a, b) => a.wait - b.wait)
          .slice(0, 3);

        setRecommendedBooths(nextBooths);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setRecommendedBooths([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRecommendationsLoading(false);
      });

    return () => controller.abort();
  }, []);

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
        <video
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          src={HERO_VIDEO_SRC}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
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

      {/* おすすめ枠 */}
      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="font-display text-base font-bold text-foreground">
            待ち時間が短いブース
          </h2>
          <Link to="/attractions" className="text-xs font-bold" style={{ color: 'var(--primary)' }}>
            すべて見る
          </Link>
        </div>

        {recommendationsLoading ? (
          <ul className="space-y-3" aria-label="おすすめブースを読み込み中">
            {Array.from({ length: 3 }).map((_, index) => (
              <RecommendationSkeleton key={index} />
            ))}
          </ul>
        ) : recommendedBooths.length > 0 ? (
          <ul className="space-y-3">
            {recommendedBooths.map((booth) => (
              <li key={booth.id}>
                <Link
                  to={`/attractions?detail=${encodeURIComponent(booth.id)}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted"
                >
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                    style={{ backgroundColor: 'var(--ok-soft)' }}
                  >
                    <Sparkles className="h-5 w-5" style={{ color: 'var(--ok)' }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-foreground">{booth.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {booth.area}・{booth.popular ? '人気' : '空いている'}
                    </span>
                  </span>
                  <span
                    className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold"
                    style={{ backgroundColor: 'var(--ok-soft)', color: 'var(--ok)' }}
                  >
                    {toWaitLabel(booth.wait)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            現在おすすめできるブース情報がありません。
          </div>
        )}
      </section>

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
