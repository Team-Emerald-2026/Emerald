import { Fragment, useEffect, useMemo, useState } from 'react';
import { fetchEvents, type EventNotice } from '../lib/api';
import {
  EVENT_DAYS,
  buildTimetableRows,
  classifyItem,
  defaultDayKey,
  getEventDay,
  minutesToTime,
  noticesForDay,
  timeLabel,
  type EventDayKey,
} from '../lib/eventSchedule';
import EventDayTabs from './EventDayTabs';
import { Skeleton } from './Skeleton';

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

function EventContent({ item }: { item: EventNotice }) {
  return (
    <div>
      <p className="font-display text-base font-bold text-foreground">{item.title}</p>
      {item.body && (
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
      )}
    </div>
  );
}

/** 来場者向け：表示のみ。編集は /admin/events */
export default function Events() {
  const [items, setItems] = useState<EventNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dayKey, setDayKey] = useState<EventDayKey>(defaultDayKey);

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

  const classified = useMemo(() => items.map(classifyItem), [items]);
  const rows = useMemo(() => buildTimetableRows(classified, dayKey), [classified, dayKey]);
  const notices = useMemo(() => noticesForDay(classified, dayKey), [classified, dayKey]);
  const day = getEventDay(dayKey) ?? EVENT_DAYS[0];

  return (
    <div className="space-y-4 p-4 pb-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">イベント</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          タイムテーブル（{minutesToTime(day.startMinutes)}〜{minutesToTime(day.endMinutes)}）
        </p>
      </div>

      <EventDayTabs value={dayKey} onChange={setDayKey} />

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
          {rows.map((row) => (
            <Fragment key={row.hour}>
              <div className="grid min-h-14 grid-cols-[4.5rem_1fr] border-b border-border last:border-b-0">
                <div className="flex items-start border-r border-border bg-muted/30 px-3 py-3">
                  <span className="text-sm font-bold tabular-nums text-foreground">
                    {timeLabel(row.hour * 60)}
                  </span>
                </div>
                <div className="space-y-2 px-3 py-3">
                  {row.exact.length === 0 ? (
                    <span className="text-sm text-muted-foreground/50">—</span>
                  ) : (
                    row.exact.map((item) => <EventContent key={item.id} item={item} />)
                  )}
                </div>
              </div>
              {row.between.map(({ minutes, item }) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[4.5rem_1fr] border-b border-border bg-primary/5 last:border-b-0"
                >
                  <div className="flex items-start justify-end border-r border-border px-3 py-3">
                    <span className="text-xs font-bold tabular-nums text-muted-foreground">
                      {timeLabel(minutes)}
                    </span>
                  </div>
                  <div className="border-l-2 px-3 py-3" style={{ borderColor: 'var(--primary)' }}>
                    <EventContent item={item} />
                  </div>
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      )}

      {!loading && notices.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-muted-foreground">お知らせ</h2>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {notices.map((item, index) => (
              <li key={item.id} className={`px-4 py-3 ${index > 0 ? 'border-t border-border' : ''}`}>
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
