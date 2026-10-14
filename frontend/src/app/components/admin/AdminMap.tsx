import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, MapPin, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminShell from './AdminShell';
import {
  ApiError,
  createAdminMapFacility,
  deleteAdminMapFacility,
  fetchAdminMapFacilities,
  updateAdminMapFacility,
  type AdminMapFacility,
} from '../../lib/api';
import {
  facilityTypeInfo,
  facilityTypeOptions,
  floors,
  mapImageByFloor,
  type MapFloor,
} from '../../lib/campusMap';
import { logoutAdminSession, useFestival } from '../../lib/festivalStore';
import { ADMIN_PUBLIC_ACCESS } from '../../lib/adminAccess';

/**
 * ピンの文字は固定の大きさ（スマホ幅の地図で、横およそ14%・縦およそ9%）。
 * 横も縦もこの範囲より近いピンは、重なって読みにくくなるので注意を出す。
 * 来場者マップはピンを自動で動かさず、登録した位置のまま表示する。
 */
const NEAR_X = 14;
const NEAR_Y = 9;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type Draft = { name: string; type: string; x: number; y: number };
type DragState = { id: string; x: number; y: number };

const floorNumber = (floor: MapFloor) => Number(floor.replace('F', ''));
const samePlace = (a: AdminMapFacility, b: AdminMapFacility) => a.floor === b.floor && a.x === b.x && a.y === b.y;
const placeKey = (item: AdminMapFacility) => `${item.floor}:${item.x}:${item.y}`;
const displayName = (item: AdminMapFacility) => (item.store_id ? (item.store_name ?? item.name) : item.name);

export default function AdminMap() {
  const adminSession = useFestival((s) => s.adminSession);
  const [facilities, setFacilities] = useState<AdminMapFacility[]>([]);
  const [floor, setFloor] = useState<MapFloor>('3F');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  // 移動したがまだ保存していない位置。「位置を保存」を押したときだけ API に送る
  const [pending, setPending] = useState<DragState | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('booth');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);

  const canUse = Boolean(adminSession) || ADMIN_PUBLIC_ACCESS;
  const token = adminSession?.token;

  const loadFacilities = (signal?: AbortSignal) => {
    if (!canUse) return Promise.resolve();
    setLoading(true);
    return fetchAdminMapFacilities(token, signal)
      .then((data) => setFacilities(data))
      .catch((err: unknown) => {
        if (signal?.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          logoutAdminSession();
          return;
        }
        setError('マップの場所を取得できませんでした。');
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadFacilities(controller.signal);
    return () => controller.abort();
  }, [adminSession]);

  // 管理画面は部屋（空き枠）が主役。部屋に入った店舗は、その部屋の情報として扱い、ピンや一覧には出さない
  const { storeByPlace, roomPlaces } = useMemo(() => {
    const stores = new Map<string, AdminMapFacility>();
    const rooms = new Set<string>();
    for (const item of facilities) {
      if (item.store_id === null) rooms.add(placeKey(item));
      else if (!stores.has(placeKey(item))) stores.set(placeKey(item), item);
    }
    return { storeByPlace: stores, roomPlaces: rooms };
  }, [facilities]);
  const assignedStore = (item: AdminMapFacility) =>
    item.store_id === null ? (storeByPlace.get(placeKey(item)) ?? null) : null;
  const visibleFacilities = useMemo(
    () => facilities.filter((item) => item.store_id === null || !roomPlaces.has(placeKey(item))),
    [facilities, roomPlaces],
  );

  const floorFacilities = useMemo(
    () => visibleFacilities.filter((item) => item.floor === floorNumber(floor)),
    [visibleFacilities, floor],
  );
  const countByFloor = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of visibleFacilities) counts.set(item.floor, (counts.get(item.floor) ?? 0) + 1);
    return counts;
  }, [visibleFacilities]);
  const selected = facilities.find((item) => item.id === selectedId) ?? null;
  const selectedStore = selected ? assignedStore(selected) : null;

  // 同じ位置のピン（空き枠と、そこに入った店舗）は一緒に動く
  const moving = drag ?? pending;
  const movingItem = moving ? facilities.find((item) => item.id === moving.id) : undefined;
  const positionOf = (item: AdminMapFacility) =>
    moving && movingItem && (item.id === movingItem.id || samePlace(item, movingItem)) ? moving : item;
  const hasPending = pending !== null && selected !== null && pending.id === selected.id;

  // 未保存の位置があるときは、破棄してよいか確認する
  const confirmDiscardPending = () => {
    if (!pending) return true;
    if (!window.confirm('位置の変更が保存されていません。破棄しますか？')) return false;
    setPending(null);
    return true;
  };

  useEffect(() => {
    if (selected && selected.store_id === null) {
      setEditName(selected.name);
      setEditType(selected.type);
    }
  }, [selected?.id, selected?.name, selected?.type, selected?.store_id]);

  // 選択中のピン（または新規のピン）の位置
  const focusPoint = draft
    ? { x: draft.x, y: draft.y, ignoreId: null as string | null }
    : selected
      ? { x: positionOf(selected).x, y: positionOf(selected).y, ignoreId: selected.id }
      : null;

  const neighbors = useMemo(() => {
    if (!focusPoint) return [];
    return floorFacilities
      .filter((item) => item.id !== focusPoint.ignoreId)
      .filter((item) => !(selected && !draft && samePlace(item, selected)))
      .filter(
        (item) => Math.abs(item.x - focusPoint.x) < NEAR_X && Math.abs(item.y - focusPoint.y) < NEAR_Y,
      )
      .map((item) => ({
        item,
        distance: Math.hypot(item.x - focusPoint.x, item.y - focusPoint.y),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [floorFacilities, focusPoint?.x, focusPoint?.y, focusPoint?.ignoreId]);

  const toPercent = (clientX: number, clientY: number) => {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.round(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100)),
      y: Math.round(clamp(((clientY - rect.top) / rect.height) * 100, 0, 100)),
    };
  };

  const replaceFacility = (next: AdminMapFacility) =>
    setFacilities((current) => current.map((item) => (item.id === next.id ? next : item)));

  const movePending = (item: AdminMapFacility, x: number, y: number) => {
    setMessage('');
    setError('');
    setPending(x === item.x && y === item.y ? null : { id: item.id, x, y });
  };

  const savePosition = async () => {
    if (!selected || !hasPending || !pending || !canUse || saving) return;
    const { x, y } = pending;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await updateAdminMapFacility(token, selected.id, { x, y });
      setFacilities((current) =>
        current.map((item) =>
          item.id === selected.id ? (saved ?? { ...item, x, y }) : samePlace(item, selected) ? { ...item, x, y } : item,
        ),
      );
      setPending(null);
      setMessage(`「${selected.store_name ?? selected.name}」の位置を ${x}%, ${y}% に移動しました。`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '位置を保存できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  const handleMapClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!canUse) return;
    const point = toPercent(event.clientX, event.clientY);
    if (!point) return;
    if (!confirmDiscardPending()) return;
    setSelectedId(null);
    setMessage('');
    setError('');
    setDraft((current) => ({
      name: current?.name ?? '',
      type: current?.type ?? 'booth',
      x: point.x,
      y: point.y,
    }));
  };

  const handlePinPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, item: AdminMapFacility) => {
    event.stopPropagation();
    if (pending && pending.id !== item.id && !confirmDiscardPending()) return;
    setSelectedId(item.id);
    setDraft(null);
    setMessage('');
    setError('');
    dragRef.current = { id: item.id, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePinPointerMove = (event: ReactPointerEvent<HTMLButtonElement>, item: AdminMapFacility) => {
    const state = dragRef.current;
    if (!state || state.id !== item.id) return;
    if (!state.moved && Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 4) return;
    state.moved = true;
    const point = toPercent(event.clientX, event.clientY);
    if (point) setDrag({ id: item.id, ...point });
  };

  const handlePinPointerUp = (event: ReactPointerEvent<HTMLButtonElement>, item: AdminMapFacility) => {
    const state = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!state || state.id !== item.id || !state.moved) {
      setDrag(null);
      return;
    }
    const point = toPercent(event.clientX, event.clientY);
    setDrag(null);
    if (point) movePending(item, point.x, point.y);
  };

  const nudge = (dx: number, dy: number) => {
    if (!selected) return;
    const current = positionOf(selected);
    movePending(selected, clamp(current.x + dx, 0, 100), clamp(current.y + dy, 0, 100));
  };

  const submitDraft = async () => {
    if (!draft || !canUse || saving) return;
    if (!draft.name.trim()) {
      setError('名前を入力してください。');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const created = await createAdminMapFacility(token, {
        name: draft.name.trim(),
        type: draft.type,
        floor: floorNumber(floor),
        x: draft.x,
        y: draft.y,
      });
      setMessage(`「${draft.name.trim()}」を ${floor} に追加しました。`);
      setDraft(null);
      await loadFacilities();
      if (created) setSelectedId(created.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '場所を追加できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = async () => {
    if (!selected || selected.store_id !== null || !canUse || saving) return;
    if (!editName.trim()) {
      setError('名前を入力してください。');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await updateAdminMapFacility(token, selected.id, {
        name: editName.trim(),
        type: editType,
      });
      if (saved) replaceFacility(saved);
      setMessage('名前と種類を保存しました。');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected || selected.store_id !== null || selectedStore || !canUse || saving) return;
    if (!window.confirm(`${floor} の「${selected.name}」を削除しますか？`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deleteAdminMapFacility(token, selected.id);
      setMessage(`「${selected.name}」を削除しました。`);
      setSelectedId(null);
      setPending(null);
      await loadFacilities();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '削除に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const changeFloor = (next: MapFloor) => {
    if (next !== floor && !confirmDiscardPending()) return;
    setFloor(next);
    setSelectedId(null);
    setDraft(null);
    setMessage('');
    setError('');
  };

  return (
    <AdminShell title="マップ編集">
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold text-foreground">場所の追加・移動・削除</h2>
        <p className="text-sm text-muted-foreground">
          地図の空いている所をクリックすると新しい場所を追加できます。ピンはドラッグや矢印ボタンで動かし、「位置を保存」で確定します。
        </p>
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-border bg-card p-3 text-sm text-red-500">{error}</p>
      )}
      {message && (
        <p className="mb-3 rounded-xl border border-border bg-card p-3 text-sm" style={{ color: 'var(--ok)' }}>
          {message}
        </p>
      )}

      <div className="mb-3 flex gap-1 overflow-x-auto">
        {floors.map((item) => {
          const active = item === floor;
          const count = countByFloor.get(floorNumber(item)) ?? 0;
          return (
            <button
              key={item}
              type="button"
              onClick={() => changeFloor(item)}
              className="min-h-9 shrink-0 rounded-full px-3 text-xs font-bold"
              style={{
                backgroundColor: active ? 'var(--primary)' : 'var(--muted)',
                color: active ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
              }}
            >
              {item}
              <span className="ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div
        ref={mapRef}
        onClick={handleMapClick}
        // 来場者画面（スマホ幅）と同じくらいの大きさで表示する。ピンの大きさは固定のため、
        // 大きい画面で配置すると来場者画面ではピンがはみ出して見えてしまうので、幅をそろえている。
        className="relative isolate mx-auto aspect-[1042/745] min-h-52 w-full max-w-sm cursor-crosshair select-none overflow-hidden rounded-2xl border border-border bg-muted"
      >
        <img
          src={mapImageByFloor[floor]}
          alt={`${floor} 校内マップ`}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-fill"
        />
        <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/70 px-2.5 py-1 text-xs font-bold text-white">
          {floor}
        </span>

        {floorFacilities.map((item) => {
          const isSelected = item.id === selectedId;
          const position = positionOf(item);
          const store = item.store_id !== null ? item : assignedStore(item);
          const linked = store !== null;
          // 色は来場者マップと同じく、店舗が入っていれば店舗の種類で決める
          const info = facilityTypeInfo((store ?? item).type);
          return (
            <button
              key={item.id}
              type="button"
              onPointerDown={(event) => handlePinPointerDown(event, item)}
              onPointerMove={(event) => handlePinPointerMove(event, item)}
              onPointerUp={(event) => handlePinPointerUp(event, item)}
              onPointerCancel={() => {
                dragRef.current = null;
                setDrag(null);
              }}
              onClick={(event) => event.stopPropagation()}
              title={store ? `${item.label ?? item.name}（${store.store_name ?? '店舗'}）` : item.name}
              className={`absolute max-w-[20%] -translate-x-1/2 -translate-y-1/2 cursor-grab truncate whitespace-nowrap rounded-md px-1.5 py-1 text-[10px] font-bold leading-none text-white shadow-md active:cursor-grabbing ${
                isSelected ? 'z-30 scale-110 ring-2 ring-white' : linked ? 'z-10' : 'z-0'
              } ${store?.store_visible === false ? 'opacity-50' : ''}`}
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                backgroundColor: info.color,
                touchAction: 'none',
                outline: linked ? '2px solid rgba(0,0,0,0.55)' : undefined,
              }}
            >
              {/* 来場者マップと同じ表示ルール: 場所の名前（部屋番号など）を優先する */}
              {item.label ?? displayName(item)}
            </button>
          );
        })}

        {draft && (
          <span
            className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border-2 border-dashed border-white bg-black/60 px-1.5 py-1 text-[10px] font-bold leading-none text-white shadow-md"
            style={{ left: `${draft.x}%`, top: `${draft.y}%` }}
          >
            {draft.name.trim() || '新規'}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        <span className="font-bold">黒い縁のピン</span>は店舗が入っている場所です。部屋番号で表示し、選ぶと入っている店舗がわかります。動かすと店舗も一緒に移動します。
      </p>

      {neighbors.length > 0 && (
        <p className="mt-2 rounded-xl border border-border bg-card p-3 text-xs text-amber-600">
          {neighbors[0].distance === 0
            ? `同じ位置に「${neighbors[0].item.store_name ?? neighbors[0].item.name}」があります。来場者マップではどちらか片方しか表示されません。`
            : `近くに「${neighbors.map(({ item }) => item.store_name ?? item.name).join('」「')}」があります。ピンが重なって見えにくくなります。`}
        </p>
      )}

      {draft && (
        <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-1 font-display text-lg font-bold text-foreground">
            <Plus className="h-4 w-4" />
            新しい場所を追加（{floor} / X:{draft.x}% Y:{draft.y}%）
          </h3>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">名前（例: 301、体育館前）</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
              autoFocus
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">種類</span>
            <select
              value={draft.type}
              onChange={(event) => setDraft({ ...draft, type: event.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground"
            >
              {facilityTypeOptions(draft.type).map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted-foreground">位置を変えたいときは、地図の別の場所をクリックしてください。</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void submitDraft()}
              disabled={saving}
              className="flex-1 rounded-xl py-3 font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {saving ? '追加中...' : '追加する'}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-xl border border-border px-4 py-3 text-sm text-foreground hover:bg-muted"
            >
              キャンセル
            </button>
          </div>
        </section>
      )}

      {!draft && selected && (
        <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4">
          <div>
            <h3 className="flex items-center gap-1 font-display text-lg font-bold text-foreground">
              <MapPin className="h-4 w-4" />
              {selected.store_id ? (selected.store_name ?? selected.name) : selected.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {floor} / X:{positionOf(selected).x}% Y:{positionOf(selected).y}% /{' '}
              {facilityTypeInfo((selectedStore ?? selected).type).label}
            </p>
          </div>

          {selectedStore && (
            <div className="rounded-xl border border-border bg-muted/50 p-3 text-sm">
              <p className="text-xs text-muted-foreground">割り当て店舗</p>
              <p className="font-bold text-foreground">
                {selectedStore.store_name ?? selectedStore.name}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  （{selectedStore.store_visible === false ? '非表示' : '表示中'}）
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                店舗名・種類の変更や、別の部屋への割り当ては店舗管理で行います。
                <Link to="/admin/stores" className="ml-1 font-bold" style={{ color: 'var(--primary)' }}>
                  店舗管理へ
                </Link>
              </p>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-bold text-muted-foreground">位置を微調整（1%ずつ）</p>
            <div className="inline-grid grid-cols-3 gap-1">
              <span />
              <NudgeButton label="上へ" onClick={() => nudge(0, -1)} disabled={saving}>
                <ArrowUp className="h-4 w-4" />
              </NudgeButton>
              <span />
              <NudgeButton label="左へ" onClick={() => nudge(-1, 0)} disabled={saving}>
                <ArrowLeft className="h-4 w-4" />
              </NudgeButton>
              <NudgeButton label="下へ" onClick={() => nudge(0, 1)} disabled={saving}>
                <ArrowDown className="h-4 w-4" />
              </NudgeButton>
              <NudgeButton label="右へ" onClick={() => nudge(1, 0)} disabled={saving}>
                <ArrowRight className="h-4 w-4" />
              </NudgeButton>
            </div>
            {hasPending && (
              <div className="mt-2 space-y-2 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3">
                <p className="text-xs font-bold text-amber-600">
                  位置の変更はまだ保存されていません（元: X:{selected.x}% Y:{selected.y}%）
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void savePosition()}
                    disabled={saving}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    {saving ? '保存中...' : '位置を保存'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPending(null)}
                    disabled={saving}
                    className="rounded-xl border border-border px-4 py-2.5 text-sm text-foreground hover:bg-muted disabled:opacity-60"
                  >
                    元に戻す
                  </button>
                </div>
              </div>
            )}
          </div>

          {selected.store_id ? (
            <div className="space-y-2 rounded-xl bg-muted/50 p-3 text-sm">
              <p className="text-foreground">
                店舗「{selected.store_name}」（{selected.store_visible === false ? '非表示' : '表示中'}）が入っている場所です。
              </p>
              <p className="text-xs text-muted-foreground">
                名前や種類は店舗管理で変更します。店舗が紐づいているため、この場所は削除できません。
                <Link to="/admin/stores" className="ml-1 font-bold" style={{ color: 'var(--primary)' }}>
                  店舗管理へ
                </Link>
              </p>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-2 text-sm font-bold text-muted-foreground opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                削除できません
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">名前</span>
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
                />
              </label>
              {/* 店舗が入っている間は店舗の種類で表示されるので、部屋の種類は空いたときにだけ選ぶ */}
              {!selectedStore && (
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">種類</span>
                  <select
                    value={editType}
                    onChange={(event) => setEditType(event.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground"
                  >
                    {facilityTypeOptions(selected.type).map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveDetails()}
                  disabled={saving || (editName === selected.name && editType === selected.type)}
                  className="flex-1 rounded-xl py-3 font-bold text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {selectedStore ? '名前を保存' : '名前・種類を保存'}
                </button>
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={saving || selectedStore !== null}
                  title={selectedStore ? '店舗が入っているため削除できません' : undefined}
                  className="inline-flex items-center gap-1 rounded-xl border border-red-500 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  削除
                </button>
              </div>
              {selectedStore && (
                <p className="text-xs text-muted-foreground">
                  店舗が入っている部屋は削除できません。先に店舗管理で店舗位置を別の部屋に変えてください。
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <section className="mt-5 space-y-2">
        <h3 className="px-1 text-sm font-bold text-muted-foreground">{floor} の場所一覧（{floorFacilities.length}件）</h3>
        {loading ? (
          <p className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            読み込み中...
          </p>
        ) : floorFacilities.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            この階にはまだ場所がありません。地図をクリックして追加してください。
          </p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {floorFacilities.map((item, index) => {
              const store = item.store_id !== null ? item : assignedStore(item);
              const info = facilityTypeInfo((store ?? item).type);
              return (
                <li key={item.id} className={index > 0 ? 'border-t border-border' : ''}>
                  <button
                    type="button"
                    onClick={() => {
                      if (pending && pending.id !== item.id && !confirmDiscardPending()) return;
                      setSelectedId(item.id);
                      setDraft(null);
                      setMessage('');
                      setError('');
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60 ${
                      item.id === selectedId ? 'bg-muted' : ''
                    }`}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: info.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{displayName(item)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {info.label} / X:{item.x}% Y:{item.y}%
                      </span>
                    </span>
                    {store && (
                      <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-bold text-foreground">
                        {store.store_name ?? '店舗'}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}

function NudgeButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-9 w-9 place-items-center rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40"
    >
      {children}
    </button>
  );
}
