import { EVENT_DAYS, type EventDayKey } from '../lib/eventSchedule';

interface EventDayTabsProps {
  value: EventDayKey;
  onChange: (day: EventDayKey) => void;
}

/** 開催日（10/24・10/25）の切り替えタブ */
export default function EventDayTabs({ value, onChange }: EventDayTabsProps) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/40 p-1" role="tablist">
      {EVENT_DAYS.map((day) => {
        const active = day.key === value;
        return (
          <button
            key={day.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(day.key)}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              active ? 'text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'
            }`}
            style={active ? { backgroundColor: 'var(--primary)' } : undefined}
          >
            {day.label}
          </button>
        );
      })}
    </div>
  );
}
