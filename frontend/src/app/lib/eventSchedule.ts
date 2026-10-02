import type { EventNotice } from './api';

/** 学園祭の開催日と開催時間（時間割・お知らせの日別表示で共通利用） */
export const EVENT_DAYS = [
  { key: '2026-10-24', label: '10/24（土）', short: '10/24', startMinutes: 11 * 60, endMinutes: 16 * 60 + 30 },
  { key: '2026-10-25', label: '10/25（日）', short: '10/25', startMinutes: 11 * 60, endMinutes: 16 * 60 },
] as const;

export type EventDay = (typeof EVENT_DAYS)[number];
export type EventDayKey = EventDay['key'];

export function getEventDay(key: string): EventDay | undefined {
  return EVENT_DAYS.find((day) => day.key === key);
}

const jstFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** 日時を日本時間の「日付（YYYY-MM-DD）」と「0時からの分」に分解する */
export function jstParts(iso: string | null | undefined): { day: string; minutes: number } | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const parts: Record<string, string> = {};
  for (const part of jstFormatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** 日にち（YYYY-MM-DD）＋時刻（HH:MM）から、日本時間として保存用の日時文字列を作る */
export function toStartsAt(day: string, time: string): string {
  return new Date(`${day}T${time}:00+09:00`).toISOString();
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 表示用の時刻（先頭の0なし）例: 11:00 / 14:30 */
export function timeLabel(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** 今日が開催日ならその日、そうでなければ初日 */
export function defaultDayKey(): EventDayKey {
  const today = jstParts(new Date().toISOString())?.day;
  return EVENT_DAYS.find((day) => day.key === today)?.key ?? EVENT_DAYS[0].key;
}

export type ClassifiedItem =
  | { kind: 'schedule'; item: EventNotice; day: EventDayKey; minutes: number }
  | { kind: 'notice'; item: EventNotice; day: EventDayKey | null }
  | { kind: 'orphan'; item: EventNotice };

/** 時間割（イベント）／お知らせ／日程外 に振り分ける */
export function classifyItem(item: EventNotice): ClassifiedItem {
  const parts = jstParts(item.starts_at);
  const day = parts ? getEventDay(parts.day) : undefined;

  if (item.type === 'notice') {
    if (!item.starts_at) return { kind: 'notice', item, day: null };
    if (parts && day) return { kind: 'notice', item, day: day.key };
    return { kind: 'orphan', item };
  }

  if (parts && day) {
    return { kind: 'schedule', item, day: day.key, minutes: parts.minutes };
  }
  return { kind: 'orphan', item };
}

export interface TimetableRow {
  hour: number;
  /** ちょうど :00 のイベント */
  exact: EventNotice[];
  /** :30 など、その時間と次の時間の間に置くイベント（分の昇順） */
  between: { minutes: number; item: EventNotice }[];
}

/**
 * 1日分の時間割の行を作る。
 * 毎時間の行は常に出し、分つきのイベントはその時間の下に差し込む。
 * 開催時間の外にイベントがあれば、その時間の行も追加して見落とさないようにする。
 */
export function buildTimetableRows(
  classified: ClassifiedItem[],
  dayKey: EventDayKey,
): TimetableRow[] {
  const day = getEventDay(dayKey);
  if (!day) return [];

  const entries = classified.filter(
    (c): c is Extract<ClassifiedItem, { kind: 'schedule' }> => c.kind === 'schedule' && c.day === dayKey,
  );

  let startHour = Math.floor(day.startMinutes / 60);
  let endHour = Math.floor(day.endMinutes / 60);
  for (const entry of entries) {
    const hour = Math.floor(entry.minutes / 60);
    startHour = Math.min(startHour, hour);
    endHour = Math.max(endHour, hour);
  }

  const rows: TimetableRow[] = [];
  for (let hour = startHour; hour <= endHour; hour += 1) {
    const inHour = entries
      .filter((entry) => Math.floor(entry.minutes / 60) === hour)
      .sort((a, b) => a.minutes - b.minutes || Number(a.item.id) - Number(b.item.id));
    rows.push({
      hour,
      exact: inHour.filter((entry) => entry.minutes % 60 === 0).map((entry) => entry.item),
      between: inHour
        .filter((entry) => entry.minutes % 60 !== 0)
        .map((entry) => ({ minutes: entry.minutes, item: entry.item })),
    });
  }
  return rows;
}

/** 選んだ日のお知らせ（日にちなし＝両日共通を含む） */
export function noticesForDay(classified: ClassifiedItem[], dayKey: EventDayKey): EventNotice[] {
  return classified
    .filter((c): c is Extract<ClassifiedItem, { kind: 'notice' }> => c.kind === 'notice')
    .filter((c) => c.day === null || c.day === dayKey)
    .map((c) => c.item);
}
