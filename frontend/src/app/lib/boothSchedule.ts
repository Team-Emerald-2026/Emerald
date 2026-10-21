import type { BoothTimeSlot, FestivalDay } from './api';

type Slot = { start: string; end: string };

/** 出展時間の状態。always=時間指定なし / none=その日は出展しない */
export type SlotState =
  | { kind: 'always' }
  | { kind: 'active'; until: string }
  | { kind: 'upcoming'; from: string }
  | { kind: 'ended' }
  | { kind: 'none' };

/** その日の時間帯（開始が早い順）。day が null の時間帯は両日に当てはまる */
export function slotsForDay(slots: BoothTimeSlot[] | undefined, day: FestivalDay): Slot[] {
  return (slots ?? [])
    .filter((slot) => slot.day === null || slot.day === day)
    .map(({ start, end }) => ({ start, end }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** 「11:00〜13:00 / 15:00〜16:30」 */
export function formatSlots(slots: Slot[]): string {
  return slots.map((slot) => `${slot.start}〜${slot.end}`).join(' / ');
}

/** 今の日本時間 "HH:MM"（端末のタイムゾーンに関係なく） */
export function japanNowHm(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * 同じ教室に複数のブースがあるとき、地図のピンに出す順番（小さいほど優先）。
 * 本日なら「今出展中 → 一日中 → これから（早い順）→ 終了（遅く終わった順）」。別の日なら開始が早い順。
 */
export function pinRank(daySlots: Slot[], isToday: boolean, nowHm: string): [number, string] {
  if (daySlots.length === 0) return [1, ''];
  if (!isToday) return [2, daySlots[0].start];

  const active = daySlots.find((slot) => slot.start <= nowHm && nowHm < slot.end);
  if (active) return [0, active.start];
  const next = daySlots.find((slot) => nowHm < slot.start);
  if (next) return [2, next.start];
  const [hour, minute] = daySlots[daySlots.length - 1].end.split(':').map(Number);
  return [3, String(1440 - (hour * 60 + minute)).padStart(4, '0')];
}

export function compareRank(a: [number, string], b: [number, string]): number {
  return a[0] - b[0] || a[1].localeCompare(b[1]);
}

/**
 * 出展時間の状態を返す。isToday が false（別の日を見ている）なら時刻では判定しない。
 * hasAnySlots は、どの日にも時間帯が無い（一日中出展）かどうかの判定に使う。
 */
export function slotState(
  allSlots: BoothTimeSlot[] | undefined,
  day: FestivalDay,
  isToday: boolean,
  nowHm: string,
): SlotState {
  if (!allSlots || allSlots.length === 0) return { kind: 'always' };
  const today = slotsForDay(allSlots, day);
  if (today.length === 0) return { kind: 'none' };
  if (!isToday) return { kind: 'upcoming', from: today[0].start };

  const active = today.find((slot) => slot.start <= nowHm && nowHm < slot.end);
  if (active) return { kind: 'active', until: active.end };
  const next = today.find((slot) => nowHm < slot.start);
  if (next) return { kind: 'upcoming', from: next.start };
  return { kind: 'ended' };
}
