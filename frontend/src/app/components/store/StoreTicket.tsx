import { useRef, useState } from 'react';
import StoreShell from './StoreShell';
import { useFestival, setBigNumber, logoutStore } from '../../lib/festivalStore';
import {
  ApiError,
  callBoothOrder,
  cancelBoothOrder,
  describeOrderError,
  getBoothOrderStage,
  serveBoothOrder,
  type BoothOrder,
} from '../../lib/api';
import { useBoothOrders } from '../../lib/useBoothOrders';
import { Ban, Megaphone, Check, Maximize2, X } from 'lucide-react';

export default function StoreTicket() {
  const session = useFestival((s) => s.session);
  const bigNumber = useFestival((s) => s.bigNumber);
  const {
    unservedOrders: orders,
    loading,
    error: fetchError,
    refresh,
    upsertOrder,
  } = useBoothOrders(session?.token, { onUnauthorized: logoutStore });

  // 確認中の操作（提供完了 / 注文のキャンセル）
  const [confirm, setConfirm] = useState<{ id: string; kind: 'serve' | 'cancel' } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // 操作中の注文（連打しても、同じ注文に二重に送らない）
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef<string | null>(null);
  const [actionError, setActionError] = useState('');

  /** 1件ずつ操作する。失敗したときは、画面に理由を出して最新の状態に取り直す */
  const runAction = async (orderId: string, action: () => Promise<void>) => {
    if (!session?.token || busyRef.current) return;
    busyRef.current = orderId;
    setBusyId(orderId);
    setActionError('');

    try {
      await action();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logoutStore();
        return;
      }
      setActionError(describeOrderError(err, '操作に失敗しました。もう一度お試しください。'));
      if (err instanceof ApiError && (err.status === 409 || err.status === 404)) {
        setConfirm(null);
        void refresh();
      }
    } finally {
      busyRef.current = null;
      setBusyId(null);
    }
  };

  const callOrder = (order: BoothOrder) =>
    runAction(order.id, async () => {
      const updated = await callBoothOrder(session!.token, order.id);
      upsertOrder(updated);
      setBigNumber(updated.ticket_number);
    });

  const completeServe = (order: BoothOrder) =>
    runAction(order.id, async () => {
      const updated = await serveBoothOrder(session!.token, order.id);
      upsertOrder(updated);
      if (bigNumber === order.ticket_number) setBigNumber(null);
      setConfirm(null);
      setFullscreen(false);
    });

  const completeCancel = (order: BoothOrder) =>
    runAction(order.id, async () => {
      const updated = await cancelBoothOrder(session!.token, order.id);
      upsertOrder(updated);
      if (bigNumber === order.ticket_number) {
        setBigNumber(null);
        setFullscreen(false);
      }
      setConfirm(null);
    });

  const calledCount = orders.filter((o) => getBoothOrderStage(o) === 'called').length;
  const statusCounts = [
    { label: '提供待ち', count: orders.length - calledCount, color: 'var(--ok)', bg: 'var(--ok-soft)' },
    { label: '呼び出し中', count: calledCount, color: 'var(--busy)', bg: 'var(--busy-soft)' },
  ];

  return (
    <StoreShell title="受付番号の呼び出し">
      <dl className="mb-4 grid grid-cols-2 gap-2">
        {statusCounts.map(({ label, count, color, bg }) => (
          <div key={label} className="rounded-2xl px-4 py-3" style={{ backgroundColor: bg }}>
            <dt className="text-xs font-bold" style={{ color }}>
              {label}
            </dt>
            <dd className="font-display text-3xl font-bold text-foreground">
              {loading ? '-' : count}
              <span className="ml-1 text-sm font-medium text-muted-foreground">件</span>
            </dd>
          </div>
        ))}
      </dl>

      <div
        className="rounded-3xl p-6 text-center text-white"
        style={{ background: 'linear-gradient(135deg,var(--primary),#15324a)' }}
      >
        <p className="text-sm opacity-80">ただいまお呼びの番号</p>
        <p className="font-display text-7xl font-bold leading-tight">{bigNumber ?? '---'}</p>
        {bigNumber && (
          <button
            type="button"
            onClick={() => {
              setBigNumber(null);
              setFullscreen(false);
            }}
            className="mt-2 rounded-lg bg-white/20 px-3 py-2 text-sm"
          >
            呼び出し表示だけを消す
          </button>
        )}
        <p className="mt-2 text-xs opacity-75">注文の状態は変わりません。画面の番号表示だけを消します。</p>
      </div>

      <h2 className="mb-2 mt-5 font-display text-base font-bold text-foreground">提供待ち</h2>

      {actionError && (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-border bg-card p-3 text-sm text-red-500"
        >
          {actionError}
        </p>
      )}
      {fetchError && (
        <p className="mb-3 rounded-xl border border-border bg-card p-3 text-sm text-red-500">
          {fetchError}（最後に取得した内容を表示しています）
        </p>
      )}

      {loading ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          読み込み中...
        </p>
      ) : orders.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          提供待ちはありません。
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => {
            const called = getBoothOrderStage(o) === 'called';
            const confirming = confirm?.id === o.id;
            const confirmKind = confirming ? confirm.kind : null;
            const busy = busyId === o.id;
            return (
              <li key={o.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-display text-xl font-bold text-foreground">
                      {o.ticket_number}
                    </span>
                    <span
                      className="ml-2 rounded-md px-2 py-0.5 text-xs"
                      style={{
                        backgroundColor: called ? 'var(--busy-soft)' : 'var(--ok-soft)',
                        color: called ? 'var(--busy)' : 'var(--ok)',
                      }}
                    >
                      {called ? '呼び出し中' : '提供待ち'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBigNumber(o.ticket_number);
                      setFullscreen(true);
                    }}
                    className="flex min-h-11 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    番号を全画面表示
                  </button>
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  {o.items.map((it) => `${it.name ?? '商品'}×${it.quantity}`).join('・')}
                </p>

                {confirming ? (
                  <div className="mt-3 rounded-xl border border-border bg-muted/50 p-3">
                    {confirmKind === 'cancel' ? (
                      <>
                        <p className="text-sm font-bold text-foreground">
                          {o.ticket_number} の注文をキャンセルしますか？
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          待ち人数が1人減り、売上からも外れます。元には戻せません。返金は、アプリの外で行ってください。
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-foreground">
                          {o.ticket_number} を提供済みにしますか？
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          提供履歴画面から「未提供に戻す」で取り消せます。
                        </p>
                      </>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirm(null)}
                        disabled={busy}
                        className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border py-2 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-40"
                      >
                        やめる
                      </button>
                      {confirmKind === 'cancel' ? (
                        <button
                          type="button"
                          onClick={() => void completeCancel(o)}
                          disabled={busy}
                          className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-red-500 py-2 text-sm font-bold text-white disabled:opacity-40"
                        >
                          <Ban className="h-4 w-4" />
                          {busy ? '送信中...' : 'キャンセルする'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void completeServe(o)}
                          disabled={busy}
                          className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold text-white disabled:opacity-40"
                          style={{ backgroundColor: 'var(--busy)' }}
                        >
                          <Check className="h-4 w-4" />
                          {busy ? '送信中...' : '提供完了する'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void callOrder(o)}
                      disabled={busyId !== null}
                      className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold text-white disabled:opacity-40"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      <Megaphone className="h-4 w-4" />
                      {busy ? '送信中...' : called ? '再呼び出し' : '呼び出し'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ id: o.id, kind: 'serve' })}
                      disabled={busyId !== null}
                      className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-border py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40"
                    >
                      提供完了
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ id: o.id, kind: 'cancel' })}
                      disabled={busyId !== null}
                      aria-label={`${o.ticket_number} の注文をキャンセル`}
                      className="flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg border border-red-500/60 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-40"
                    >
                      <Ban className="h-4 w-4" />
                      注文キャンセル
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {fullscreen && bigNumber && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black px-6 text-white">
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15"
            aria-label="全画面表示を閉じる"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="text-center">
            <p className="text-lg opacity-80">ただいまお呼びの番号</p>
            <p className="font-display text-[22vw] font-bold leading-none">{bigNumber}</p>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="mt-6 rounded-xl bg-white/20 px-4 py-3 text-sm font-bold"
            >
              全画面を閉じる
            </button>
          </div>
        </div>
      )}
    </StoreShell>
  );
}
