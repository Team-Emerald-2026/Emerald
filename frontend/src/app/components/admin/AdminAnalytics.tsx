import { useEffect, useState } from 'react';
import { LineChart, Receipt, RefreshCw } from 'lucide-react';
import AdminShell from './AdminShell';
import {
  ApiError,
  downloadAdminAccessLog,
  fetchAdminAccess,
  fetchAdminBoothSales,
  type AdminAccessSlot,
  type AdminAccessSummary,
  type BoothSales,
  type BoothSalesDay,
} from '../../lib/api';
import { logoutAdminSession, useFestival } from '../../lib/festivalStore';
import { ADMIN_PUBLIC_ACCESS } from '../../lib/adminAccess';

const BREAKDOWN = [
  { key: 'visitor', label: '来場者の画面', color: 'var(--primary)' },
  { key: 'poll', label: '5秒ごとの再取得', color: 'var(--accent)' },
  { key: 'store', label: '店舗の操作', color: 'var(--warn)' },
  { key: 'admin', label: '管理画面', color: 'var(--busy)' },
] as const;

const SALES_DAYS: Array<{ id: BoothSalesDay; label: string; hint: string }> = [
  { id: 'day1', label: '1日目', hint: '10/24' },
  { id: 'day2', label: '2日目', hint: '10/25' },
  { id: 'all', label: '全体', hint: '両日' },
];

const yen = (value: number) => `¥${value.toLocaleString('ja-JP')}`;

const countLabel = (value: number) => `${value.toLocaleString('ja-JP')} 件`;

const SALES_REFRESH_MS = 60_000;

const updatedLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
};

const hourLabel = (hour: number) => `${hour}時`;

const slowLabel = (milliseconds: number) => {
  const seconds = Math.max(1, Math.round((milliseconds || 1000) / 1000));
  return `応答が${seconds}秒以上`;
};

const peakText = (access: AdminAccessSummary) => {
  if (!access.peak_slot) return 'なし';
  return `${access.peak_slot.slot}台に ${countLabel(access.peak_slot.count)}`;
};

function SalesOperations({ sales }: { sales: BoothSales }) {
  const counts = sales.status_counts ?? [];
  const unsettled = sales.unsettled ?? [];
  const hourly = sales.hourly ?? [];
  const menu = sales.menu_ranking ?? [];
  const storeMenus = sales.store_menu_rankings ?? [];
  const peakHour = hourly.reduce((max, row) => Math.max(max, row.count), 0);
  const topUnsettled = unsettled[0]?.amount ?? 0;

  return (
    <div className="mt-6 space-y-6 border-t border-border pt-5">
      <section>
        <h3 className="font-display text-base font-bold text-foreground">店舗ごとの件数</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          精算済み、まだ精算していない会計、キャンセルの件数です。
        </p>
        {counts.length ? (
          <ul className="mt-3 space-y-2">
            {counts.map((store) => (
              <li key={store.store_id} className="rounded-xl border border-border px-3 py-3">
                <p className="truncate font-bold text-foreground">{store.store_name}</p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-muted px-2 py-2">
                    <dt className="text-muted-foreground">精算済み</dt>
                    <dd className="mt-1 font-display text-lg font-bold text-foreground">{store.settled}</dd>
                  </div>
                  <div className="rounded-lg bg-muted px-2 py-2">
                    <dt className="text-muted-foreground">未精算</dt>
                    <dd
                      className="mt-1 font-display text-lg font-bold text-foreground"
                      style={store.unsettled > 0 ? { color: 'var(--warn)' } : undefined}
                    >
                      {store.unsettled}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-muted px-2 py-2">
                    <dt className="text-muted-foreground">キャンセル</dt>
                    <dd
                      className="mt-1 font-display text-lg font-bold text-foreground"
                      style={store.canceled > 0 ? { color: 'var(--busy)' } : undefined}
                    >
                      {store.canceled}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
            店舗はまだありません。
          </p>
        )}
      </section>

      <section>
        <h3 className="font-display text-base font-bold text-foreground">未精算の金額</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          まだ精算していない会計です。金額の多い店舗から並べています。
        </p>
        {unsettled.length ? (
          <ol className="mt-3 space-y-2">
            {unsettled.map((store, index) => {
              const width =
                topUnsettled === 0 ? 0 : Math.max(4, Math.round((store.amount / topUnsettled) * 100));
              return (
                <li key={store.store_id} className="rounded-xl border border-border px-3 py-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate font-bold text-foreground">{store.store_name}</p>
                        <p className="shrink-0 font-display text-lg font-bold text-foreground">{yen(store.amount)}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{countLabel(store.count)}</p>
                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${width}%`, backgroundColor: 'var(--warn)' }}
                        />
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-3 rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
            未精算の会計はありません。
          </p>
        )}
      </section>

      <section>
        <h3 className="font-display text-base font-bold text-foreground">1時間ごとの会計件数</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          キャンセルを除いた会計を、会計した時刻（日本時間）で数えています。全体は、両日の同じ時刻を足しています。
        </p>
        {hourly.length ? (
          <div className="mt-3 space-y-2">
            {hourly.map((row) => {
              const width =
                row.count === 0 || peakHour === 0
                  ? 0
                  : Math.max(4, Math.round((row.count / peakHour) * 100));
              return (
                <div key={row.hour} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{hourLabel(row.hour)}</span>
                  <span className="block h-2 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${width}%`, backgroundColor: 'var(--primary)' }}
                    />
                  </span>
                  <span className="text-foreground">{countLabel(row.count)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
            この範囲の会計はまだありません。
          </p>
        )}
      </section>

      <section>
        <h3 className="font-display text-base font-bold text-foreground">売れ筋メニュー</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          キャンセルを除き、選んだ日の数量が多い順です。金額は明細の合計で、上位5件を全体と店舗ごとに出します。
        </p>
        <h4 className="mt-3 text-sm font-bold text-foreground">全体</h4>
        <MenuRankList items={menu} empty="この範囲の販売はまだありません。" />
        <h4 className="mt-4 text-sm font-bold text-foreground">店舗ごと</h4>
        {storeMenus.length ? (
          <div className="mt-2 space-y-3">
            {storeMenus.map((store) => (
              <div key={store.store_id}>
                <p className="text-sm font-bold text-foreground">{store.store_name}</p>
                <MenuRankList items={store.items} empty="販売はまだありません。" />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
            販売のある店舗はありません。
          </p>
        )}
      </section>
    </div>
  );
}

function MenuRankList({
  items,
  empty,
}: {
  items: NonNullable<BoothSales['menu_ranking']>;
  empty: string;
}) {
  if (!items.length) {
    return <p className="mt-2 rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ol className="mt-2 space-y-2">
      {items.map((item, index) => (
        <li key={`${item.name}-${index}`} className="rounded-xl border border-border px-3 py-2">
          <div className="flex items-start gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-foreground">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate font-bold text-foreground">{item.name}</p>
                <p className="shrink-0 text-sm font-bold text-foreground">数量 {item.quantity.toLocaleString('ja-JP')}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{yen(item.amount)}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

const slotParts = (slot: AdminAccessSlot) => {
  const parts = BREAKDOWN.map((item) => ({ ...item, value: slot[item.key] }));
  const classified = parts.reduce((sum, item) => sum + item.value, 0);
  if (classified > 0 || slot.total === 0) return parts;
  return [{ key: 'total' as const, label: '合計', color: 'var(--primary)', value: slot.total }];
};

export default function AdminAnalytics() {
  const adminSession = useFestival((s) => s.adminSession);
  const [salesDay, setSalesDay] = useState<BoothSalesDay>('all');
  const [sales, setSales] = useState<BoothSales | null>(null);
  const [salesError, setSalesError] = useState('');
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesReload, setSalesReload] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [access, setAccess] = useState<AdminAccessSummary | null>(null);
  const [accessDate, setAccessDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (!adminSession && !ADMIN_PUBLIC_ACCESS) return;
    const controller = new AbortController();

    setSalesLoading(true);
    setSalesError('');
    fetchAdminBoothSales(adminSession?.token, salesDay, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setSales(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          logoutAdminSession();
          return;
        }
        setSales((current) => (current?.day === salesDay ? current : null));
        setSalesError('売上を取得できませんでした。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setSalesLoading(false);
      });

    return () => controller.abort();
  }, [adminSession, salesDay, salesReload]);

  useEffect(() => {
    if (!autoRefresh || (!adminSession && !ADMIN_PUBLIC_ACCESS)) return;
    const id = window.setInterval(() => setSalesReload((current) => current + 1), SALES_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [adminSession, autoRefresh, salesReload]);

  useEffect(() => {
    if (!adminSession && !ADMIN_PUBLIC_ACCESS) return;
    const controller = new AbortController();

    setLoading(true);
    setError('');
    setDownloadError('');
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
        setError('アナリティクスを取得できませんでした。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [adminSession, accessDate]);

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
      setDownloadError(err instanceof ApiError ? err.message : 'アクセスログを保存できませんでした。');
    } finally {
      setDownloading(false);
    }
  };

  const peakCount = access?.peak_slot?.count ?? 0;
  const peakSlot = access?.slots.find((slot) => slot.slot === access.peak_slot?.slot);

  const visibleSales = sales?.day === salesDay ? sales : null;
  const topRevenue = visibleSales?.stores[0]?.revenue ?? 0;

  return (
    <AdminShell title="アナリティクス">
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Receipt className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            売上・会計
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={autoRefresh}
              onClick={() => setAutoRefresh((current) => !current)}
              className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                autoRefresh ? 'text-white' : 'border-border text-foreground hover:bg-muted'
              }`}
              style={autoRefresh ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : undefined}
            >
              {autoRefresh ? '1分ごとに更新中' : '1分ごとの更新は停止'}
            </button>
            <button
              type="button"
              onClick={() => setSalesReload((current) => current + 1)}
              disabled={salesLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${salesLoading ? 'animate-spin' : ''}`} />
              {salesLoading && visibleSales ? '取り直し中...' : '取り直す'}
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          ブースで精算が終わった会計です。客単価は精算済みの金額 ÷ 精算済み件数です（円未満は四捨五入）。1日目・2日目は、会計をしたときの開催日で分けます。開催日が付いていない過去の精算は「全体」だけに入ります。自動更新は1分に1回です。
        </p>
        {visibleSales?.generated_at && (
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            最終更新 {updatedLabel(visibleSales.generated_at)}
          </p>
        )}

        <div
          className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/40 p-1"
          role="tablist"
          aria-label="集計する開催日"
        >
          {SALES_DAYS.map((day) => {
            const active = salesDay === day.id;
            return (
              <button
                key={day.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSalesDay(day.id)}
                className={`rounded-lg px-2 py-2 text-sm font-bold transition-colors ${
                  active ? 'text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'
                }`}
                style={active ? { backgroundColor: 'var(--primary)' } : undefined}
              >
                <span className="block leading-tight">{day.label}</span>
                <span className={`block text-[10px] font-semibold ${active ? 'text-white/80' : ''}`}>
                  {day.hint}
                </span>
              </button>
            );
          })}
        </div>

        {salesLoading && !visibleSales && (
          <p className="mt-3 text-sm text-muted-foreground">売上を読み込み中です...</p>
        )}
        {salesError && <p className="mt-3 text-sm text-red-500">{salesError}</p>}

        {visibleSales && (
          <>
            <dl className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-muted px-3 py-3">
                <dt className="text-sm text-muted-foreground">売上</dt>
                <dd className="mt-1 font-display text-xl font-bold text-foreground sm:text-2xl">
                  {yen(visibleSales.total_revenue)}
                </dd>
              </div>
              <div className="rounded-xl bg-muted px-3 py-3">
                <dt className="text-sm text-muted-foreground">精算</dt>
                <dd className="mt-1 font-display text-xl font-bold text-foreground sm:text-2xl">
                  {countLabel(visibleSales.settled_orders)}
                </dd>
              </div>
              <div className="rounded-xl bg-muted px-3 py-3">
                <dt className="text-sm text-muted-foreground">客単価</dt>
                <dd className="mt-1 font-display text-xl font-bold text-foreground sm:text-2xl">
                  {visibleSales.settled_orders === 0 ? '—' : yen(visibleSales.average_ticket)}
                </dd>
              </div>
            </dl>

            <ol className="mt-4 space-y-2">
              {visibleSales.stores.length ? (
                visibleSales.stores.map((store, index) => {
                  const width =
                    topRevenue === 0 ? 0 : Math.max(4, Math.round((store.revenue / topRevenue) * 100));
                  return (
                    <li key={store.store_id} className="rounded-xl border border-border px-3 py-3">
                      <div className="flex items-start gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-foreground">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="truncate font-bold text-foreground">{store.store_name}</p>
                            <p className="shrink-0 font-display text-lg font-bold text-foreground">
                              {yen(store.revenue)}
                            </p>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            精算 {countLabel(store.settled_orders)}
                            <span className="px-1.5">·</span>
                            客単価 {yen(store.average_ticket)}
                          </p>
                          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${width}%`, backgroundColor: 'var(--primary)' }}
                            />
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
                  この範囲の精算はまだありません。
                </li>
              )}
            </ol>

            <SalesOperations sales={visibleSales} />
          </>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <LineChart className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              API 件数
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              30分ごとの API を呼んだ回数です。来場者の画面、5秒ごとの再取得、店舗の操作、管理画面に分けています。同じ枠に、応答が1秒以上の件数とサーバーエラー（5xx）の件数も出します。これらは内訳とは別に数えるので、1件が両方に入ることがあります。来場者の人数ではありません。時刻は日本時間です。保存するファイルは1日1つで、1行が1リクエストです。入っているのは時刻、メソッド、パス、ステータス、応答ミリ秒だけです。
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm text-muted-foreground">
              日付
              <input
                type="date"
                value={accessDate}
                onChange={(event) => setAccessDate(event.target.value)}
                className="mt-1 block rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground scheme-light dark:scheme-dark"
              />
            </label>
            <button
              type="button"
              onClick={() => void downloadLog()}
              disabled={downloading || loading || Boolean(error) || !access?.date || access.total === 0}
              className="rounded-lg border border-border px-3 py-2 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-40"
            >
              {downloading ? '保存中...' : 'この日のログを保存'}
            </button>
          </div>
        </div>
        {downloadError && <p className="mt-3 text-sm text-red-500">{downloadError}</p>}

        {loading && (
          <p className="mt-3 text-sm text-muted-foreground">アナリティクスを読み込み中です...</p>
        )}
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        {access && !error && (
          <>
            <div className="mt-4 rounded-2xl bg-muted px-4 py-3">
              <p className="text-sm text-muted-foreground">その日のピーク</p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">{peakText(access)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                合計 {countLabel(access.total)}
              </p>
              {peakSlot && BREAKDOWN.some((item) => peakSlot[item.key] > 0) && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {BREAKDOWN.map((item) => `${item.label} ${countLabel(peakSlot[item.key])}`).join('、')}
                </p>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {BREAKDOWN.map((item) => (
                <div key={item.key} className="rounded-xl border border-border px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </dt>
                  <dd className="mt-1 font-bold text-foreground">{countLabel(access[item.key])}</dd>
                </div>
              ))}
            </dl>

            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-border px-3 py-2">
                <dt className="text-muted-foreground">{slowLabel(access.slow_ms)}</dt>
                <dd
                  className="mt-1 font-bold text-foreground"
                  style={access.slow > 0 ? { color: 'var(--warn)' } : undefined}
                >
                  {countLabel(access.slow)}
                </dd>
              </div>
              <div className="rounded-xl border border-border px-3 py-2">
                <dt className="text-muted-foreground">サーバーエラー（5xx）</dt>
                <dd
                  className="mt-1 font-bold text-foreground"
                  style={access.server_error > 0 ? { color: 'var(--busy)' } : undefined}
                >
                  {countLabel(access.server_error)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 space-y-3">
              {(access.slots ?? []).length ? (
                access.slots.map((slot) => {
                  const isPeak = access.peak_slot?.slot === slot.slot;
                  const width =
                    slot.total === 0 || peakCount === 0
                      ? 0
                      : Math.max(4, Math.round((slot.total / peakCount) * 100));
                  const parts = slotParts(slot);
                  return (
                    <div key={slot.slot} className="text-xs">
                      <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-2">
                        <span className={isPeak ? 'font-bold text-foreground' : 'text-muted-foreground'}>
                          {slot.slot}台
                        </span>
                        <span className="flex h-2 overflow-hidden rounded-full bg-muted">
                          <span className="flex h-full overflow-hidden rounded-full" style={{ width: `${width}%` }}>
                            {parts.map((item) =>
                              item.value === 0 ? null : (
                                <span
                                  key={item.key}
                                  className="block h-full"
                                  style={{
                                    flex: `${item.value} 0 0`,
                                    backgroundColor: item.color,
                                  }}
                                  title={`${item.label} ${countLabel(item.value)}`}
                                />
                              ),
                            )}
                          </span>
                        </span>
                        <span className={isPeak ? 'font-bold text-foreground' : 'text-foreground'}>
                          {slot.total.toLocaleString('ja-JP')}件
                        </span>
                      </div>
                      {slot.total > 0 && BREAKDOWN.some((item) => slot[item.key] > 0) && (
                        <ul className="mt-1 grid w-full min-w-0 grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:flex sm:flex-wrap">
                          {BREAKDOWN.map((item) => (
                            <li key={item.key} className="flex min-w-0 items-center gap-1 sm:w-auto sm:whitespace-nowrap">
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="min-w-0 truncate">{item.label}</span>
                              <span className="shrink-0">{slot[item.key].toLocaleString('ja-JP')}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {slot.total > 0 && (
                        <ul className="mt-1 grid w-full min-w-0 grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <li className="flex min-w-0 items-center gap-1">
                            <span className="min-w-0 truncate">{slowLabel(access.slow_ms)}</span>
                            <span
                              className={`shrink-0 ${slot.slow > 0 ? 'font-bold' : ''}`}
                              style={slot.slow > 0 ? { color: 'var(--warn)' } : undefined}
                            >
                              {(slot.slow ?? 0).toLocaleString('ja-JP')}
                            </span>
                          </li>
                          <li className="flex min-w-0 items-center gap-1">
                            <span className="min-w-0 truncate">サーバーエラー（5xx）</span>
                            <span
                              className={`shrink-0 ${slot.server_error > 0 ? 'font-bold' : ''}`}
                              style={slot.server_error > 0 ? { color: 'var(--busy)' } : undefined}
                            >
                              {(slot.server_error ?? 0).toLocaleString('ja-JP')}
                            </span>
                          </li>
                        </ul>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
                  この日のアクセスログはまだありません。
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </AdminShell>
  );
}
