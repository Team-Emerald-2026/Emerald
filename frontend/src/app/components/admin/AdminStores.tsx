import { useEffect, useState } from 'react';
import { Edit3, EyeOff, Plus } from 'lucide-react';
import AdminShell from './AdminShell';
import AdminStoreForm from './AdminStoreForm';
import {
  ApiError,
  createAdminStore,
  fetchAdminStores,
  hideAdminStore,
  updateAdminStore,
  type AdminStore,
  type AdminStoreInput,
} from '../../lib/api';
import { logoutAdminSession, useFestival } from '../../lib/festivalStore';
import { findMapLocation } from '../../lib/mapLocations';

const yen = (value: number) => `¥${value.toLocaleString('ja-JP')}`;

const typeLabel = (type: string) => {
  switch (type) {
    case 'food':
      return 'フード';
    case 'shop':
      return '物販';
    case 'information':
      return '案内';
    case 'toilet':
      return 'トイレ';
    case 'first_aid':
      return '救護室';
    case 'support':
      return 'サポート';
    default:
      return '体験';
  }
};

export default function AdminStores() {
  const adminSession = useFestival((s) => s.adminSession);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [editing, setEditing] = useState<AdminStore | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadStores = (signal?: AbortSignal) => {
    if (!adminSession) return Promise.resolve();
    setLoading(true);
    setError('');
    return fetchAdminStores(adminSession.token, signal)
      .then((data) => setStores(data))
      .catch((err: unknown) => {
        if (signal?.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          logoutAdminSession();
          return;
        }
        setError('店舗一覧を取得できませんでした。');
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadStores(controller.signal);
    return () => controller.abort();
  }, [adminSession]);

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
    setMessage('');
    setError('');
  };

  const openEdit = (store: AdminStore) => {
    setEditing(store);
    setShowForm(true);
    setMessage('');
    setError('');
  };

  const submit = async (input: AdminStoreInput) => {
    if (!adminSession || saving) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (editing) {
        await updateAdminStore(adminSession.token, editing.id, input);
        setMessage('店舗情報を更新しました。');
      } else {
        await createAdminStore(adminSession.token, input);
        setMessage('店舗を作成しました。');
      }
      setShowForm(false);
      setEditing(null);
      await loadStores();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const hideStore = async (store: AdminStore) => {
    if (!adminSession || saving) return;
    const confirmed = window.confirm(`${store.name} を営業停止・非表示にしますか？`);
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      await hideAdminStore(adminSession.token, store.id);
      setMessage('店舗を営業停止・非表示にしました。');
      await loadStores();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '非表示削除に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="店舗管理">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">店舗一覧</h2>
          <p className="text-sm text-muted-foreground">作成、編集、営業停止・非表示を管理します。</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex shrink-0 items-center gap-1 rounded-xl px-4 py-2 font-bold text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Plus className="h-4 w-4" />
          新規
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm text-red-500">{error}</p>
      )}
      {message && (
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm" style={{ color: 'var(--ok)' }}>
          {message}
        </p>
      )}

      {showForm && (
        <div className="mb-5">
          <AdminStoreForm
            store={editing}
            saving={saving}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSubmit={submit}
          />
        </div>
      )}

      {loading ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          店舗一覧を読み込み中です...
        </p>
      ) : stores.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          店舗がありません。
        </p>
      ) : (
        <ul className="space-y-3">
          {stores.map((store) => (
            <li key={store.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-foreground">{store.name}</h3>
                    <span
                      className="rounded-md px-2 py-0.5 text-xs font-bold"
                      style={{
                        backgroundColor: store.is_visible ? 'var(--ok-soft)' : 'var(--busy-soft)',
                        color: store.is_visible ? 'var(--ok)' : 'var(--busy)',
                      }}
                    >
                      {store.is_visible ? (store.is_open ? '表示中・営業中' : '表示中・準備中') : '非表示'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{store.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ID: {store.id} / ログインID: {store.login_id ?? '未設定'} / Prefix: {store.ticket_prefix ?? '未設定'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    種類: {typeLabel(store.type)} / 位置: {findMapLocation(store.floor, store.map_x, store.map_y)?.name ?? `${store.floor}F`}
                  </p>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-xs text-muted-foreground">収益</p>
                  <p className="font-display text-xl font-bold text-foreground">{yen(store.revenue)}</p>
                  <p className="text-xs text-muted-foreground">{store.order_count}件</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <button
                  type="button"
                  onClick={() => openEdit(store)}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-bold text-foreground hover:bg-muted"
                >
                  <Edit3 className="h-4 w-4" />
                  編集
                </button>
                <button
                  type="button"
                  onClick={() => hideStore(store)}
                  disabled={!store.is_visible || saving}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-40"
                >
                  <EyeOff className="h-4 w-4" />
                  営業停止・非表示
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
