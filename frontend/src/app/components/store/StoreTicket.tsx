import { useState } from 'react';
import StoreShell from './StoreShell';
import {
  useFestival,
  selectWaitingOrders,
  setOrderStatus,
  setBigNumber,
} from '../../lib/festivalStore';
import { Megaphone, Check, Maximize2, X } from 'lucide-react';

const pipeline = ['受付', '提供待ち', '呼び出し中', '提供済み'] as const;

function pipelineIndex(status: 'waiting' | 'called' | 'served') {
  if (status === 'called') return 2;
  if (status === 'served') return 3;
  return 1;
}

export default function StoreTicket() {
  const orders = useFestival(selectWaitingOrders);
  const bigNumber = useFestival((s) => s.bigNumber);
  const [confirmNumber, setConfirmNumber] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const completeServe = (number: string) => {
    setOrderStatus(number, 'served');
    if (bigNumber === number) setBigNumber(null);
    setConfirmNumber(null);
    setFullscreen(false);
  };

  return (
    <StoreShell title="受付番号の呼び出し">
      <ol className="mb-4 grid grid-cols-4 gap-1 text-center text-[11px] font-bold">
        {pipeline.map((label, index) => {
          const current = index === 1 || index === 2;
          return (
            <li
              key={label}
              className="rounded-lg px-1 py-2"
              style={{
                backgroundColor: current ? 'var(--primary)' : 'var(--muted)',
                color: current ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
              }}
            >
              {label}
            </li>
          );
        })}
      </ol>

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
      {orders.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          提供待ちはありません。
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => {
            const called = o.status === 'called';
            const confirming = confirmNumber === o.number;
            return (
              <li key={o.number} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-display text-xl font-bold text-foreground">{o.number}</span>
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
                      setBigNumber(o.number);
                      setFullscreen(true);
                    }}
                    className="flex min-h-11 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    番号を全画面表示
                  </button>
                </div>

                <p className="mt-2 text-[11px] text-muted-foreground">
                  {pipeline.map((label, index) => {
                    const active = index === pipelineIndex(o.status);
                    return (
                      <span key={label}>
                        {index > 0 ? ' → ' : ''}
                        <span className={active ? 'font-bold text-foreground' : ''}>{label}</span>
                      </span>
                    );
                  })}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  {o.items.map((it) => `${it.name}×${it.qty}`).join('・')}
                </p>

                {confirming ? (
                  <div className="mt-3 rounded-xl border border-border bg-muted/50 p-3">
                    <p className="text-sm font-bold text-foreground">
                      {o.number} を提供済みにしますか？
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      提供済み画面から「未提供に戻す」で取り消せます。
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmNumber(null)}
                        className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border py-2 text-sm font-bold text-foreground hover:bg-muted"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => completeServe(o.number)}
                        className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold text-white"
                        style={{ backgroundColor: 'var(--busy)' }}
                      >
                        <Check className="h-4 w-4" />
                        提供完了する
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOrderStatus(o.number, 'called');
                        setBigNumber(o.number);
                      }}
                      className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold text-white"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      <Megaphone className="h-4 w-4" />
                      {called ? '再呼び出し' : '呼び出し'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmNumber(o.number)}
                      className="flex min-h-11 min-w-28 items-center justify-center gap-1 rounded-lg border border-border py-2 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      提供完了
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
