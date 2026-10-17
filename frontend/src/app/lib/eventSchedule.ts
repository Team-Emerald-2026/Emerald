import type { EventNotice } from './api';

/** 学園祭の開催日と開催時間（時間割・お知らせ・ブース日別表示で共通利用） */
export const EVENT_DAYS = [
  { key: '2026-10-24', label: '10月24日(土)', short: '10/24', festivalDay: 'day1', startMinutes: 11 * 60, endMinutes: 16 * 60 + 30 },
  { key: '2026-10-25', label: '10月25日(日)', short: '10/25', festivalDay: 'day2', startMinutes: 11 * 60, endMinutes: 16 * 60 },
  // 当日以外で先生に見せるとき: 下を1行足してデプロイ。見終わったら消す。
  // { key: '2026-10-15', label: '10月15日(木)', short: '10/15', festivalDay: 'day1', startMinutes: 11 * 60, endMinutes: 16 * 60 + 30 },
] as const;

export type EventDay = (typeof EVENT_DAYS)[number];
export type EventDayKey = EventDay['key'];
export type FestivalDayKey = EventDay['festivalDay'];

export function eventKeyToFestivalDay(key: EventDayKey): FestivalDayKey {
  return getEventDay(key)?.festivalDay ?? EVENT_DAYS[0].festivalDay;
}

export function festivalDayToEventKey(day: FestivalDayKey | string | null | undefined): EventDayKey {
  return EVENT_DAYS.find((item) => item.festivalDay === day)?.key ?? EVENT_DAYS[0].key;
}

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

/**
 * お知らせの時間帯表示（例: 12:00〜14:00 / 12:00〜 / 〜14:00）。
 * 時間の指定がない（開始が0:00で終了もない）ときは null。
 */
export function noticeTimeRangeLabel(item: EventNotice): string | null {
  const start = jstParts(item.starts_at);
  if (!start) return null;

  const end = jstParts(item.ends_at);
  const from = start.minutes !== 0 ? timeLabel(start.minutes) : null;
  const to = end && end.minutes !== 0 ? timeLabel(end.minutes) : null;
  if (!from && !to) return null;

  return `${from ?? ''}〜${to ?? ''}`;
}

/**
 * いまホームに出しておいてよいか。
 * - 日付指定あり: その日だけ（10/24 のお知らせは 10/15 には出さない）
 * - 時間指定あり: その時間のあいだだけ
 * - 日付なし（両日共通）: 時間の指定が無ければいつでも出す
 */
export function isNoticeVisibleAt(item: EventNotice, at: Date = new Date()): boolean {
  if (item.type && item.type !== 'notice') return false;

  const nowMs = at.getTime();
  const now = jstParts(at.toISOString());
  if (!now) return false;

  const start = jstParts(item.starts_at);
  if (start && start.day !== now.day) return false;

  if (item.starts_at && start && start.minutes !== 0 && nowMs < new Date(item.starts_at).getTime()) {
    return false;
  }
  if (item.ends_at && nowMs > new Date(item.ends_at).getTime()) {
    return false;
  }
  return true;
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

/** 時間割の1行の長さ（分） */
export const TIMETABLE_SLOT_MINUTES = 30;

export interface TimetableRow {
  /** 行の時刻（0時からの分。30分きざみ） */
  minutes: number;
  /** ちょうどこの時刻に始まるイベント（同じ時刻に複数あってもよい） */
  exact: EventNotice[];
  /** 14:15 など、この行と次の行の間に始まるイベント（分の昇順） */
  between: { minutes: number; item: EventNotice }[];
}

/**
 * 1日分の時間割の行を作る。
 * 30分ごとの行は常に出し、半端な時刻のイベントはその行の下に差し込む。
 * 開催時間の外にイベントがあれば、その時間の行も追加して見落とさないようにする。
 */
export function buildTimetableRows(
  classified: ClassifiedItem[],
  dayKey: EventDayKey,
): TimetableRow[] {
  const day = getEventDay(dayKey);
  if (!day) return [];

  const slotOf = (minutes: number) => Math.floor(minutes / TIMETABLE_SLOT_MINUTES) * TIMETABLE_SLOT_MINUTES;

  const entries = classified.filter(
    (c): c is Extract<ClassifiedItem, { kind: 'schedule' }> => c.kind === 'schedule' && c.day === dayKey,
  );

  let firstSlot = slotOf(day.startMinutes);
  let lastSlot = slotOf(day.endMinutes);
  for (const entry of entries) {
    firstSlot = Math.min(firstSlot, slotOf(entry.minutes));
    lastSlot = Math.max(lastSlot, slotOf(entry.minutes));
  }

  const rows: TimetableRow[] = [];
  for (let slot = firstSlot; slot <= lastSlot; slot += TIMETABLE_SLOT_MINUTES) {
    const inSlot = entries
      .filter((entry) => slotOf(entry.minutes) === slot)
      .sort((a, b) => a.minutes - b.minutes || Number(a.item.id) - Number(b.item.id));
    rows.push({
      minutes: slot,
      exact: inSlot.filter((entry) => entry.minutes === slot).map((entry) => entry.item),
      between: inSlot
        .filter((entry) => entry.minutes !== slot)
        .map((entry) => ({ minutes: entry.minutes, item: entry.item })),
    });
  }
  return rows;
}

/** イベントの開催時間（例: 14:00〜15:00 / 終わりの指定がなければ 14:00〜） */
export function eventTimeRangeLabel(item: EventNotice): string | null {
  const start = jstParts(item.starts_at);
  if (!start) return null;
  const end = jstParts(item.ends_at);
  return `${timeLabel(start.minutes)}〜${end ? timeLabel(end.minutes) : ''}`;
}

/** イベントの場所（例: 8F・801）。場所がなければ null */
export function eventLocationLabel(item: EventNotice): string | null {
  return item.location ? `${item.location.floor}F・${item.location.name}` : null;
}

/** 校内マップでその場所を開くリンク */
export function eventLocationMapPath(item: EventNotice): string | null {
  return item.location ? `/map?facility=${item.location.id}&floor=${item.location.floor}F` : null;
}

/** 選んだ日のお知らせ（日にちなし＝両日共通を含む） */
export function noticesForDay(classified: ClassifiedItem[], dayKey: EventDayKey): EventNotice[] {
  return classified
    .filter((c): c is Extract<ClassifiedItem, { kind: 'notice' }> => c.kind === 'notice')
    .filter((c) => c.day === null || c.day === dayKey)
    .map((c) => c.item);
}
