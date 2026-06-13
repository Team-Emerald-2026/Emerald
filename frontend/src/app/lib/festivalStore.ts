import { useSyncExternalStore } from 'react';

/**
 * 京都TECH学園祭 — 簡易データストア
 *
 * バックエンド未接続のため、注文（受付番号）と店舗セッションを localStorage に保持する。
 * 来場者の「注文を決定」で受付番号を発行し、店舗側の提供待ち一覧・受付番号表示・
 * ダッシュボードがその番号を共有する。
 *
 * 仕様（docs/frontend.md「現在の制約」）どおり、永続DB・WebSocket同期は未実装。
 * 同一ブラウザ内での状態共有のみをサポートする。
 */

export type OrderStatus = 'waiting' | 'called' | 'served';

export interface OrderItem {
  name: string;
  qty: number;
  store: string;
}

export interface Order {
  number: string; // 例: A-101
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: number;
  servedAt?: number;
}

interface FestivalState {
  orders: Order[];
  counter: number; // 直近に発行した番号の連番（初期 100）
  bigNumber: string | null; // 「大きく表示」対象の番号
  waiting: number; // 店舗側の手動待ち人数カウンタ
  session: string | null; // ログイン中の店舗ID
}

const KEY = 'kt_festival_state_v1';

const initialState: FestivalState = {
  orders: [],
  counter: 100,
  bigNumber: null,
  waiting: 0,
  session: null,
};

function read(): FestivalState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState;
    return { ...initialState, ...(JSON.parse(raw) as FestivalState) };
  } catch {
    return initialState;
  }
}

let cache: FestivalState = typeof localStorage !== 'undefined' ? read() : initialState;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function write(next: FestivalState) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 容量超過等は無視（デモ用途） */
  }
  emit();
}

// 別タブでの変更にも追随する
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      cache = read();
      emit();
    }
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return cache;
}

/** コンポーネントから状態を購読する */
export function useFestival<T>(selector: (s: FestivalState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(initialState),
  );
}

/* ---- 操作（actions） ---- */

/** 受付番号を発行して提供待ちに追加。発行した番号を返す。 */
export function issueOrder(items: OrderItem[], total: number): string {
  const s = read();
  const next = s.counter + 1;
  const number = `A-${next}`;
  const order: Order = {
    number,
    items,
    total,
    status: 'waiting',
    createdAt: Date.now(),
  };
  write({ ...s, counter: next, orders: [...s.orders, order] });
  return number;
}

export function setOrderStatus(number: string, status: OrderStatus) {
  const s = read();
  write({
    ...s,
    orders: s.orders.map((o) =>
      o.number === number
        ? { ...o, status, servedAt: status === 'served' ? Date.now() : o.servedAt }
        : o,
    ),
  });
}

export function setBigNumber(number: string | null) {
  const s = read();
  write({ ...s, bigNumber: number });
}

export function adjustWaiting(delta: number) {
  const s = read();
  write({ ...s, waiting: Math.max(0, s.waiting + delta) });
}

export function loginStore(storeId: string) {
  const s = read();
  write({ ...s, session: storeId });
}

export function logoutStore() {
  const s = read();
  write({ ...s, session: null });
}

/* ---- セレクタ ---- */
export const selectWaitingOrders = (s: FestivalState) =>
  s.orders.filter((o) => o.status !== 'served');
export const selectServedOrders = (s: FestivalState) =>
  s.orders.filter((o) => o.status === 'served');
export const selectLatestNumber = (s: FestivalState) =>
  s.orders.length ? s.orders[s.orders.length - 1].number : null;
