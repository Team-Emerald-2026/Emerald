import StoreShell from './StoreShell';
import { useFestival, selectServedOrders } from '../../lib/festivalStore';
import { History } from 'lucide-react';

const time = (ts?: number) =>
  ts
    ? new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    : '';

export default function StoreServed() {
  const served = useFestival(selectServedOrders);
  // 新しい順
  const list = [...served].sort((a, b) => (b.servedAt ?? 0) - (a.servedAt ?? 0));

  return (
    <StoreShell title="提供済み履歴">
      {list.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <History className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">まだ提供済みの注文はありません。</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((o) => (
            <li
              key={o.number}
              className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <span className="font-display text-lg font-bold text-foreground">{o.number}</span>
                <p className="truncate text-sm text-muted-foreground">
                  {o.items.map((it) => `${it.name}×${it.qty}`).join('・')}
                </p>
              </div>
              <span className="shrink-0 text-sm text-muted-foreground">{time(o.servedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </StoreShell>
  );
}
