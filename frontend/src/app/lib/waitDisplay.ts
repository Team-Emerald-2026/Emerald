import type { BackendStore } from './api';

/** この人数以上で「混んでいる」（色を変える・人気ブースとして扱う） */
export const BUSY_QUEUE_COUNT = 8;
/** この人数以上で「やや混んでいる」 */
export const WARN_QUEUE_COUNT = 5;

export type WaitLevel = 'ok' | 'warn' | 'busy' | 'text' | 'closed';

export interface WaitDisplay {
  /** 画面に出す文言（例: 「待ち3人」「待ちなし」「13時開始」） */
  label: string;
  /** 色分け用 */
  level: WaitLevel;
  /** 待ち人数（並べ替えや人気判定用） */
  queueCount: number;
}

type WaitSource = Pick<
  BackendStore,
  'is_open' | 'current_queue_count' | 'wait_display_mode' | 'wait_display_text'
>;

/** 来場者画面に出す「待ち人数」の表示。文字表示モードのときは、設定された文字を優先する */
export function getWaitDisplay(store: WaitSource): WaitDisplay {
  const count = Number(store.current_queue_count);
  const queueCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;

  const text = store.wait_display_text?.trim();
  if (store.wait_display_mode === 'text' && text && !text.startsWith('__crowd__:')) {
    return { label: text, level: 'text', queueCount };
  }

  if (!store.is_open) {
    return { label: '準備中', level: 'closed', queueCount };
  }

  if (queueCount === 0) {
    return { label: '待ちなし', level: 'ok', queueCount };
  }

  const level: WaitLevel =
    queueCount >= BUSY_QUEUE_COUNT ? 'busy' : queueCount >= WARN_QUEUE_COUNT ? 'warn' : 'ok';
  return { label: `待ち${queueCount}人`, level, queueCount };
}

/** 色分け（Attractions / Home / Restaurants で共通） */
export function waitLevelStyle(level: WaitLevel): { bg: string; fg: string } {
  switch (level) {
    case 'busy':
      return { bg: 'var(--busy-soft)', fg: 'var(--busy)' };
    case 'warn':
      return { bg: 'var(--warn-soft)', fg: 'var(--warn)' };
    case 'text':
      return { bg: 'var(--muted)', fg: 'var(--foreground)' };
    case 'closed':
      return { bg: 'var(--muted)', fg: 'var(--muted-foreground)' };
    default:
      return { bg: 'var(--ok-soft)', fg: 'var(--ok)' };
  }
}
