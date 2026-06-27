import StoreShell from './StoreShell';
import {
  useFestival,
  selectWaitingOrders,
  setOrderStatus,
  setBigNumber,
} from '../../lib/festivalStore';
import { Megaphone, Check, Maximize2 } from 'lucide-react';

export default function StoreTicket() {
  const orders = useFestival(selectWaitingOrders);
  const bigNumber = useFestival((s) => s.bigNumber);

  return (
    <StoreShell title="受付番号の呼び出し">
      {/* 大きく表示 */}
      <div
        className="rounded-3xl p-6 text-center text-white"
        style={{ background: 'linear-gradient(135deg,var(--primary),#15324a)' }}
      >
        <p className="text-sm opacity-80">ただいまお呼びの番号</p>
        <p className="font-display text-7xl font-bold leading-tight">
          {bigNumber ?? '---'}
        </p>
        {bigNumber && (
          <button
            type="button"
            onClick={() => setBigNumber(null)}
            className="mt-2 rounded-lg bg-white/20 px-3 py-1 text-sm"
          >
            表示をクリア
          </button>
        )}
      </div>

      <h2 className="mb-2 mt-5 font-display text-base font-bold text-foreground">提供待ち</h2>
      {orders.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          提供待ちはありません。
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li
              key={o.number}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-display text-xl font-bold text-foreground">
                    {o.number}
                  </span>
                  {o.status === 'called' && (
                    <span
                      className="ml-2 rounded-md px-2 py-0.5 text-xs"
                      style={{ backgroundColor: 'var(--busy-soft)', color: 'var(--busy)' }}
                    >
                      呼び出し中
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setBigNumber(o.number)}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  大きく表示
                </button>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {o.items.map((it) => `${it.name}×${it.qty}`).join('・')}
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOrderStatus(o.number, 'called')}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold text-white"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <Megaphone className="h-4 w-4" />
                  呼び出し
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderStatus(o.number, 'served');
                    if (bigNumber === o.number) setBigNumber(null);
                  }}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold text-white"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <Check className="h-4 w-4" />
                  提供完了
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </StoreShell>
  );
}
