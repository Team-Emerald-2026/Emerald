import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, ShoppingBag, MapPin, ChevronRight, Sparkles, Megaphone } from 'lucide-react';
import {
  fetchEvents,
  fetchMapFacilities,
  fetchRestaurants,
  type BackendMapFacility,
  type BackendStore,
  type EventNotice,
} from '../lib/api';
import { jstParts, timeLabel } from '../lib/eventSchedule';
import {
  BUSY_QUEUE_COUNT,
  getWaitDisplay,
  waitLevelStyle,
  type WaitDisplay,
} from '../lib/waitDisplay';
import { Skeleton, SkeletonText } from './Skeleton';

/** ヒーロー背景動画（YouTube UI を避けるためローカルファイルを使用） */
const HERO_VIDEO_SRC = '/hero.mp4';
/** 画面の小さい端末向けの軽量版（ビットレートを落とした 480p） */
const HERO_VIDEO_MOBILE_SRC = '/hero-mobile.mp4';
/** 動画読み込み前・動画を流さない端末向けの静止画（動画の1コマ） */
const HERO_POSTER_SRC = '/hero-poster.jpg';
/** この幅以下の端末には軽量版の動画を配信する */
const HERO_MOBILE_MAX_WIDTH = 768;

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * ヒーロー動画を読み込むべきか判定する。
 * データセーバーが有効、または回線が遅い（2G/3G 相当）端末では
 * 動画を読み込まず、ポスター画像だけを表示する。
 */
function shouldLoadHeroVideo(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  const effectiveType = connection.effectiveType ?? '';
  if (['slow-2g', '2g', '3g'].includes(effectiveType)) return false;
  return true;
}

const quickMenu = [
  {
    to: '/attractions',
    icon: Clock,
    title: '本日の待ち状況',
    desc: '各ブースの待ち人数をチェック',
    color: 'var(--primary)',
  },
  {
    to: '/restaurants',
    icon: ShoppingBag,
    title: '受取番号',
    desc: '店舗の呼び出し番号を確認',
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

/** ホームに出すお知らせの最大件数（それより古いものはイベント画面で見る） */
const HOME_NOTICE_COUNT = 3;

/** お知らせした時刻を「10/24 13:05」の形にする（日本時間）。時刻が無ければ null */
function noticeTimeLabel(iso: string | null | undefined): string | null {
  const parts = jstParts(iso);
  if (!parts) return null;
  const [, month, day] = parts.day.split('-');
  return `${Number(month)}/${Number(day)} ${timeLabel(parts.minutes)}`;
}

interface RecommendedBooth {
  id: string;
  name: string;
  area: string;
  wait: WaitDisplay;
  popular: boolean;
}

function toArea(store: BackendStore, facility?: BackendMapFacility): string {
  if (!facility) return store.description ?? '場所未設定';

  const floor = Number(facility.floor);
  return Number.isFinite(floor) ? `${floor}F` : '場所未設定';
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
  const [notices, setNotices] = useState<EventNotice[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [heroVideoSrc, setHeroVideoSrc] = useState<string | null>(null);
  const [heroVideoPlaying, setHeroVideoPlaying] = useState(false);

  // ヒーロー動画はページの表示が終わってから読み込む（初期表示はポスター画像）
  useEffect(() => {
    if (!shouldLoadHeroVideo()) return;

    const startLoading = () => {
      const isSmallScreen = window.matchMedia(`(max-width: ${HERO_MOBILE_MAX_WIDTH}px)`).matches;
      setHeroVideoSrc(isSmallScreen ? HERO_VIDEO_MOBILE_SRC : HERO_VIDEO_SRC);
    };

    if (document.readyState === 'complete') {
      startLoading();
      return;
    }

    window.addEventListener('load', startLoading, { once: true });
    return () => window.removeEventListener('load', startLoading);
  }, []);

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
            const wait = getWaitDisplay(store);
            return {
              id: store.id,
              name: store.name,
              area: toArea(store, facilityByStoreId.get(store.id)),
              wait,
              popular: wait.queueCount >= BUSY_QUEUE_COUNT,
            };
          })
          .sort((a, b) => a.wait.queueCount - b.wait.queueCount)
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

  // お知らせ（公開中のものを新しい順に数件だけ）
  useEffect(() => {
    const controller = new AbortController();

    fetchEvents(controller.signal)
      .then((items) => {
        const next = items
          .filter((item) => item.type === 'notice')
          .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
          .slice(0, HOME_NOTICE_COUNT);
        setNotices(next);
      })
      .catch(() => {
        // 取得に失敗したときは「お知らせはまだありません」の表示のままにする
      })
      .finally(() => {
        if (!controller.signal.aborted) setNoticesLoading(false);
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
        <img
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          src={HERO_POSTER_SRC}
          alt=""
          decoding="async"
          aria-hidden="true"
        />
        {heroVideoSrc && (
          <video
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${heroVideoPlaying ? 'opacity-100' : 'opacity-0'}`}
            src={heroVideoSrc}
            autoPlay
            muted
            loop
            playsInline
            onPlaying={() => setHeroVideoPlaying(true)}
            aria-hidden="true"
          />
        )}
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

      {/* お知らせ一覧（0件でも枠は出したままにする） */}
      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="font-display text-base font-bold text-foreground">お知らせ</h2>
          <Link to="/events" className="text-xs font-bold" style={{ color: 'var(--primary)' }}>
            すべて見る
          </Link>
        </div>

        {noticesLoading ? (
          <div
            className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
            aria-label="お知らせを読み込み中"
          >
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonText className="w-1/4" />
              <SkeletonText className="w-3/5" />
            </div>
          </div>
        ) : notices.length > 0 ? (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {notices.map((notice) => {
              const time = noticeTimeLabel(notice.created_at);
              return (
                <li key={notice.id} className="border-b border-border last:border-b-0">
                  <Link to="/events" className="flex items-start gap-3 p-4 transition-colors hover:bg-muted">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      <Megaphone className="h-4 w-4 text-white" />
                    </span>
                    <span className="min-w-0 flex-1">
                      {time && (
                        <span className="block text-xs tabular-nums text-muted-foreground">{time}</span>
                      )}
                      <span className="block font-bold text-foreground">{notice.title}</span>
                      {notice.body && (
                        <span className="mt-0.5 block line-clamp-2 text-sm text-muted-foreground">
                          {notice.body}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            お知らせはまだありません。
          </div>
        )}
      </section>

      {/* おすすめ枠 */}
      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="font-display text-base font-bold text-foreground">
            待ち人数が少ないブース
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
                      {booth.area}
                      {booth.popular ? '・人気' : ''}
                    </span>
                  </span>
                  <span
                    className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold"
                    style={{
                      backgroundColor: waitLevelStyle(booth.wait.level).bg,
                      color: waitLevelStyle(booth.wait.level).fg,
                    }}
                  >
                    {booth.wait.label}
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
