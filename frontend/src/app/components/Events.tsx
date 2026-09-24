import { useEffect, useMemo, useState } from 'react';
import { fetchEvents, type EventNotice } from '../lib/api';
import { Skeleton } from './Skeleton';

const DEFAULT_START_HOUR = 10;
const DEFAULT_END_HOUR = 18;

function hourLabel(hour: number) {
  return `${hour}時`;
}

function eventHour(item: EventNotice): number | null {
  if (!item.starts_at) return null;
  const date = new Date(item.starts_at);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours();
}

/** 仮の学園祭時間帯：10時〜18時で固定 */
function buildHours() {
  return Array.from(
    { length: DEFAULT_END_HOUR - DEFAULT_START_HOUR + 1 },
    (_, i) => DEFAULT_START_HOUR + i,
  );
}

function ScheduleSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[4.5rem_1fr] border-b border-border last:border-b-0">
          <div className="border-r border-border bg-muted/40 px-3 py-4">
            <Skeleton className="h-4 w-10" />
          </div>
          <div className="px-3 py-4">
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 来場者向け：表示のみ。編集は /admin/events */
export default function Events() {
  const [items, setItems] = useState<EventNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetchEvents(controller.signal)
      .then(setItems)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('イベント・お知らせを取得できませんでした。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const scheduleItems = useMemo(
    () => items.filter((item) => eventHour(item) != null),
    [items],
  );
  const hours = useMemo(() => buildHours(), []);

  const eventsByHour = useMemo(() => {
    const map = new Map<number, EventNotice[]>();
    for (const item of scheduleItems) {
      const hour = eventHour(item);
      if (hour == null) continue;
      if (hour < DEFAULT_START_HOUR || hour > DEFAULT_END_HOUR) continue;
      const list = map.get(hour) ?? [];
      list.push(item);
      map.set(hour, list);
    }
    return map;
  }, [scheduleItems]);

  const unscheduledNotices = useMemo(
    () => items.filter((item) => eventHour(item) == null),
    [items],
  );

  return (
    <div className="space-y-4 p-4 pb-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">イベント</h1>
        <p className="mt-1 text-sm text-muted-foreground">本日のタイムテーブル</p>
      </div>

      {error && (
        <p className="rounded-xl border border-border bg-card p-4 text-sm" style={{ color: 'var(--busy)' }}>
          {error}
        </p>
      )}

      {loading && <ScheduleSkeleton />}

      {!loading && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-[4.5rem_1fr] border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
            <div className="border-r border-border px-3 py-2.5">時間</div>
            <div className="px-3 py-2.5">内容</div>
          </div>
          {hours.map((hour) => {
            const rowItems = eventsByHour.get(hour) ?? [];
            return (
              <div
                key={hour}
                className="grid min-h-14 grid-cols-[4.5rem_1fr] border-b border-border last:border-b-0"
              >
                <div className="flex items-start border-r border-border bg-muted/30 px-3 py-3">
                  <span className="text-sm font-bold tabular-nums text-foreground">
                    {hourLabel(hour)}
                  </span>
                </div>
                <div className="space-y-2 px-3 py-3">
                  {rowItems.length === 0 ? (
                    <span className="text-sm text-muted-foreground/50">—</span>
                  ) : (
                    rowItems.map((item) => (
                      <div key={item.id}>
                        <p className="font-display text-base font-bold text-foreground">{item.title}</p>
                        {item.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {item.body}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && unscheduledNotices.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-muted-foreground">お知らせ</h2>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {unscheduledNotices.map((item, index) => (
              <li
                key={item.id}
                className={`px-4 py-3 ${index > 0 ? 'border-t border-border' : ''}`}
              >
                <p className="font-display font-bold text-foreground">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
