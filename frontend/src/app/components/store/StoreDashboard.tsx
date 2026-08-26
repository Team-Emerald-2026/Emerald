import { useEffect, useState } from 'react';
import StoreShell from './StoreShell';
import {
  useFestival,
  selectWaitingOrders,
  selectLatestNumber,
  logoutStore,
} from '../../lib/festivalStore';
import { Users, Megaphone, Hash } from 'lucide-react';
import { ApiError, type BoothDashboard, fetchBoothDashboard } from '../../lib/api';

export default function StoreDashboard() {
  const session = useFestival((s) => s.session);
  const waitingOrders = useFestival(selectWaitingOrders);
  const bigNumber = useFestival((s) => s.bigNumber);
  const latest = useFestival(selectLatestNumber);
  const [dashboard, setDashboard] = useState<BoothDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;

    const abortController = new AbortController();
    setLoading(true);
    setError('');

    fetchBoothDashboard(session.token, abortController.signal)
      .then((data) => {
        if (!data) {
          setError('ダッシュボード情報を取得できませんでした。');
          return;
        }
        setDashboard(data);
      })
      .catch((e) => {
        if (abortController.signal.aborted) return;
        if (e instanceof ApiError && e.status === 401) {
          logoutStore();
          return;
        }
        setError('ダッシュボード情報の取得に失敗しました。');
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      });

    return () => abortController.abort();
  }, [session]);

  const cards = [
    {
      label: '提供待ち',
      value: dashboard ? `${dashboard.current_queue_count}` : '---',
      unit: '人',
      icon: Users,
      color: 'var(--primary)',
    },
    {
      label: '一人当たり待ち時間',
      value: dashboard ? `${dashboard.current_wait_min}` : '---',
      unit: '分',
      icon: Megaphone,
      color: 'var(--accent)',
    },
    {
      label: '営業状態',
      value: dashboard ? (dashboard.is_open ? '営業中' : '準備中') : '---',
      unit: '',
      icon: Hash,
      color: '#7c5cff',
    },
    //した二つに関してはAPIで実装よりlocalstorageで管理する方が良いかもしれない
    // {
    //   label: '大きく表示中',
    //   value: bigNumber ?? '---',
    //   unit: '',
    //   icon: Megaphone,
    //   color: 'var(--accent)',
    // },
    // {
    //   label: '最新発行番号',
    //   value: latest ?? '---',
    //   unit: '',
    //   icon: Hash,
    //   color: '#7c5cff',
    // },
  ];

  return (
    <StoreShell title="ダッシュボード">
      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <p className="font-display text-lg font-bold text-foreground">{dashboard?.name ?? '---'}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {dashboard?.description?.trim() || '店舗説明は未設定です。'}
        </p>
      </div>

      {loading && (
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          ダッシュボード情報を読み込み中です...
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm text-red-500">{error}</p>
      )}

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
