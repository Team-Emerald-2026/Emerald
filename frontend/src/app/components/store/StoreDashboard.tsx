import { useEffect, useState } from 'react';
import StoreShell from './StoreShell';
import {
  useFestival,
  selectWaitingOrders,
  logoutStore,
} from '../../lib/festivalStore';
import { Users, Clock, Hash } from 'lucide-react';
import { ApiError, type BoothDashboard, fetchBoothDashboard } from '../../lib/api';

function statusLabel(status: 'waiting' | 'called' | 'served') {
  if (status === 'called') return '呼び出し中';
  if (status === 'served') return '提供済み';
  return '提供待ち';
}

export default function StoreDashboard() {
  const session = useFestival((s) => s.session);
  const waitingOrders = useFestival(selectWaitingOrders);
  const waitMinPerPerson = useFestival((s) => s.waitMinPerPerson);
  const waitingPeople = useFestival((s) => s.waiting);
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

  const waitingCount = waitingOrders.filter((o) => o.status === 'waiting').length;
  const calledCount = waitingOrders.filter((o) => o.status === 'called').length;
  const estimatedMin = waitingPeople * waitMinPerPerson;

  const cards = [
    {
      label: '提供待ち',
      value: `${waitingOrders.length}`,
      unit: '件',
      hint:
        waitingOrders.length === 0
          ? '未提供の注文はありません'
          : `受付待ち ${waitingCount}件・呼び出し中 ${calledCount}件`,
      icon: Users,
      color: 'var(--primary)',
    },
    {
      label: '来場者への待ち表示',
      value: `${estimatedMin}`,
      unit: '分',
      hint: `${waitingPeople}人 × ${waitMinPerPerson}分`,
      icon: Clock,
      color: 'var(--accent)',
    },
    {
      label: '営業状態',
      value: dashboard ? (dashboard.is_open ? '営業中' : '受付停止中') : '---',
      unit: '',
      hint: dashboard?.is_open ? '来場者画面に公開中' : '来場者画面では準備中',
      icon: Hash,
      color: '#7c5cff',
    },
  ];

  const storeName = dashboard?.name?.trim() || '---';
  const storeDescription = dashboard?.description?.trim() || '';

  return (
    <StoreShell title="ダッシュボード">
      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">店舗名</p>
        <p className="font-display text-lg font-bold text-foreground">{storeName}</p>
        <p className="mt-3 text-xs font-medium text-muted-foreground">説明</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {storeDescription || '店舗説明は未設定です。'}
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
            <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
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
                  <span
                    className="ml-2"
                    style={{ color: o.status === 'called' ? 'var(--accent)' : 'var(--primary)' }}
                  >
                    {statusLabel(o.status)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </StoreShell>
  );
}
