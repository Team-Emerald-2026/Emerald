import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Hash, Info, Megaphone } from 'lucide-react';
import { fetchRestaurants, type BackendStore } from '../lib/api';
import { Skeleton, SkeletonText } from './Skeleton';

type TicketStatus = 'waiting' | 'called' | 'served';

type Store = {
  id: string;
  name: string;
  description: string;
  isOpen: boolean;
  waitMin: number;
};

type Ticket = {
  number: string;
  status: TicketStatus;
};

// TODO(API): 店舗レジで発行した受取番号一覧に差し替え
const MOCK_TICKETS: Record<string, Ticket[]> = {
  'store-101': [
    { number: 'C-12', status: 'called' },
    { number: 'C-13', status: 'waiting' },
    { number: 'C-14', status: 'waiting' },
  ],
  'store-102': [
    { number: 'Y-03', status: 'called' },
    { number: 'Y-04', status: 'waiting' },
  ],
};

function toStore(store: BackendStore): Store {
  return {
    id: store.id,
    name: store.name,
    description: store.description ?? '店舗説明は未設定です',
    isOpen: store.is_open,
    waitMin: Number(store.current_wait_min) || 0,
  };
}

function statusLabel(status: TicketStatus) {
  switch (status) {
    case 'called':
      return '呼び出し中';
    case 'served':
      return '受取済';
    default:
      return '待ち';
  }
}

function statusStyle(status: TicketStatus) {
  switch (status) {
    case 'called':
      return { backgroundColor: 'var(--accent-soft, var(--ok-soft))', color: 'var(--accent, var(--ok))' };
    case 'served':
      return { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' };
    default:
      return { backgroundColor: 'var(--ok-soft)', color: 'var(--ok)' };
  }
}

function StoreCardSkeleton() {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonText className="w-1/2" />
          <SkeletonText className="w-4/5" />
        </div>
        <Skeleton className="h-6 w-14 shrink-0 rounded-md" />
      </div>
    </section>
  );
}

export default function Restaurants() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedStoreId = searchParams.get('store');

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetchRestaurants(controller.signal)
      .then((backendStores) => {
        setStores(
          backendStores
            .filter((store) => (store.type ?? 'food') === 'food')
            .map(toStore),
        );
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('バックエンドから店舗情報を取得できませんでした。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const selectedStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  );

  const tickets = selectedStoreId ? (MOCK_TICKETS[selectedStoreId] ?? []) : [];

  /* ---------- 店舗の受取番号一覧 ---------- */
  if (selectedStoreId) {
    return (
      <div className="space-y-5 p-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/restaurants')}
            className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border hover:bg-muted"
            aria-label="店舗一覧へ戻る"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-foreground">受取番号</h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {selectedStore?.name ?? '店舗'}
            </p>
          </div>
        </div>

        <div
          className="flex gap-2 rounded-xl p-3 text-sm"
          style={{ backgroundColor: 'var(--info-soft)', color: 'var(--info)' }}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>店頭で購入後、店舗タブレットで発行された番号をここで確認できます。</p>
        </div>

        {!selectedStore && !loading && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            店舗が見つかりませんでした。
            <Link
              to="/restaurants"
              className="mt-3 inline-block font-bold underline"
              style={{ color: 'var(--primary)' }}
            >
              店舗一覧へ
            </Link>
          </div>
        )}

        {selectedStore && tickets.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">現在表示できる受取番号はありません。</p>
            <p className="mt-1 text-xs text-muted-foreground">※ 仮データ未設定（API接続後に更新）</p>
          </div>
        )}

        {selectedStore && tickets.length > 0 && (
          <ul className="space-y-3">
            {tickets.map((ticket) => (
              <li
                key={ticket.number}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-xl"
                    style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                  >
                    <Hash className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-display text-2xl font-bold text-foreground">{ticket.number}</p>
                    <p className="text-xs text-muted-foreground">受取番号</p>
                  </div>
                </div>
                <span
                  className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold"
                  style={statusStyle(ticket.status)}
                >
                  {statusLabel(ticket.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  /* ---------- 店舗一覧 ---------- */
  return (
    <div className="space-y-5 p-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">受取番号</h1>
        <p className="mt-1 text-sm text-muted-foreground">店舗を選んで呼び出し状況を確認</p>
      </div>

      <div
        className="flex gap-2 rounded-xl p-3 text-sm"
        style={{ backgroundColor: 'var(--info-soft)', color: 'var(--info)' }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>アプリからの注文は行いません。店頭で購入し、発行された番号を確認してください。</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="space-y-3" aria-label="店舗情報を読み込み中">
          {Array.from({ length: 3 }).map((_, index) => (
            <StoreCardSkeleton key={index} />
          ))}
        </div>
      )}

      {!loading && !error && stores.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          表示できる店舗がありません。
        </div>
      )}

      {!loading && !error && (
        <ul className="space-y-3">
          {stores.map((store) => (
            <li key={store.id}>
              <button
                type="button"
                onClick={() => navigate(`/restaurants?store=${encodeURIComponent(store.id)}`)}
                className="w-full overflow-hidden rounded-2xl border border-border bg-card text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-foreground">{store.name}</h2>
                    <p className="text-xs text-muted-foreground">{store.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      待ち時間目安: {store.waitMin}分
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: store.isOpen ? 'var(--ok-soft)' : 'var(--busy-soft)',
                      color: store.isOpen ? 'var(--ok)' : 'var(--busy)',
                    }}
                  >
                    {store.isOpen ? '受付中' : '準備中'}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
