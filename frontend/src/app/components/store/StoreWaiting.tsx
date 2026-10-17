import { useCallback, useEffect, useRef, useState } from 'react';
import StoreShell from './StoreShell';
import { useFestival, logoutStore } from '../../lib/festivalStore';
import { Plus, Minus, Users, Undo2 } from 'lucide-react';
import { ApiError, fetchBoothDashboard, updateWaitTime } from '../../lib/api';

/** サーバーの待ち人数を取りに行く間隔（ミリ秒） */
const POLL_INTERVAL_MS = 5000;
/** 最後にボタンを押してから、まとめて送るまでの待ち時間（ミリ秒） */
const SEND_DELAY_MS = 1000;

/**
 * 待ち人数の管理。
 * 待ち人数はサーバーの値が正で、レジで会計すると +1、提供済みにすると -1 される。
 * ここの「増やす／減らす」は、数え違いを直すための手動の補正。
 * 連打しても通信は1回で済むよう、押した分を画面の中で数えておき、少し待ってから増減の合計を送る。
 */
export default function StoreWaiting() {
  const session = useFestival((s) => s.session);

  /** サーバーから受け取った最新の待ち人数 */
  const [serverCount, setServerCountState] = useState<number | null>(null);
  const serverCountRef = useRef<number | null>(null);
  /** まだ送っていない増減の合計 */
  const [pending, setPending] = useState(0);
  /** 送信中の増減の合計 */
  const [inFlight, setInFlight] = useState(0);
  const pendingRef = useRef(0);
  const inFlightRef = useRef(0);
  const sendTimerRef = useRef<number | null>(null);
  /** 送信のたびに増やす。送信より前に始まった取得の結果（古い人数）を捨てるために使う */
  const sendVersionRef = useRef(0);

  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  /** 直前に送った増減（「元に戻す」で打ち消す用） */
  const [lastDelta, setLastDelta] = useState<number | null>(null);

  const setServerCount = (value: number) => {
    serverCountRef.current = value;
    setServerCountState(value);
  };

  // 待ち人数をサーバーから定期的に取得する（レジの会計・提供済みの変化にも追随する）
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!session) return;
      const version = sendVersionRef.current;
      try {
        const dashboard = await fetchBoothDashboard(undefined, signal);
        if (signal?.aborted) return;
        if (!dashboard) {
          setLoadError('待ち人数を取得できませんでした。');
          return;
        }
        // 送信中や、取得している間に送信があったときは、古い値で表示が戻らないよう上書きしない
        if (inFlightRef.current === 0 && version === sendVersionRef.current) {
          setServerCount(Number(dashboard.current_queue_count) || 0);
        }
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
    [session],
  );

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(controller.signal);
    }, POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [session, load]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 4000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const setPendingValue = (value: number) => {
    pendingRef.current = value;
    setPending(value);
  };

  const setInFlightValue = (value: number) => {
    inFlightRef.current = value;
    setInFlight(value);
  };

  /** まだ送っていない増減を、まとめて1回で送る（送信中なら、終わってから送る） */
  const flush = useCallback(
    async (isUndo = false) => {
      if (sendTimerRef.current !== null) {
        window.clearTimeout(sendTimerRef.current);
        sendTimerRef.current = null;
      }
      if (!session || inFlightRef.current !== 0 || pendingRef.current === 0) return;

      const delta = pendingRef.current;
      sendVersionRef.current += 1;
      setPendingValue(0);
      setInFlightValue(delta);
      setActionError('');

      try {
        const updated = await updateWaitTime(undefined, { current_queue_delta: delta });
        const next = Number(updated.current_queue_count) || 0;
        setServerCount(next);
        if (isUndo) {
          setLastDelta(null);
          setFlash(null);
        } else {
          setLastDelta(delta);
          setFlash(`${next}人に変更しました`);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logoutStore();
          return;
        }
        // 送れなかった分は取り消して、サーバーの最新の値に戻す
        setPendingValue(0);
        setLastDelta(null);
        setActionError('待ち人数を変更できませんでした。最新の人数に戻しました。もう一度お試しください。');
        void load();
      } finally {
        setInFlightValue(0);
      }

      // 送信中に押された分があれば、続けて送る
      if (pendingRef.current !== 0) void flush();
    },
    [session, load],
  );

  // 画面を離れるとき・裏に回ったときは、待たずに送る（押した分を失わないように）
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      void flush();
    };
  }, [flush]);

  const displayed =
    serverCount === null ? null : Math.max(0, serverCount + inFlight + pending);

  const changeBy = (delta: number) => {
    // 連打は再描画より速いことがあるので、表示中の値ではなく ref から今の人数を求める
    if (!session || serverCountRef.current === null) return;
    const current = serverCountRef.current + inFlightRef.current + pendingRef.current;
    if (delta < 0 && current <= 0) return;

    setPendingValue(pendingRef.current + delta);
    setFlash(null);
    setLastDelta(null);
    if (sendTimerRef.current !== null) window.clearTimeout(sendTimerRef.current);
    sendTimerRef.current = window.setTimeout(() => {
      sendTimerRef.current = null;
      void flush();
    }, SEND_DELAY_MS);
  };

  const undo = () => {
    if (lastDelta === null || pendingRef.current !== 0 || inFlightRef.current !== 0) return;
    setPendingValue(-lastDelta);
    void flush(true);
  };

  const waiting = displayed ?? 0;
  const canDecrease = displayed !== null && displayed > 0;
  const unsent = pending + inFlight;

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
          {displayed === null ? '--' : waiting}
        </p>
        <p className="mt-1 h-5 text-sm font-bold" style={{ color: 'var(--primary)' }} aria-live="polite">
          {unsent !== 0 &&
            `${unsent > 0 ? '＋' : '−'}${Math.abs(unsent)}人${inFlight !== 0 ? '（送信中...）' : '（送信待ち）'}`}
        </p>
        {displayed !== null && (
          <p className="mt-1 text-xs text-muted-foreground">
            来場者画面には「待ち{waiting}人」として表示されます。
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          レジで会計すると1人増え、提供済みにすると1人減ります。数え違いを直したいときだけ、下のボタンで補正してください。続けて押した分は、まとめて反映されます。
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
            onClick={() => changeBy(-1)}
            disabled={!canDecrease}
            aria-label="待ち人数を1人減らす"
            className="flex h-16 min-w-28 flex-col items-center justify-center rounded-2xl border border-border text-foreground hover:bg-muted disabled:opacity-40"
          >
            <Minus className="h-6 w-6" />
            <span className="mt-1 text-xs font-bold">1人減らす</span>
          </button>
          <button
            type="button"
            onClick={() => changeBy(1)}
            disabled={displayed === null}
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
                onClick={undo}
                disabled={unsent !== 0}
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
