import { useEffect, useState } from 'react';
import StoreShell from './StoreShell';
import { useFestival, logoutStore } from '../../lib/festivalStore';
import { Users, Hourglass, Hash, Banknote } from 'lucide-react';
import {
  ApiError,
  type BoothDashboard,
  fetchBoothDashboard,
  getBoothOrderStage,
} from '../../lib/api';
import { useBoothOrders } from '../../lib/useBoothOrders';

/** 売上や待ち人数を取りに行く間隔（ミリ秒） */
const POLL_INTERVAL_MS = 5000;

function statusLabel(status: 'waiting' | 'called') {
  return status === 'called' ? '呼び出し中' : '提供待ち';
}

export default function StoreDashboard() {
  const session = useFestival((s) => s.session);
  const {
    unservedOrders,
    waitingOrders,
    calledOrders,
    loading: ordersLoading,
    error: ordersError,
  } = useBoothOrders(session?.token, { onUnauthorized: logoutStore });
  const [dashboard, setDashboard] = useState<BoothDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;

    const abortController = new AbortController();
    setLoading(true);
    setError('');

    const load = () =>
      fetchBoothDashboard(session.token, abortController.signal)
        .then((data) => {
          if (abortController.signal.aborted) return;
          if (!data) {
            setError('ダッシュボード情報を取得できませんでした。');
            return;
          }
          setDashboard(data);
          setError('');
        })
        .catch((e) => {
          if (abortController.signal.aborted) return;
          if (e instanceof ApiError && e.status === 401) {
            logoutStore();
            return;
          }
          setError('ダッシュボード情報の取得に失敗しました。');
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setLoading(false);
          }
        });

    void load();
    // 会計や提供のたびに売上・待ち人数が変わるので、定期的に取り直す
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_INTERVAL_MS);

    return () => {
      abortController.abort();
      window.clearInterval(timer);
    };
  }, [session]);

  const waitingCount = waitingOrders.length;
  const calledCount = calledOrders.length;
  const queueCount = dashboard ? Number(dashboard.current_queue_count) || 0 : null;
  const yen = (value: number) => `¥${value.toLocaleString('ja-JP')}`;

  const cards = [
    {
      label: '提供待ち',
      value: ordersLoading ? '---' : `${unservedOrders.length}`,
      unit: ordersLoading ? '' : '件',
      hint:
        ordersLoading || unservedOrders.length === 0
          ? '未提供の注文はありません'
          : `受付待ち ${waitingCount}件・呼び出し中 ${calledCount}件`,
      icon: Users,
      color: 'var(--primary)',
    },
    {
      label: '来場者への待ち表示',
      value: queueCount === null ? '---' : `${queueCount}`,
      unit: queueCount === null ? '' : '人',
      hint: '来場者画面に「待ち○人」として表示されます',
      icon: Hourglass,
      color: 'var(--accent)',
    },
    {
      label: '総売上',
      value: dashboard ? yen(dashboard.revenue ?? 0) : '---',
      unit: '',
      hint: '会計済み注文と手入力売上の合計',
      icon: Banknote,
      color: '#22c55e',
    },
    {
      label: '営業状態',
      value: dashboard ? (dashboard.is_open ? '営業中' : '受付停止中') : '---',
      unit: '',
      hint: dashboard?.is_open ? '来場者画面に公開中' : '来場者画面では準備中',
      icon: Hash,
      color: '#7c5cff',
    },
  ];

  const storeName = dashboard?.name?.trim() || '---';
  const storeDescription = dashboard?.description?.trim() || '';

  return (
    <StoreShell title="ダッシュボード">
      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">店舗名</p>
        <p className="font-display text-lg font-bold text-foreground">{storeName}</p>
        <p className="mt-3 text-xs font-medium text-muted-foreground">説明</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {storeDescription || '店舗説明は未設定です。'}
        </p>
      </div>

      {loading && (
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          ダッシュボード情報を読み込み中です...
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm text-red-500">{error}</p>
      )}
      {ordersError && (
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm text-red-500">
          {ordersError}（最後に取得した内容を表示しています）
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <span
              className="grid h-10 w-10 place-items-center rounded-xl"
              style={{ backgroundColor: c.color }}
            >
              <c.icon className="h-5 w-5 text-white" />
            </span>
            <p className="mt-3 text-sm text-muted-foreground">{c.label}</p>
            <p className="font-display text-3xl font-bold text-foreground">
              {c.value}
              {c.unit && <span className="ml-1 text-base font-medium">{c.unit}</span>}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-base font-bold text-foreground">売上の内訳</h2>
        {!dashboard ? (
          <p className="mt-3 rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
            読み込み中...
          </p>
        ) : (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">会計済み</p>
                <p className="font-display text-xl font-bold text-foreground">
                  {dashboard.settled_order_count ?? 0}
                  <span className="ml-1 text-sm font-medium">件</span>
                </p>
              </div>
              <div className="rounded-xl bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">レジ売上</p>
                <p className="font-display text-xl font-bold text-foreground">
                  {yen(dashboard.order_revenue ?? 0)}
                </p>
              </div>
              <div className="rounded-xl bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">手入力売上</p>
                <p className="font-display text-xl font-bold text-foreground">
                  {yen(dashboard.sales_entry_revenue ?? 0)}
                </p>
              </div>
            </div>

            <h3 className="mt-4 text-sm font-bold text-foreground">商品別の売上数</h3>
            {dashboard.item_sales?.length ? (
              <ul className="mt-2 space-y-2">
                {dashboard.item_sales.map((item) => (
                  <li
                    key={item.menu_item_id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2"
                  >
                    <p className="min-w-0 truncate font-bold text-foreground">{item.name}</p>
                    <p className="shrink-0 text-sm text-muted-foreground">
                      {item.quantity}点
                      <span className="ml-2 font-display text-base font-bold text-foreground">
                        {yen(item.subtotal)}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
                まだ商品の売上はありません。
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-5">
        <h2 className="mb-2 font-display text-base font-bold text-foreground">提供待ち一覧</h2>
        {ordersLoading ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
            読み込み中...
          </p>
        ) : unservedOrders.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
            提供待ちはありません。
          </p>
        ) : (
          <ul className="space-y-2">
            {unservedOrders.map((o) => {
              const stage = getBoothOrderStage(o) === 'called' ? 'called' : 'waiting';
              return (
                <li
                  key={o.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="font-display text-lg font-bold text-foreground">
                    {o.ticket_number}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {o.items.reduce((a, it) => a + it.quantity, 0)}点
                    <span
                      className="ml-2"
                      style={{ color: stage === 'called' ? 'var(--accent)' : 'var(--primary)' }}
                    >
                      {statusLabel(stage)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </StoreShell>
  );
}
