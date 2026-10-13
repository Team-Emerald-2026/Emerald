import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Hash, Info, Megaphone } from 'lucide-react';
import {
  fetchCallNumbers,
  fetchRestaurants,
  type BackendStore,
  type CallNumber,
} from '../lib/api';
import { getWaitDisplay, type WaitDisplay } from '../lib/waitDisplay';
import { Skeleton, SkeletonText } from './Skeleton';

/** 呼び出し中の番号を取りに行く間隔（店舗側の画面と同じ5秒） */
const CALL_NUMBER_POLL_MS = 5000;

type Store = {
  id: string;
  name: string;
  description: string;
  isOpen: boolean;
  wait: WaitDisplay;
};

function toStore(store: BackendStore): Store {
  return {
    id: store.id,
    name: store.name,
    description: store.description ?? '店舗説明は未設定です',
    isOpen: store.is_open,
    wait: getWaitDisplay(store),
  };
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

  // 選んだ店舗の「呼び出し中」の番号（サーバーから5秒ごとに取得）
  const [tickets, setTickets] = useState<CallNumber[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState(false);

  useEffect(() => {
    if (!selectedStoreId) {
      setTickets([]);
      setTicketsError(false);
      setTicketsLoading(false);
      return;
    }

    let controller: AbortController | null = null;
    setTickets([]);
    setTicketsError(false);
    setTicketsLoading(true);

    const load = () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;

      fetchCallNumbers(selectedStoreId, current.signal)
        .then((data) => {
          if (current.signal.aborted) return;
          setTickets(data);
          setTicketsError(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setTicketsError(true);
        })
        .finally(() => {
          if (!current.signal.aborted) setTicketsLoading(false);
        });
    };

    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, CALL_NUMBER_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [selectedStoreId]);

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
          <p>
            店頭で購入後、お店から呼び出された番号をここで確認できます。画面は5秒ごとに自動で更新されます。
          </p>
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

        {selectedStore && ticketsError && (
          <div
            className="rounded-xl p-3 text-sm"
            style={{ backgroundColor: 'var(--busy-soft)', color: 'var(--busy)' }}
          >
            呼び出し番号を取得できませんでした。通信を確認して、しばらくお待ちください。
            {tickets.length > 0 && '（表示は最後に取得できた内容です）'}
          </div>
        )}

        {selectedStore && ticketsLoading && tickets.length === 0 && !ticketsError && (
          <div className="space-y-3" aria-label="呼び出し番号を読み込み中">
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        )}

        {selectedStore && !ticketsLoading && !ticketsError && tickets.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">現在呼び出し中の番号はありません。</p>
            <p className="mt-1 text-xs text-muted-foreground">
              番号が呼ばれると、ここに表示されます。
            </p>
          </div>
        )}

        {selectedStore && tickets.length > 0 && (
          <ul className="space-y-3">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
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
                    <p className="font-display text-2xl font-bold text-foreground">
                      {ticket.ticket_number}
                    </p>
                    <p className="text-xs text-muted-foreground">受取番号</p>
                  </div>
                </div>
                <span
                  className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold"
                  style={{ backgroundColor: 'var(--accent-soft, var(--ok-soft))', color: 'var(--accent, var(--ok))' }}
                >
                  呼び出し中
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
                      待ち状況: {store.wait.label}
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
