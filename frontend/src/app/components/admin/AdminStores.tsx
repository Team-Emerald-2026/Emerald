import { useEffect, useState } from 'react';
import { Edit3, EyeOff, Monitor, Plus } from 'lucide-react';
import AdminShell from './AdminShell';
import AdminStoreForm from './AdminStoreForm';
import {
  ApiError,
  createAdminStore,
  deleteAdminStorePermanently,
  fetchAdminFestivalDay,
  fetchAdminMapFacilities,
  fetchAdminStores,
  hideAdminStore,
  updateAdminFestivalDay,
  updateAdminStore,
  updateAdminStoreMonitor,
  type AdminMapFacility,
  type AdminStore,
  type AdminStoreInput,
  type ExhibitionDay,
  type FestivalDay,
  type FestivalDayInfo,
} from '../../lib/api';
import { facilityTypeInfo } from '../../lib/campusMap';
import { logoutAdminSession, useFestival } from '../../lib/festivalStore';
import { ADMIN_PUBLIC_ACCESS } from '../../lib/adminAccess';

const yen = (value: number) => `¥${value.toLocaleString('ja-JP')}`;

const typeLabel = (type: string) => facilityTypeInfo(type).label;

const exhibitionDayLabel = (day: ExhibitionDay | undefined) => {
  if (day === 'day1') return '10月24日(土)のみ';
  if (day === 'day2') return '10月25日(日)のみ';
  return '両日';
};

const festivalDayLabel = (day: FestivalDay) =>
  day === 'day2' ? '10月25日(日)' : '10月24日(土)';

function toStoreInput(store: AdminStore, overrides: Partial<AdminStoreInput> = {}): AdminStoreInput {
  return {
    name: store.name,
    description: store.description ?? '',
    type: store.type,
    floor: store.floor,
    map_x: store.map_x,
    map_y: store.map_y,
    exhibition_day: store.exhibition_day ?? 'both',
    is_open: store.is_open,
    is_visible: store.is_visible,
    show_on_monitor: Boolean(store.show_on_monitor),
    current_wait_min: store.current_wait_min,
    current_queue_count: store.current_queue_count,
    ...overrides,
  };
}

export default function AdminStores() {
  const adminSession = useFestival((s) => s.adminSession);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [locations, setLocations] = useState<AdminMapFacility[]>([]);
  const [editing, setEditing] = useState<AdminStore | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switchingDay, setSwitchingDay] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [festivalDay, setFestivalDay] = useState<FestivalDayInfo>({ current_day: 'day1' });

  const loadStores = (signal?: AbortSignal) => {
    if (!adminSession && !ADMIN_PUBLIC_ACCESS) return Promise.resolve();
    setLoading(true);
    setError('');
    // 場所の一覧は店舗の位置の候補に使う。取得できなくても店舗一覧は表示する
    void fetchAdminMapFacilities(adminSession?.token, signal)
      .then((data) => setLocations(data))
      .catch(() => undefined);

    void fetchAdminFestivalDay(adminSession?.token, signal)
      .then((data) => setFestivalDay(data))
      .catch(() => undefined);

    return fetchAdminStores(adminSession?.token, signal)
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

  // 同じ位置にある空き枠の名前（例: 301）があればそれを、なければ座標を表示する
  const locationLabel = (store: AdminStore) => {
    const place = locations.find(
      (item) =>
        item.store_id === null &&
        item.floor === store.floor &&
        item.x === store.map_x &&
        item.y === store.map_y,
    );
    return place ? `${store.floor}F ${place.name}` : `${store.floor}F（X:${store.map_x}% Y:${store.map_y}%）`;
  };

  const switchFestivalDay = async (day: FestivalDay) => {
    if ((!adminSession && !ADMIN_PUBLIC_ACCESS) || switchingDay || festivalDay.current_day === day) {
      return;
    }
    const confirmed = window.confirm(
      `学園祭の「本日」を「${festivalDayLabel(day)}」にしますか？\n` +
        `来場者画面の初期表示日と、モニターの表示日が切り替わります。`,
    );
    if (!confirmed) return;

    setSwitchingDay(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateAdminFestivalDay(adminSession?.token, day);
      setFestivalDay(updated);
      await loadStores();
      setMessage(`今日を${festivalDayLabel(updated.current_day)}に切り替えました。`);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        logoutAdminSession();
        return;
      }
      setError(err instanceof Error ? err.message : '出展日の切り替えに失敗しました。');
    } finally {
      setSwitchingDay(false);
    }
  };

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
    if ((!adminSession && !ADMIN_PUBLIC_ACCESS) || saving) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (editing) {
        await updateAdminStore(adminSession?.token, editing.id, input);
        setMessage('店舗情報を更新しました。');
      } else {
        await createAdminStore(adminSession?.token, input);
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

  const toggleMonitor = async (store: AdminStore) => {
    if ((!adminSession && !ADMIN_PUBLIC_ACCESS) || saving) return;

    const next = !store.show_on_monitor;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateAdminStoreMonitor(adminSession?.token, store.id, next);
      const shown = Boolean(updated?.show_on_monitor);
      if (!updated || shown !== next) {
        setError('モニター表示の更新に失敗しました。');
        return;
      }
      setStores((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated, show_on_monitor: shown } : item)),
      );
      setMessage(
        shown
          ? `${store.name} を校内モニターに表示しました。`
          : `${store.name} を校内モニターで非表示にしました。`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'モニター表示の更新に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const hideStore = async (store: AdminStore) => {
    if ((!adminSession && !ADMIN_PUBLIC_ACCESS) || saving) return;
    const confirmed = window.confirm(`${store.name} を営業停止・非表示にしますか？`);
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      await hideAdminStore(adminSession?.token, store.id);
      setMessage('店舗を営業停止・非表示にしました。');
      if (editing?.id === store.id) {
        setShowForm(false);
        setEditing(null);
      }
      await loadStores();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '非表示削除に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  // 確認（店舗名の入力）はフォーム側で済ませている
  const deleteStore = async (store: AdminStore) => {
    if ((!adminSession && !ADMIN_PUBLIC_ACCESS) || saving) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deleteAdminStorePermanently(adminSession?.token, store.id);
      setMessage(`店舗「${store.name}」を完全に削除しました。`);
      setShowForm(false);
      setEditing(null);
      await loadStores();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '店舗の削除に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="店舗管理">
      <section className="mb-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">本日の開催日</h2>
            <p className="text-sm text-muted-foreground">
              現在: {festivalDayLabel(festivalDay.current_day)}
              {festivalDay.store_counts
                ? `（24日のみ ${festivalDay.store_counts.day1} / 25日のみ ${festivalDay.store_counts.day2} / 両日 ${festivalDay.store_counts.both}）`
                : ''}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              来場者は日付タブで両日を見られます。ここは「本日」の初期表示とモニター用です。
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={switchingDay || festivalDay.current_day === 'day1'}
              onClick={() => void switchFestivalDay('day1')}
              className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-70"
              style={
                festivalDay.current_day === 'day1'
                  ? { backgroundColor: 'var(--primary)', color: '#fff' }
                  : { border: '1px solid var(--border)', color: 'var(--foreground)' }
              }
            >
              10月24日(土)
            </button>
            <button
              type="button"
              disabled={switchingDay || festivalDay.current_day === 'day2'}
              onClick={() => void switchFestivalDay('day2')}
              className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-70"
              style={
                festivalDay.current_day === 'day2'
                  ? { backgroundColor: 'var(--primary)', color: '#fff' }
                  : { border: '1px solid var(--border)', color: 'var(--foreground)' }
              }
            >
              10月25日(日)
            </button>
          </div>
        </div>
      </section>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">店舗一覧</h2>
          <p className="text-sm text-muted-foreground">
            作成、編集、営業停止・非表示、削除を管理します。校内モニターに出す店舗もここで選べます。
          </p>
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
            locations={locations}
            saving={saving}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSubmit={submit}
            onHide={editing ? () => void hideStore(editing) : undefined}
            onDelete={editing ? () => void deleteStore(editing) : undefined}
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
                    <span
                      className="rounded-md px-2 py-0.5 text-xs font-bold"
                      style={{
                        backgroundColor: store.show_on_monitor ? 'var(--ok-soft)' : 'var(--busy-soft)',
                        color: store.show_on_monitor ? 'var(--ok)' : 'var(--busy)',
                      }}
                    >
                      {store.show_on_monitor ? 'モニター表示' : 'モニター非表示'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{store.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ID: {store.id} / ログインID: {store.login_id ?? '未設定'} / 出展日:{' '}
                    {exhibitionDayLabel(store.exhibition_day)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    種類: {typeLabel(store.type)} / 位置: {locationLabel(store)}
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
                  onClick={() => void toggleMonitor(store)}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-40"
                >
                  <Monitor className="h-4 w-4" />
                  {store.show_on_monitor ? 'モニター非表示' : 'モニター表示'}
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
