import { useEffect, useRef, useState } from 'react';
import StoreShell from './StoreShell';
import { useFestival, adjustWaiting } from '../../lib/festivalStore';
import { Plus, Minus, Users, Undo2 } from 'lucide-react';
import { updateWaitTime } from '../../lib/api';

export default function StoreWaiting() {
  const waiting = useFestival((s) => s.waiting);
  const waitMinPerPerson = useFestival((s) => s.waitMinPerPerson);
  const session = useFestival((s) => s.session);
  const [flash, setFlash] = useState<string | null>(null);
  const previous = useRef<number | null>(null);

  const estimated = waiting * waitMinPerPerson;

  const syncVisitorWait = (nextCount: number) => {
    if (!session) return;
    void updateWaitTime(session.token, session.storeId, {
      current_wait_min: nextCount * waitMinPerPerson,
      current_queue_count: nextCount,
    }).catch((error) => {
      console.error('Wait time sync failed', error);
    });
  };

  const changeBy = (delta: number) => {
    const next = Math.max(0, waiting + delta);
    if (next === waiting) return;
    previous.current = waiting;
    adjustWaiting(delta);
    syncVisitorWait(next);
    setFlash(`${next}人に変更しました`);
  };

  const undo = () => {
    if (previous.current == null) return;
    const delta = previous.current - waiting;
    previous.current = null;
    adjustWaiting(delta);
    syncVisitorWait(waiting + delta);
    setFlash(null);
  };

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 4000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  return (
    <StoreShell title="待ち人数管理">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-2xl"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Users className="h-6 w-6 text-white" />
        </span>
        <p className="mt-3 text-sm text-muted-foreground">現在の待ち人数</p>
        <p className="font-display text-7xl font-bold text-foreground">{waiting}</p>
        <p className="mt-2 text-sm font-medium text-foreground">
          {waiting}人 → 推定{estimated}分
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          来場者画面には「待ち約{estimated}分」として表示されます（{waiting}人 × {waitMinPerPerson}分）。
        </p>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => changeBy(-1)}
            aria-label="待ち人数を1人減らす"
            className="flex h-16 min-w-28 flex-col items-center justify-center rounded-2xl border border-border text-foreground hover:bg-muted"
          >
            <Minus className="h-6 w-6" />
            <span className="mt-1 text-xs font-bold">1人減らす</span>
          </button>
          <button
            type="button"
            onClick={() => changeBy(1)}
            aria-label="待ち人数を1人増やす"
            className="flex h-16 min-w-28 flex-col items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Plus className="h-6 w-6" />
            <span className="mt-1 text-xs font-bold">1人増やす</span>
          </button>
        </div>

        {flash && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-foreground">
            <span>{flash}</span>
            {previous.current != null && (
              <button
                type="button"
                onClick={undo}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-bold"
                style={{ color: 'var(--primary)' }}
              >
                <Undo2 className="h-4 w-4" />
                元に戻す
              </button>
            )}
          </div>
        )}
      </div>
    </StoreShell>
  );
}
