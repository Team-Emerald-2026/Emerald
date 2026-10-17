import type { CrowdLevel } from './api';
import type { WaitLevel } from './waitDisplay';
import { waitLevelStyle } from './waitDisplay';

export type { CrowdLevel };

export const CROWD_LEVELS = ['empty', 'moderate', 'crowded'] as const;

export const crowdLevelOptions: Array<{ value: CrowdLevel; label: string }> = [
  { value: 'empty', label: 'すいている' },
  { value: 'moderate', label: '少し混雑' },
  { value: 'crowded', label: '混雑' },
];

export function parseCrowdLevel(value: unknown): CrowdLevel | null {
  return CROWD_LEVELS.includes(value as CrowdLevel) ? (value as CrowdLevel) : null;
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
