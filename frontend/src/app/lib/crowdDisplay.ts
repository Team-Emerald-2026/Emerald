import type { CrowdLevel } from './api';
import type { WaitLevel } from './waitDisplay';
import { waitLevelStyle } from './waitDisplay';

export type { CrowdLevel };

export const CROWD_LEVELS = ['empty', 'moderate', 'crowded'] as const;

export const crowdLevelOptions: Array<{ value: CrowdLevel; label: string; hint: string }> = [
  { value: 'empty', label: '空いている', hint: '0〜50%' },
  { value: 'moderate', label: '少し混雑', hint: '50〜75%' },
  { value: 'crowded', label: '混雑', hint: '75〜100%' },
];

export const CROWD_TEXT_PREFIX = '__crowd__:';

export function parseCrowdLevel(value: unknown): CrowdLevel | null {
  return CROWD_LEVELS.includes(value as CrowdLevel) ? (value as CrowdLevel) : null;
}

/** 専用列が無い本番でも、待ち表示テキストに退避した値から読む */
export function parseCrowdFromStore(store: {
  crowd_level?: unknown;
  wait_display_text?: string | null;
}): CrowdLevel | null {
  const direct = parseCrowdLevel(store.crowd_level);
  if (direct) return direct;
  const text = store.wait_display_text?.trim() ?? '';
  if (text.startsWith(CROWD_TEXT_PREFIX)) {
    return parseCrowdLevel(text.slice(CROWD_TEXT_PREFIX.length));
  }
  return null;
}

export function crowdBackupText(level: CrowdLevel): string {
  return `${CROWD_TEXT_PREFIX}${level}`;
}

export function isCrowdBackupText(value: string | null | undefined): boolean {
  return (value ?? '').startsWith(CROWD_TEXT_PREFIX);
}

export function crowdLevelLabel(level: CrowdLevel): string {
  return crowdLevelOptions.find((option) => option.value === level)?.label ?? level;
}

function crowdLevelToWaitLevel(level: CrowdLevel): WaitLevel {
  switch (level) {
    case 'crowded':
      return 'busy';
    case 'moderate':
      return 'warn';
    default:
      return 'ok';
  }
}

export function crowdLevelStyle(level: CrowdLevel): { bg: string; fg: string } {
  return waitLevelStyle(crowdLevelToWaitLevel(level));
}
