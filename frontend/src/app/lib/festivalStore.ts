import { useSyncExternalStore } from 'react';

/**
 * 京都TECH学園祭 — 簡易データストア
 *
 * ブラウザの localStorage に残すのは、次の「この端末だけの状態」だけ。
 * - 店舗ログイン／管理者ログインのセッション
 * - 呼び出し画面で「大きく表示」している番号
 *
 * 注文（受付番号）・待ち人数・売上などは、すべてバックエンド API が正で、ここには持たない。
 * （以前は注文や待ち人数もここに保存していたが、サーバーに移した。古いデータは起動時に消す）
 */

interface FestivalState {
  bigNumber: string | null; // 「大きく表示」対象の受付番号（この端末の表示だけ）
  session: {
    storeId: string;
    token: string;
  } | null; // ログイン中の店舗セッション
  adminSession: {
    loginId: string;
    token: string;
  } | null; // ログイン中の管理者セッション
}

const KEY = 'kt_festival_state_v1';

/** 以前、この端末に保存していた注文・待ち人数などのキー（いまはサーバーが持つ） */
const LEGACY_KEYS = ['orders', 'counter', 'waiting', 'waitMinPerPerson'] as const;

const initialState: FestivalState = {
  bigNumber: null,
  session: null,
  adminSession: null,
};

function read(): FestivalState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<FestivalState>;
    return {
      bigNumber: typeof parsed.bigNumber === 'string' ? parsed.bigNumber : null,
      session: parsed.session ?? null,
      adminSession: parsed.adminSession ?? null,
    };
  } catch {
    return initialState;
  }
}

/**
 * 古い注文・待ち人数のデータが残っていたら消す。
 * 古い「大きく表示」の番号（A-101 など）も、いまの注文には存在しないので一緒に消す。
 */
function cleanLegacyData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!LEGACY_KEYS.some((key) => key in parsed)) return;

    for (const key of LEGACY_KEYS) delete parsed[key];
    parsed.bigNumber = null;
    localStorage.setItem(KEY, JSON.stringify(parsed));
  } catch {
    /* 壊れたデータは read() が初期値として扱う */
  }
}

if (typeof localStorage !== 'undefined') cleanLegacyData();

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
  const state = useSyncExternalStore(subscribe, getSnapshot, () => initialState);
  return selector(state);
}

/* ---- 操作（actions） ---- */

export function setBigNumber(number: string | null) {
  const s = read();
  write({ ...s, bigNumber: number });
}

export function loginStore(storeId: string, token: string) {
  const s = read();
  write({ ...s, session: { storeId, token } });
}

export function logoutStore() {
  const s = read();
  write({ ...s, session: null, bigNumber: null });
}

export function loginAdminSession(loginId: string, token: string) {
  const s = read();
  write({ ...s, adminSession: { loginId, token } });
}

export function logoutAdminSession() {
  const s = read();
  write({ ...s, adminSession: null });
}
