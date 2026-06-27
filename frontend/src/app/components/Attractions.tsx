import { useEffect, useState } from 'react';
import { Ticket, Flame, MapPin, Info } from 'lucide-react';
import {
  fetchMapFacilities,
  fetchRestaurants,
  type BackendMapFacility,
  type BackendStore,
} from '../lib/api';

type Category = '体験' | 'フード' | 'ステージ';

interface Booth {
  id: string;
  name: string;
  area: string;
  wait: number; // 待ち分数
  category: Category;
  ticket?: boolean; // 整理券対応
  popular?: boolean; // 人気ブース
}

const categories: Array<'すべて' | Category> = ['すべて', '体験', 'フード', 'ステージ'];

function toCategory(type?: string): Category {
  switch (type) {
    case 'food':
      return 'フード';
    case 'stage':
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
  const wait = Number(store.current_wait_min);
  const queueCount = Number(store.current_queue_count);

  return {
    id: store.id,
    name: store.name,
    area: toArea(store, facility),
    wait: store.is_open && Number.isFinite(wait) ? wait : 0,
    category: toCategory(facility?.type),
    popular: queueCount >= 8 || wait >= 15,
  };
}

function waitStyle(min: number) {
  if (min <= 0) return { label: '今すぐ', bg: 'var(--ok-soft)', fg: 'var(--ok)' };
  if (min < 15) return { label: `${min}分`, bg: 'var(--ok-soft)', fg: 'var(--ok)' };
  if (min < 30) return { label: `${min}分`, bg: 'var(--warn-soft)', fg: 'var(--warn)' };
  return { label: `${min}分`, bg: 'var(--busy-soft)', fg: 'var(--busy)' };
}

export default function Attractions() {
  const [filter, setFilter] = useState<'すべて' | Category>('すべて');
  const [booths, setBooths] = useState<Booth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const list = booths.filter((b) => filter === 'すべて' || b.category === filter);

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
      <h1 className="font-display text-2xl font-bold text-foreground">ブース待ち時間</h1>

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
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          ブース情報を読み込み中です。
        </div>
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
            const w = waitStyle(b.wait);
            return (
              <li
                key={b.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
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
                      {w.label}
                    </span>
                    <p className="mt-1 text-[11px] text-muted-foreground">待ち時間</p>
                  </div>
                </div>

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
              </li>
            );
          })}
        </ul>
      )}

      {/* 注意書き */}
      <div
        className="flex gap-2 rounded-xl p-3 text-sm"
        style={{ backgroundColor: 'var(--info-soft)', color: 'var(--info)' }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          待ち時間はおよそ5分ごとに更新される目安です。当日の状況により前後する場合があります。
        </p>
      </div>
    </div>
  );
}
