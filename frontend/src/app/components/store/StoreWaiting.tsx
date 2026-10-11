import { useCallback, useEffect, useRef, useState } from 'react';
import StoreShell from './StoreShell';
import { useFestival, logoutStore } from '../../lib/festivalStore';
import { Plus, Minus, Users, Undo2 } from 'lucide-react';
import { ApiError, fetchBoothDashboard, updateWaitTime } from '../../lib/api';

/** サーバーの待ち人数を取りに行く間隔（ミリ秒） */
const POLL_INTERVAL_MS = 5000;

/**
 * 待ち人数の管理。
 * 待ち人数はサーバーの値が正で、レジで会計すると +1、提供済みにすると -1 される。
 * ここの「増やす／減らす」は、数え違いを直すための手動の補正。
 */
export default function StoreWaiting() {
  const session = useFestival((s) => s.session);
  const token = session?.token;

  const [count, setCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [flash, setFlash] = useState<string | null>(null);
  /** 直前の補正（「元に戻す」で打ち消す用）。+1 / -1 */
  const [lastDelta, setLastDelta] = useState<number | null>(null);

  // 待ち人数をサーバーから定期的に取得する（レジの会計・提供済みの変化にも追随する）
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      try {
        const dashboard = await fetchBoothDashboard(token, signal);
        if (signal?.aborted) return;
        if (!dashboard) {
          setLoadError('待ち人数を取得できませんでした。');
          return;
        }
        // 補正の送信中は、古い値で表示が戻らないよう上書きしない
        if (!busyRef.current) setCount(Number(dashboard.current_queue_count) || 0);
        setLoadError('');
      } catch (err) {
        if (signal?.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          logoutStore();
          return;
        }
        setLoadError('待ち人数を取得できませんでした。通信状況を確認してください。');
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(controller.signal);
    }, POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [token, load]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 4000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  /** サーバーの最新の値に +1 / -1 する（レジの操作と同時でも数え違いが起きない） */
  const changeBy = async (delta: number, isUndo = false) => {
    if (!token || busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setActionError('');

    try {
      const updated = await updateWaitTime(token, { current_queue_delta: delta });
      setCount(Number(updated.current_queue_count) || 0);
      if (isUndo) {
        setLastDelta(null);
        setFlash(null);
      } else {
        setLastDelta(delta);
        setFlash(`${updated.current_queue_count}人に変更しました`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logoutStore();
        return;
      }
      setActionError('待ち人数を変更できませんでした。もう一度お試しください。');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const waiting = count ?? 0;
  const canDecrease = count !== null && count > 0;

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
        <p className="font-display text-7xl font-bold text-foreground">
          {count === null ? '--' : waiting}
        </p>
        {count !== null && (
          <p className="mt-2 text-xs text-muted-foreground">
            来場者画面には「待ち{waiting}人」として表示されます。
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          レジで会計すると1人増え、提供済みにすると1人減ります。数え違いを直したいときだけ、下のボタンで補正してください。
        </p>

        {loadError && <p className="mt-3 text-xs text-red-500">{loadError}</p>}
        {actionError && (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {actionError}
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => void changeBy(-1)}
            disabled={busy || !canDecrease}
            aria-label="待ち人数を1人減らす"
            className="flex h-16 min-w-28 flex-col items-center justify-center rounded-2xl border border-border text-foreground hover:bg-muted disabled:opacity-40"
          >
            <Minus className="h-6 w-6" />
            <span className="mt-1 text-xs font-bold">1人減らす</span>
          </button>
          <button
            type="button"
            onClick={() => void changeBy(1)}
            disabled={busy || count === null}
            aria-label="待ち人数を1人増やす"
            className="flex h-16 min-w-28 flex-col items-center justify-center rounded-2xl text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Plus className="h-6 w-6" />
            <span className="mt-1 text-xs font-bold">1人増やす</span>
          </button>
        </div>

        {flash && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-foreground">
            <span>{flash}</span>
            {lastDelta !== null && (
              <button
                type="button"
                onClick={() => void changeBy(-lastDelta, true)}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-bold disabled:opacity-40"
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
