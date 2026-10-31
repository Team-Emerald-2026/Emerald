import { EVENT_DAYS, type EventDayKey } from '../lib/eventSchedule';

interface EventDayTabsProps {
  value: EventDayKey;
  onChange: (day: EventDayKey) => void;
  /** 学園祭の「本日」（管理者が設定した日）。そのタブを強調する */
  todayKey?: EventDayKey | null;
}

/** 開催日（10月24日・10月25日）の切り替えタブ */
export default function EventDayTabs({ value, onChange, todayKey }: EventDayTabsProps) {
  return (
    <div
      className="grid gap-1 rounded-xl border border-border bg-muted/40 p-1"
      style={{ gridTemplateColumns: `repeat(${EVENT_DAYS.length}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label="開催日"
    >
      {EVENT_DAYS.map((day) => {
        const active = day.key === value;
        const isToday = todayKey != null && day.key === todayKey;

        return (
          <button
            key={day.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(day.key)}
            className={`relative rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
              active
                ? 'text-white shadow-sm'
                : isToday
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:bg-muted'
            }`}
            style={
              active
                ? { backgroundColor: 'var(--primary)' }
                : isToday
                  ? {
                      backgroundColor: 'color-mix(in srgb, var(--primary) 14%, transparent)',
                      boxShadow: 'inset 0 0 0 2px var(--primary)',
                    }
                  : undefined
            }
          >
            <span className="flex flex-col items-center gap-0.5 leading-tight">
              {isToday && (
                <span
                  className={`text-[10px] font-extrabold tracking-wide ${
                    active ? 'text-white/90' : ''
                  }`}
                  style={active ? undefined : { color: 'var(--primary)' }}
                >
                  本日
                </span>
              )}
              <span>{day.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
