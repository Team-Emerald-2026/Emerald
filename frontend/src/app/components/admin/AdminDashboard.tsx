import { useEffect, useState } from 'react';
import { BarChart3, Receipt, Store } from 'lucide-react';
import AdminShell from './AdminShell';
import { ApiError, fetchAdminAnalytics, type AdminAnalytics } from '../../lib/api';
import { logoutAdminSession, useFestival } from '../../lib/festivalStore';

const yen = (value: number) => `¥${value.toLocaleString('ja-JP')}`;

export default function AdminDashboard() {
  const adminSession = useFestival((s) => s.adminSession);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!adminSession) return;
    const controller = new AbortController();

    setLoading(true);
    setError('');
    fetchAdminAnalytics(adminSession.token, controller.signal)
      .then((data) => setAnalytics(data))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          logoutAdminSession();
          return;
        }
        setError('管理画面の集計情報を取得できませんでした。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [adminSession]);

  const cards = [
    {
      label: '総収益',
      value: analytics ? yen(analytics.total_revenue) : '---',
      icon: Receipt,
      color: 'var(--primary)',
    },
    {
      label: '総会計数',
      value: analytics ? `${analytics.total_orders}件` : '---',
      icon: BarChart3,
      color: 'var(--accent)',
    },
    {
      label: '清算済み',
      value: analytics ? `${analytics.settled_orders}件` : '---',
      icon: Store,
      color: '#7c5cff',
    },
  ];

  return (
    <AdminShell title="管理ダッシュボード">
      {loading && (
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          集計情報を読み込み中です...
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm text-red-500">{error}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <section key={card.label} className="rounded-2xl border border-border bg-card p-4">
            <span
              className="grid h-10 w-10 place-items-center rounded-xl"
              style={{ backgroundColor: card.color }}
            >
              <card.icon className="h-5 w-5 text-white" />
            </span>
            <p className="mt-3 text-sm text-muted-foreground">{card.label}</p>
            <p className="font-display text-3xl font-bold text-foreground">{card.value}</p>
          </section>
        ))}
      </div>

      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-bold text-foreground">店舗別収益</h2>
        <div className="mt-3 space-y-2">
          {analytics?.stores.length ? (
            analytics.stores.map((store) => (
              <div
                key={store.store_id}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-foreground">{store.store_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {store.is_visible ? (store.is_open ? '営業中' : '準備中') : '非表示'}・{store.order_count}件
                  </p>
                </div>
                <p className="shrink-0 font-display text-lg font-bold text-foreground">
                  {yen(store.revenue)}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
              収益データはまだありません。
            </p>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
