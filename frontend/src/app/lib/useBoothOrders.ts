import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, fetchBoothOrders, getBoothOrderStage, type BoothOrder } from './api';

/** 注文を取りに行く間隔（ミリ秒）。ブース同士の画面で、ほぼ同じ内容が見えるようにする */
const DEFAULT_INTERVAL_MS = 5000;

export interface UseBoothOrdersOptions {
  /** 取りに行く間隔（ミリ秒）。省略時は 5 秒 */
  intervalMs?: number;
  /** false の間は取得しない（ログイン前など） */
  enabled?: boolean;
  /** ログインの期限切れ（401）になったときに呼ばれる。ログアウト処理などを渡す */
  onUnauthorized?: () => void;
}

export interface UseBoothOrdersResult {
  /** この店の注文すべて（新しい順） */
  orders: BoothOrder[];
  /** 提供待ち（まだ呼び出していない）。古い注文が先 */
  waitingOrders: BoothOrder[];
  /** 呼び出し中（呼び出し済みで、まだ提供していない）。呼び出した順 */
  calledOrders: BoothOrder[];
  /** 提供済み。新しく提供したものが先 */
  servedOrders: BoothOrder[];
  /** まだ提供していない注文（提供待ち + 呼び出し中）。受付が古い順 */
  unservedOrders: BoothOrder[];
  /** 待ち人数（= 提供待ち + 呼び出し中）。サーバーの待ち人数と同じ数え方 */
  unservedCount: number;
  /** 最初の読み込み中かどうか（2回目以降の更新では true にならない） */
  loading: boolean;
  /** 直近の取得に失敗したときのメッセージ。成功すると null に戻る（前回取得分の注文は残る） */
  error: string | null;
  /** 最後に取得できた時刻 */
  lastUpdatedAt: Date | null;
  /** すぐに取り直す（呼び出し・提供などの操作のあとに使う） */
  refresh: () => Promise<void>;
  /**
   * 操作の結果（サーバーから返ってきた注文）を、すぐ一覧に反映する。
   * 取得中だった古い結果が、新しい状態を上書きしないようにもする。
   */
  upsertOrder: (order: BoothOrder) => void;
}

function toTime(value: string | null): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function toNumericId(order: BoothOrder): number {
  const id = Number(order.id);
  return Number.isNaN(id) ? 0 : id;
}

/**
 * ログイン中の店の注文を、サーバーから定期的に取得する。
 *
 * - 画面が見えている間だけ、一定間隔で取り直す（別のタブにいる間は止まる）
 * - タブに戻ったときや、通信が復活したときは、すぐに取り直す
 * - 取得に失敗しても、前回の注文は消さずに残して、error にメッセージを入れる
 * - 前の取得が終わっていない間は、次の自動取得を飛ばす（通信が詰まらないように）
 */
export function useBoothOrders(
  token: string | undefined,
  options: UseBoothOrdersOptions = {},
): UseBoothOrdersResult {
  const { intervalMs = DEFAULT_INTERVAL_MS, enabled = true, onUnauthorized } = options;
  const active = Boolean(token) && enabled;

  const [orders, setOrders] = useState<BoothOrder[]>([]);
  const [loading, setLoading] = useState(active);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  /** 最新のリクエスト番号。古い結果を捨てるために使う */
  const requestIdRef = useRef(0);
  /** 取得中のリクエスト番号。取得中でなければ null */
  const inFlightRef = useRef<number | null>(null);
  const onUnauthorizedRef = useRef(onUnauthorized);

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  /** force が true のときは、取得中でも中断して取り直す */
  const load = useCallback(
    async (force: boolean) => {
      if (!token || !enabled) return;
      if (!force && inFlightRef.current !== null) return;

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const requestId = ++requestIdRef.current;
      inFlightRef.current = requestId;

      try {
        const data = await fetchBoothOrders(token, controller.signal);
        if (requestId !== requestIdRef.current) return;
        setOrders(data);
        setError(null);
        setLastUpdatedAt(new Date());
      } catch (e) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        if (e instanceof ApiError && e.status === 401) {
          onUnauthorizedRef.current?.();
          return;
        }
        setError('注文を取得できませんでした。通信状況を確認してください。');
      } finally {
        if (requestId === requestIdRef.current) {
          inFlightRef.current = null;
          setLoading(false);
        }
      }
    },
    [token, enabled],
  );

  useEffect(() => {
    // 店が変わった（ログインし直した）ときに、前の店の注文が見えないようにする
    setOrders([]);
    setError(null);
    setLastUpdatedAt(null);

    if (!active) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void load(true);

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(false);
    }, intervalMs);

    const reloadNow = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', reloadNow);
    window.addEventListener('online', reloadNow);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', reloadNow);
      window.removeEventListener('online', reloadNow);
      controllerRef.current?.abort();
      requestIdRef.current += 1;
      inFlightRef.current = null;
    };
  }, [active, load, intervalMs]);

  const refresh = useCallback(() => load(true), [load]);

  const upsertOrder = useCallback((order: BoothOrder) => {
    // 取得中の古い結果が、いま反映した状態を上書きしないように捨てる
    controllerRef.current?.abort();
    requestIdRef.current += 1;
    inFlightRef.current = null;

    setOrders((prev) => {
      const id = String(order.id);
      const exists = prev.some((o) => String(o.id) === id);
      return exists
        ? prev.map((o) => (String(o.id) === id ? order : o))
        : [order, ...prev];
    });
  }, []);

  const { waitingOrders, calledOrders, servedOrders, unservedOrders } = useMemo(() => {
    const waiting: BoothOrder[] = [];
    const called: BoothOrder[] = [];
    const served: BoothOrder[] = [];

    for (const order of orders) {
      const stage = getBoothOrderStage(order);
      if (stage === 'waiting') waiting.push(order);
      else if (stage === 'called') called.push(order);
      else if (stage === 'served') served.push(order);
    }

    waiting.sort((a, b) => toNumericId(a) - toNumericId(b));
    called.sort(
      (a, b) => toTime(a.called_at) - toTime(b.called_at) || toNumericId(a) - toNumericId(b),
    );
    served.sort(
      (a, b) => toTime(b.served_at) - toTime(a.served_at) || toNumericId(b) - toNumericId(a),
    );

    const unserved = [...waiting, ...called].sort((a, b) => toNumericId(a) - toNumericId(b));

    return {
      waitingOrders: waiting,
      calledOrders: called,
      servedOrders: served,
      unservedOrders: unserved,
    };
  }, [orders]);

  return {
    orders,
    waitingOrders,
    calledOrders,
    servedOrders,
    unservedOrders,
    unservedCount: unservedOrders.length,
    loading,
    error,
    lastUpdatedAt,
    refresh,
    upsertOrder,
  };
}
