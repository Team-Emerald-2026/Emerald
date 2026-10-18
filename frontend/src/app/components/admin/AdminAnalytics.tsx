import { useEffect, useState } from 'react';
import { LineChart } from 'lucide-react';
import AdminShell from './AdminShell';
import {
  ApiError,
  fetchAdminAccess,
  type AdminAccessSlot,
  type AdminAccessSummary,
} from '../../lib/api';
import { logoutAdminSession, useFestival } from '../../lib/festivalStore';
import { ADMIN_PUBLIC_ACCESS } from '../../lib/adminAccess';

const BREAKDOWN = [
  { key: 'visitor', label: '来場者の画面', color: 'var(--primary)' },
  { key: 'poll', label: '5秒ごとの再取得', color: 'var(--accent)' },
  { key: 'store', label: '店舗の操作', color: 'var(--warn)' },
  { key: 'admin', label: '管理画面', color: 'var(--busy)' },
] as const;

const countLabel = (value: number) => `${value.toLocaleString('ja-JP')} 件`;

const slowLabel = (milliseconds: number) => {
  const seconds = Math.max(1, Math.round((milliseconds || 1000) / 1000));
  return `応答が${seconds}秒以上`;
};

const peakText = (access: AdminAccessSummary) => {
  if (!access.peak_slot) return 'なし';
  return `${access.peak_slot.slot}台に ${countLabel(access.peak_slot.count)}`;
};

const slotParts = (slot: AdminAccessSlot) => {
  const parts = BREAKDOWN.map((item) => ({ ...item, value: slot[item.key] }));
  const classified = parts.reduce((sum, item) => sum + item.value, 0);
  if (classified > 0 || slot.total === 0) return parts;
  return [{ key: 'total' as const, label: '合計', color: 'var(--primary)', value: slot.total }];
};

export default function AdminAnalytics() {
  const adminSession = useFestival((s) => s.adminSession);
  const [access, setAccess] = useState<AdminAccessSummary | null>(null);
  const [accessDate, setAccessDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminSession && !ADMIN_PUBLIC_ACCESS) return;
    const controller = new AbortController();

    setLoading(true);
    setError('');
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

  const peakCount = access?.peak_slot?.count ?? 0;
  const peakSlot = access?.slots.find((slot) => slot.slot === access.peak_slot?.slot);

  return (
    <AdminShell title="アナリティクス">
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <LineChart className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              API 件数
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              30分ごとの API を呼んだ回数です。来場者の画面、5秒ごとの再取得、店舗の操作、管理画面に分けています。同じ枠に、応答が1秒以上の件数とサーバーエラー（5xx）の件数も出します。これらは内訳とは別に数えるので、1件が両方に入ることがあります。来場者の人数ではありません。時刻は日本時間です。
            </p>
          </div>
          <label className="text-sm text-muted-foreground">
            日付
            <input
              type="date"
              value={accessDate}
              onChange={(event) => setAccessDate(event.target.value)}
              className="mt-1 block rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground scheme-light dark:scheme-dark"
            />
          </label>
        </div>

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
