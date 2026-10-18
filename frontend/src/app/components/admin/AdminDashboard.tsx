import { useEffect, useState } from 'react';
import { BarChart3, Receipt, Store, Trash2 } from 'lucide-react';
import AdminShell from './AdminShell';
import {
  ApiError,
  downloadAdminAccessLog,
  fetchAdminAccess,
  fetchAdminAnalytics,
  resetAdminSales,
  type AdminAccessSummary,
  type AdminAnalytics,
} from '../../lib/api';
import { logoutAdminSession, useFestival } from '../../lib/festivalStore';
import { ADMIN_PUBLIC_ACCESS } from '../../lib/adminAccess';

const yen = (value: number) => `¥${value.toLocaleString('ja-JP')}`;

const RESET_CONFIRM_TEXT = 'リセット';

export default function AdminDashboard() {
  const adminSession = useFestival((s) => s.adminSession);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetDone, setResetDone] = useState(false);
  const [access, setAccess] = useState<AdminAccessSummary | null>(null);
  const [accessDate, setAccessDate] = useState('');
  const [accessError, setAccessError] = useState('');
  const [accessLoading, setAccessLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (!adminSession && !ADMIN_PUBLIC_ACCESS) return;
    const controller = new AbortController();

    setLoading(true);
    setError('');
    fetchAdminAnalytics(adminSession?.token, controller.signal)
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
  }, [adminSession, reloadKey]);

  useEffect(() => {
    if (!adminSession && !ADMIN_PUBLIC_ACCESS) return;
    const controller = new AbortController();

    setAccessLoading(true);
    setAccessError('');
    fetchAdminAccess(adminSession?.token, accessDate || undefined, controller.signal)
      .then((data) => {
        setAccess(data);
        if (data?.date && !accessDate) setAccessDate(data.date);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          logoutAdminSession();
          return;
        }
        setAccessError('アクセス状況を取得できませんでした。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setAccessLoading(false);
      });

    return () => controller.abort();
  }, [adminSession, accessDate, reloadKey]);

  const downloadLog = async () => {
    if (!access?.date || access.total === 0) return;
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadAdminAccessLog(adminSession?.token, access.date);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logoutAdminSession();
        return;
      }
      setDownloadError(err instanceof ApiError ? err.message : 'アクセスログをダウンロードできませんでした。');
    } finally {
      setDownloading(false);
    }
  };

  const canReset = resetText.trim() === RESET_CONFIRM_TEXT && !resetting;

  const closeReset = () => {
    setResetOpen(false);
    setResetText('');
    setResetError('');
  };

  const reset = async () => {
    if (!canReset) return;
    setResetting(true);
    setResetError('');
    try {
      await resetAdminSales(adminSession?.token);
      closeReset();
      setResetDone(true);
      setReloadKey((key) => key + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logoutAdminSession();
        return;
      }
      setResetError('リセットできませんでした。もう一度お試しください。');
    } finally {
      setResetting(false);
    }
  };

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

      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">サーバーのアクセス</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              API を呼んだ回数です。来場者の人数ではありません。時刻は日本時間です。
            </p>
          </div>
          <label className="text-sm text-muted-foreground">
            日付
            <input
              type="date"
              value={accessDate}
              onChange={(event) => setAccessDate(event.target.value)}
              className="mt-1 block rounded-lg border border-border bg-white px-3 py-2 text-base text-foreground"
            />
          </label>
        </div>

        {accessLoading && (
          <p className="mt-3 text-sm text-muted-foreground">アクセス状況を読み込み中です...</p>
        )}
        {accessError && <p className="mt-3 text-sm text-red-500">{accessError}</p>}

        {access && !accessError && (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <p className="rounded-xl bg-muted px-3 py-2 text-sm text-foreground">
                合計 <span className="font-display text-lg font-bold">{access.total}</span> 件
              </p>
              <p className="rounded-xl bg-muted px-3 py-2 text-sm text-foreground">
                ピーク{' '}
                <span className="font-display text-lg font-bold">
                  {access.peak ? `${Number(access.peak.hour)}時台 ${access.peak.count}件` : 'なし'}
                </span>
              </p>
              <p className="rounded-xl bg-muted px-3 py-2 text-sm text-foreground">
                サーバーエラー <span className="font-bold">{access.server_error}</span> 件
              </p>
              <p className="rounded-xl bg-muted px-3 py-2 text-sm text-foreground">
                応答が{Math.round(access.slow_ms / 1000)}秒以上 <span className="font-bold">{access.slow}</span> 件
              </p>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-xl border border-border px-3 py-2">
                <dt className="text-muted-foreground">来場者の画面</dt>
                <dd className="font-bold text-foreground">{access.visitor}件</dd>
              </div>
              <div className="rounded-xl border border-border px-3 py-2">
                <dt className="text-muted-foreground">定期的な再取得</dt>
                <dd className="font-bold text-foreground">{access.poll}件</dd>
              </div>
              <div className="rounded-xl border border-border px-3 py-2">
                <dt className="text-muted-foreground">店舗の操作</dt>
                <dd className="font-bold text-foreground">{access.store}件</dd>
              </div>
              <div className="rounded-xl border border-border px-3 py-2">
                <dt className="text-muted-foreground">管理画面</dt>
                <dd className="font-bold text-foreground">{access.admin}件</dd>
              </div>
            </dl>

            <div className="mt-4 space-y-1.5">
              {access.hours.length ? (
                access.hours.map((hour) => {
                  const max = access.peak?.count || 1;
                  return (
                    <div key={hour.hour} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{Number(hour.hour)}時台</span>
                      <span className="h-2 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-[var(--primary)]"
                          style={{ width: `${Math.max(4, Math.round((hour.total / max) * 100))}%` }}
                        />
                      </span>
                      <span className="text-foreground">{hour.total}件</span>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
                  この日のアクセスログはまだありません。
                </p>
              )}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => void downloadLog()}
                disabled={downloading || access.total === 0}
                className="rounded-lg border border-border px-3 py-2 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-40"
              >
                {downloading ? 'ダウンロード中...' : 'この日のログをテキストで保存'}
              </button>
              {downloadError && <p className="mt-2 text-sm text-red-500">{downloadError}</p>}
            </div>
          </>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-bold text-foreground">売上データのリセット</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          本番前に、テストで入れた会計・売上をすべて消して 0 に戻します。店舗・メニュー・ログイン情報は消えません。
          各店舗の待ち人数も 0 に戻り、受取番号は 1 から振り直されます。
        </p>

        {resetDone && !resetOpen && (
          <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-foreground">リセットしました。</p>
        )}

        {!resetOpen ? (
          <button
            type="button"
            onClick={() => {
              setResetDone(false);
              setResetOpen(true);
            }}
            className="mt-3 flex items-center gap-1.5 rounded-lg border border-red-500 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            売上データをリセット
          </button>
        ) : (
          <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3">
            <p className="text-sm font-bold text-red-700">この操作は元に戻せません。</p>
            <p className="mt-1 text-sm text-red-700">
              続けるには、下の欄に「{RESET_CONFIRM_TEXT}」と入力してください。
            </p>
            <input
              type="text"
              value={resetText}
              onChange={(event) => setResetText(event.target.value)}
              placeholder={RESET_CONFIRM_TEXT}
              aria-label="確認のため「リセット」と入力"
              className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-base text-foreground"
            />
            {resetError && <p className="mt-2 text-sm text-red-600">{resetError}</p>}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={closeReset}
                disabled={resetting}
                className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm font-bold text-foreground disabled:opacity-50"
              >
                やめる
              </button>
              <button
                type="button"
                onClick={() => void reset()}
                disabled={!canReset}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {resetting ? 'リセット中...' : 'リセットする'}
              </button>
            </div>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
