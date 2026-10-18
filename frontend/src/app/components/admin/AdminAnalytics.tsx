import { useEffect, useState } from 'react';
import { LineChart } from 'lucide-react';
import AdminShell from './AdminShell';
import { ApiError, fetchAdminAccess, type AdminAccessSummary } from '../../lib/api';
import { logoutAdminSession, useFestival } from '../../lib/festivalStore';
import { ADMIN_PUBLIC_ACCESS } from '../../lib/adminAccess';

const countLabel = (value: number) => `${value.toLocaleString('ja-JP')} 件`;

const peakText = (access: AdminAccessSummary) => {
  if (!access.peak_slot) return 'なし';
  return `${access.peak_slot.slot}台に ${countLabel(access.peak_slot.count)}`;
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
              30分ごとの API を呼んだ回数です。来場者の人数ではありません。時刻は日本時間です。
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
            </div>

            <div className="mt-4 space-y-1.5">
              {(access.slots ?? []).length ? (
                access.slots.map((slot) => {
                  const isPeak = access.peak_slot?.slot === slot.slot;
                  const width =
                    slot.total === 0 || peakCount === 0
                      ? 0
                      : Math.max(4, Math.round((slot.total / peakCount) * 100));
                  return (
                    <div
                      key={slot.slot}
                      className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-xs"
                    >
                      <span className={isPeak ? 'font-bold text-foreground' : 'text-muted-foreground'}>
                        {slot.slot}台
                      </span>
                      <span className="h-2 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${width}%`,
                            backgroundColor: isPeak ? 'var(--accent)' : 'var(--primary)',
                          }}
                        />
                      </span>
                      <span className={isPeak ? 'font-bold text-foreground' : 'text-foreground'}>
                        {slot.total.toLocaleString('ja-JP')}件
                      </span>
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
