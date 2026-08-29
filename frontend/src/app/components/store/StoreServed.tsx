import { useMemo, useState } from 'react';
import StoreShell from './StoreShell';
import { useFestival, selectServedOrders, revertServedOrder } from '../../lib/festivalStore';
import { History, Undo2 } from 'lucide-react';

const time = (ts?: number) =>
  ts
    ? new Date(ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    : '';

type Filter = 'all' | 'hour' | 'today';

export default function StoreServed() {
  const served = useFestival(selectServedOrders);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [reverted, setReverted] = useState<string | null>(null);

  const list = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return [...served]
      .sort((a, b) => (b.servedAt ?? 0) - (a.servedAt ?? 0))
      .filter((o) => {
        if (filter === 'hour') return (o.servedAt ?? 0) >= now - 60 * 60 * 1000;
        if (filter === 'today') return (o.servedAt ?? 0) >= startOfToday.getTime();
        return true;
      })
      .filter((o) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        const hay = `${o.number} ${o.items.map((it) => it.name).join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
  }, [served, filter, query]);

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'すべて' },
    { id: 'hour', label: '直近1時間' },
    { id: 'today', label: '本日' },
  ];

  return (
    <StoreShell title="提供済み履歴">
      <div className="mb-3 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className="min-h-11 rounded-full px-3 py-1.5 text-sm font-medium"
            style={{
              backgroundColor: filter === item.id ? 'var(--primary)' : 'var(--muted)',
              color: filter === item.id ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="受付番号・商品名で検索"
        className="mb-4 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none"
      />

      {reverted && (
        <p className="mb-3 rounded-xl border border-border bg-card p-3 text-sm" style={{ color: 'var(--ok)' }}>
          {reverted} を未提供に戻しました。呼び出し画面に再表示されます。
        </p>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <History className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">
            {served.length === 0
              ? 'まだ提供済みの注文はありません。'
              : '条件に一致する履歴がありません。'}
          </p>
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
                <p className="mt-1 text-xs text-muted-foreground">{time(o.servedAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  revertServedOrder(o.number);
                  setReverted(o.number);
                }}
                className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
              >
                <Undo2 className="h-3.5 w-3.5" />
                未提供に戻す
              </button>
            </li>
          ))}
        </ul>
      )}
    </StoreShell>
  );
}
