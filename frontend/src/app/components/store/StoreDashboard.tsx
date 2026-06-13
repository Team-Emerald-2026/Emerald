import StoreShell from './StoreShell';
import { useFestival, selectWaitingOrders, selectLatestNumber } from '../../lib/festivalStore';
import { Users, Megaphone, Hash } from 'lucide-react';

export default function StoreDashboard() {
  const waitingOrders = useFestival(selectWaitingOrders);
  const bigNumber = useFestival((s) => s.bigNumber);
  const latest = useFestival(selectLatestNumber);

  const cards = [
    {
      label: '提供待ち',
      value: `${waitingOrders.length}`,
      unit: '組',
      icon: Users,
      color: 'var(--primary)',
    },
    {
      label: '大きく表示中',
      value: bigNumber ?? '---',
      unit: '',
      icon: Megaphone,
      color: 'var(--accent)',
    },
    {
      label: '最新発行番号',
      value: latest ?? '---',
      unit: '',
      icon: Hash,
      color: '#7c5cff',
    },
  ];

  return (
    <StoreShell title="ダッシュボード">
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <span
              className="grid h-10 w-10 place-items-center rounded-xl"
              style={{ backgroundColor: c.color }}
            >
              <c.icon className="h-5 w-5 text-white" />
            </span>
            <p className="mt-3 text-sm text-muted-foreground">{c.label}</p>
            <p className="font-display text-3xl font-bold text-foreground">
              {c.value}
              {c.unit && <span className="ml-1 text-base font-medium">{c.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <h2 className="mb-2 font-display text-base font-bold text-foreground">提供待ち一覧</h2>
        {waitingOrders.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
            提供待ちはありません。
          </p>
        ) : (
          <ul className="space-y-2">
            {waitingOrders.map((o) => (
              <li
                key={o.number}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="font-display text-lg font-bold text-foreground">{o.number}</span>
                <span className="text-sm text-muted-foreground">
                  {o.items.reduce((a, it) => a + it.qty, 0)}点
                  {o.status === 'called' && (
                    <span className="ml-2" style={{ color: 'var(--accent)' }}>
                      呼び出し中
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </StoreShell>
  );
}
