import { useEffect, useState } from 'react';
import { Edit3, EyeOff, Hash, Monitor, Plus, Search } from 'lucide-react';
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
  updateAdminStoreCallPage,
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
    show_on_call_page: Boolean(store.show_on_call_page),
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
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'floor'>('name');
  const [query, setQuery] = useState('');

  const floors = Array.from(new Set(stores.map((store) => store.floor))).sort((a, b) => a - b);
  // 店舗を消して、選んでいた階に店舗がなくなったら全フロアに戻す
  const activeFloor = floorFilter !== 'all' && floors.includes(floorFilter) ? floorFilter : 'all';
  const queryText = query.trim().toLocaleLowerCase('ja');
  // 名前順は全店舗をあいうえお（数字は 2 が 10 より前）。階順は 1F から上で、同じ階は名前順
  const visibleStores = stores
    .filter((store) => activeFloor === 'all' || store.floor === activeFloor)
    .filter((store) => {
      if (!queryText || editing?.id === store.id) return true;
      const name = store.name.toLocaleLowerCase('ja');
      const loginId = (store.login_id ?? '').toLocaleLowerCase('ja');
      return name.includes(queryText) || loginId.includes(queryText);
    })
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name, 'ja', { numeric: true });
      const byFloor = a.floor - b.floor;
      const byId = a.id.localeCompare(b.id);
      return sortBy === 'name' ? byName || byFloor || byId : byFloor || byName || byId;
    });

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

  // 編集フォームを、対象店舗の直下に出したあと見える位置までスクロールする
  useEffect(() => {
    if (!showForm || !editing) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`store-edit-${editing.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showForm, editing]);

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

  const toggleCallPage = async (store: AdminStore) => {
    if ((!adminSession && !ADMIN_PUBLIC_ACCESS) || saving) return;

    const next = !store.show_on_call_page;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateAdminStoreCallPage(adminSession?.token, store.id, next);
      const shown = Boolean(updated?.show_on_call_page);
      if (!updated || shown !== next) {
        setError('受取番号ページの表示更新に失敗しました。');
        return;
      }
      setStores((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated, show_on_call_page: shown } : item)),
      );
      setMessage(
        shown
          ? `${store.name} を受取番号ページに表示しました。`
          : `${store.name} を受取番号ページから外しました。店舗の呼び出しは続けて使えます。`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '受取番号ページの表示更新に失敗しました。');
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

      {stores.length > 0 && (
        <label className="mb-4 block">
          <span className="sr-only">店舗を検索</span>
          <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="店舗名、ログインIDで検索"
              className="w-full bg-transparent py-2.5 text-base text-foreground outline-none"
            />
          </div>
        </label>
      )}

      {stores.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="並び順">
          <span className="text-sm text-muted-foreground">並び順</span>
          {(
            [
              ['name', '名前順'],
              ['floor', '階順'],
            ] as const
          ).map(([key, label]) => {
            const active = sortBy === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setSortBy(key)}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: active ? 'var(--primary)' : 'var(--muted)',
                  color: active ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {floors.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="フロア">
          {(['all', ...floors] as const).map((f) => {
            const active = activeFloor === f;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFloorFilter(f)}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: active ? 'var(--primary)' : 'var(--muted)',
                  color: active ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                }}
              >
                {f === 'all' ? '全フロア' : `${f}F`}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="mb-4 whitespace-pre-line rounded-xl border border-border bg-card p-3 text-sm text-red-500">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm" style={{ color: 'var(--ok)' }}>
          {message}
        </p>
      )}

      {showForm && !editing && (
        <div className="mb-5">
          <AdminStoreForm
            store={null}
            locations={locations}
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
      ) : visibleStores.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          条件に一致する店舗はありません。
        </p>
      ) : (
        <ul className="space-y-3">
          {visibleStores.map((store) => (
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
                    <span
                      className="rounded-md px-2 py-0.5 text-xs font-bold"
                      style={{
                        backgroundColor: store.show_on_call_page ? 'var(--ok-soft)' : 'var(--busy-soft)',
                        color: store.show_on_call_page ? 'var(--ok)' : 'var(--busy)',
                      }}
                    >
                      {store.show_on_call_page ? '受取番号に表示' : '受取番号は非表示'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{store.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ID: {store.id} / ログインID: {store.login_id ?? '未設定'} / 出展日:{' '}
                    {exhibitionDayLabel(store.exhibition_day)}
                    {(store.time_slots ?? []).length > 0 && (
                      <>
                        {' '}/ 出展時間:{' '}
                        {(store.time_slots ?? [])
                          .map(
                            (slot) =>
                              `${slot.day === 'day1' ? '24日 ' : slot.day === 'day2' ? '25日 ' : ''}${slot.start}〜${slot.end}`,
                          )
                          .join('、')}
                      </>
                    )}
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
                  onClick={() => void toggleCallPage(store)}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-40"
                >
                  <Hash className="h-4 w-4" />
                  {store.show_on_call_page ? '受取番号を非表示' : '受取番号に表示'}
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

              {showForm && editing?.id === store.id && (
                <div id={`store-edit-${store.id}`} className="mt-4 border-t border-border pt-4">
                  <AdminStoreForm
                    store={editing}
                    locations={locations}
                    saving={saving}
                    onCancel={() => {
                      setShowForm(false);
                      setEditing(null);
                    }}
                    onSubmit={submit}
                    onHide={() => void hideStore(editing)}
                    onDelete={() => void deleteStore(editing)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
