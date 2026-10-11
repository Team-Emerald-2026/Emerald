import { useMemo, useRef, useState } from 'react';
import StoreShell from './StoreShell';
import { useFestival, logoutStore } from '../../lib/festivalStore';
import {
  ApiError,
  describeOrderError,
  unserveBoothOrder,
  type BoothOrder,
} from '../../lib/api';
import { useBoothOrders } from '../../lib/useBoothOrders';
import { History, Undo2 } from 'lucide-react';

const toMs = (value: string | null) => {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
};

const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    : '';

type Filter = 'all' | 'hour' | 'today';

export default function StoreServed() {
  const session = useFestival((s) => s.session);
  const {
    servedOrders: served,
    loading,
    error: fetchError,
    refresh,
    upsertOrder,
  } = useBoothOrders(session?.token, { onUnauthorized: logoutStore });
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [reverted, setReverted] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  // 操作中の注文（連打しても、同じ注文に二重に送らない）
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef<string | null>(null);

  const list = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return [...served]
      .sort((a, b) => toMs(b.served_at) - toMs(a.served_at))
      .filter((o) => {
        if (filter === 'hour') return toMs(o.served_at) >= now - 60 * 60 * 1000;
        if (filter === 'today') return toMs(o.served_at) >= startOfToday.getTime();
        return true;
      })
      .filter((o) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        const hay = `${o.ticket_number} ${o.items.map((it) => it.name ?? '').join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
  }, [served, filter, query]);

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'すべて' },
    { id: 'hour', label: '直近1時間' },
    { id: 'today', label: '本日' },
  ];

  const revert = async (order: BoothOrder) => {
    if (!session?.token || busyRef.current) return;
    busyRef.current = order.id;
    setBusyId(order.id);
    setActionError('');
    setReverted(null);

    try {
      const updated = await unserveBoothOrder(session.token, order.id);
      upsertOrder(updated);
      setReverted(order.ticket_number);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logoutStore();
        return;
      }
      setActionError(describeOrderError(err, '未提供に戻せませんでした。もう一度お試しください。'));
      if (err instanceof ApiError && (err.status === 409 || err.status === 404)) {
        void refresh();
      }
    } finally {
      busyRef.current = null;
      setBusyId(null);
    }
  };

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
        <p className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          読み込み中...
        </p>
      ) : list.length === 0 ? (
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
              key={o.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <span className="font-display text-lg font-bold text-foreground">
                  {o.ticket_number}
                </span>
                <p className="truncate text-sm text-muted-foreground">
                  {o.items.map((it) => `${it.name ?? '商品'}×${it.quantity}`).join('・')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{time(o.served_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => void revert(o)}
                disabled={busyId !== null}
                className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-muted disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" />
                {busyId === o.id ? '送信中...' : '未提供に戻す'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </StoreShell>
  );
}
