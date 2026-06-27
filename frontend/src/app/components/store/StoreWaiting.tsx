import StoreShell from './StoreShell';
import { useFestival, adjustWaiting } from '../../lib/festivalStore';
import { Plus, Minus, Users } from 'lucide-react';

export default function StoreWaiting() {
  const waiting = useFestival((s) => s.waiting);

  return (
    <StoreShell title="待ち人数管理">
      <div className="mx-auto max-w-sm rounded-3xl border border-border bg-card p-8 text-center">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-2xl"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Users className="h-6 w-6 text-white" />
        </span>
        <p className="mt-3 text-sm text-muted-foreground">現在の待ち人数</p>
        <p className="font-display text-7xl font-bold text-foreground">{waiting}</p>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => adjustWaiting(-1)}
            aria-label="待ち人数を1減らす"
            className="grid h-16 w-16 place-items-center rounded-2xl border border-border text-foreground hover:bg-muted"
          >
            <Minus className="h-7 w-7" />
          </button>
          <button
            type="button"
            onClick={() => adjustWaiting(1)}
            aria-label="待ち人数を1増やす"
            className="grid h-16 w-16 place-items-center rounded-2xl text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Plus className="h-7 w-7" />
          </button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          連打しても1ずつ確実に反映されます。
        </p>
      </div>
    </StoreShell>
  );
}
