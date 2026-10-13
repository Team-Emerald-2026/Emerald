import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Ticket, Flame, MapPin, Info, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react';
import {
  fetchMapFacilities,
  fetchRestaurant,
  fetchRestaurants,
  type BackendMapFacility,
  type BackendStore,
} from '../lib/api';
import { BUSY_QUEUE_COUNT, getWaitDisplay, waitLevelStyle, type WaitDisplay } from '../lib/waitDisplay';
import { Skeleton, SkeletonText } from './Skeleton';

type Category = '体験' | 'フード' | 'ステージ';

interface Booth {
  id: string;
  name: string;
  area: string;
  wait: WaitDisplay; // 待ち人数の表示（文字表示モードのときは文字）
  category: Category;
  ticket?: boolean; // 整理券対応
  popular?: boolean; // 人気ブース
}

const categories: Array<'すべて' | Category> = ['すべて', '体験', 'フード', 'ステージ'];

function toCategory(type?: string): Category {
  switch (type) {
    case 'food':
    case 'フード':
    case '飲食ブース':
      return 'フード';
    case 'stage':
    case 'shop':
    case 'ステージ':
    case 'イベントもの':
      return 'ステージ';
    default:
      return '体験';
  }
}

function toArea(store: BackendStore, facility?: BackendMapFacility): string {
  if (!facility) return store.description ?? '場所未設定';

  const floor = Number(facility.floor);
  return Number.isFinite(floor) ? `${floor}F` : '場所未設定';
}

function toBooth(store: BackendStore, facility?: BackendMapFacility): Booth {
  const wait = getWaitDisplay(store);

  return {
    id: store.id,
    name: store.name,
    area: toArea(store, facility),
    wait,
    category: toCategory(facility?.type),
    popular: store.is_open && wait.queueCount >= BUSY_QUEUE_COUNT,
  };
}

/** 詳細（説明・メニュー）の取得状況。開いたブースだけ、サーバーから取りに行く */
type DetailState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; store: BackendStore };

function formatPrice(price: number) {
  return `¥${Number(price).toLocaleString('ja-JP')}`;
}

/** カードを開いたときに出す、ブースの説明・メニュー・待ち状況 */
function BoothDetail({ booth, detail }: { booth: Booth; detail?: DetailState }) {
  if (!detail || detail.status === 'loading') {
    return (
      <div className="mt-3 space-y-2 rounded-xl bg-muted p-3" aria-label="詳細を読み込み中">
        <SkeletonText className="w-4/5" />
        <SkeletonText className="w-2/3" />
        <SkeletonText className="w-1/2" />
      </div>
    );
  }

  if (detail.status === 'error') {
    return (
      <div className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
        詳細を取得できませんでした。通信を確認して、もう一度開いてください。
      </div>
    );
  }

  const description = detail.store.description?.trim();
  const menuItems = detail.store.menu_items ?? [];
  // 体験ブースなどは、メニューがなくて普通なので、メニューがあるときだけ出す（フードは未登録の案内も出す）
  const showMenu = menuItems.length > 0 || booth.category === 'フード';

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-muted p-3 text-sm">
      <div>
        <p className="text-xs font-bold text-muted-foreground">ブースの説明</p>
        <p className="mt-1 whitespace-pre-line text-foreground">
          {description ? description : 'ブースの説明は、まだ登録されていません。'}
        </p>
      </div>

      {showMenu && (
        <div>
          <p className="text-xs font-bold text-muted-foreground">メニュー</p>
          {menuItems.length === 0 ? (
            <p className="mt-1 text-muted-foreground">メニューは、まだ登録されていません。</p>
          ) : (
            <ul className="mt-1 divide-y divide-border">
              {menuItems.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-1.5">
                  <div className="min-w-0">
                    <p className="text-foreground">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                  <p className="shrink-0 font-bold text-foreground">{formatPrice(item.price)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>場所: {booth.area}</span>
        <span>待ち状況: {booth.wait.label}</span>
      </div>
    </div>
  );
}

function BoothCardSkeleton() {
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonText className="w-2/3" />
          <SkeletonText className="w-1/3" />
        </div>
        <div className="shrink-0 space-y-2">
          <Skeleton className="h-7 w-16 rounded-lg" />
          <SkeletonText className="ml-auto w-12" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Skeleton className="h-9 rounded-xl" />
        <Skeleton className="h-9 rounded-xl" />
      </div>
    </li>
  );
}

export default function Attractions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<'すべて' | Category>('すべて');
  const [booths, setBooths] = useState<Booth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const detailId = searchParams.get('detail');
  const list = booths.filter((b) => filter === 'すべて' || b.category === filter);
  const selectedBooth = booths.find((b) => b.id === detailId) ?? null;

  // 開いたブースの詳細（説明・メニュー）。一度取ったものは、閉じても使い回す
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const requestedRef = useRef<Set<string>>(new Set());
  const detailPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!detailId || !selectedBooth) return;
    if (requestedRef.current.has(detailId)) return;
    requestedRef.current.add(detailId);

    setDetails((current) => ({ ...current, [detailId]: { status: 'loading' } }));
    fetchRestaurant(detailId)
      .then((store) => {
        if (!store) throw new Error('empty response');
        setDetails((current) => ({ ...current, [detailId]: { status: 'ready', store } }));
      })
      .catch(() => {
        // 失敗したら、次に開いたときにもう一度取りに行けるようにする
        requestedRef.current.delete(detailId);
        setDetails((current) => ({ ...current, [detailId]: { status: 'error' } }));
      });
  }, [detailId, selectedBooth]);

  // 詳細を開いたら、その位置までスクロールして見える場所に出す
  useEffect(() => {
    if (!detailId || !selectedBooth) return;
    detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [detailId, selectedBooth]);

  const showDetail = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('detail', id);
    setSearchParams(next);
  };

  const hideDetail = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('detail');
    setSearchParams(next);
  };

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    Promise.all([
      fetchRestaurants(controller.signal),
      fetchMapFacilities(controller.signal),
    ])
      .then(([stores, facilities]) => {
        const facilityByStoreId = new Map(facilities.map((facility) => [facility.store_id, facility]));
        setBooths(stores.map((store) => toBooth(store, facilityByStoreId.get(store.id))));
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('バックエンドからブース情報を取得できませんでした。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-4 p-4">
      <h1 className="font-display text-2xl font-bold text-foreground">ブース待ち状況</h1>

      {/* カテゴリフィルタ（チップ） */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="カテゴリ">
        {categories.map((c) => {
          const active = filter === c;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(c)}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: active ? 'var(--primary)' : 'var(--muted)',
                color: active ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {loading && (
        <ul className="space-y-3" aria-label="ブース情報を読み込み中">
          {Array.from({ length: 4 }).map((_, index) => (
            <BoothCardSkeleton key={index} />
          ))}
        </ul>
      )}

      {error && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {error}
        </div>
      )}

      {!loading && !error && list.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          該当するブースがありません。
        </div>
      )}

      {/* 一覧 */}
      {!loading && !error && list.length > 0 && (
        <ul className="space-y-3">
          {list.map((b) => {
            const w = waitLevelStyle(b.wait.level);
            return (
              <li
                key={b.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <button
                  type="button"
                  onClick={() => (detailId === b.id ? hideDetail() : showDetail(b.id))}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-foreground">{b.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {b.area}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className="inline-block rounded-lg px-2.5 py-1 text-sm font-bold"
                      style={{ backgroundColor: w.bg, color: w.fg }}
                    >
                      {b.wait.label}
                    </span>
                    <p className="mt-1 text-[11px] text-muted-foreground">待ち状況</p>
                  </div>
                </button>

                {(b.ticket || b.popular) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {b.ticket && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">
                        <Ticket className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                        整理券対応
                      </span>
                    )}
                    {b.popular && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">
                        <Flame className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                        人気
                      </span>
                    )}
                  </div>
                )}

                {detailId === b.id && (
                  <div ref={detailPanelRef}>
                    <BoothDetail booth={b} detail={details[b.id]} />
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => (detailId === b.id ? hideDetail() : showDetail(b.id))}
                    aria-expanded={detailId === b.id}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
                  >
                    {detailId === b.id ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    {detailId === b.id ? '閉じる' : '詳細を見る'}
                  </button>
                  <Link
                    to={`/map?store=${encodeURIComponent(b.id)}`}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    マップ
                  </Link>
                  {b.category === 'フード' && (
                    <Link
                      to={`/restaurants?store=${encodeURIComponent(b.id)}`}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-white"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      呼び出し
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !error && detailId && !selectedBooth && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          指定されたブースが見つかりませんでした。
        </div>
      )}

      {/* 注意書き */}
      <div
        className="flex gap-2 rounded-xl p-3 text-sm"
        style={{ backgroundColor: 'var(--info-soft)', color: 'var(--info)' }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          待ち人数は、ページを開いた時点の目安です。最新の状況は、画面を更新してご確認ください。
        </p>
      </div>
    </div>
  );
}
