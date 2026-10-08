import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminMapFacility, AdminStore, AdminStoreInput } from '../../lib/api';

interface Props {
  store: AdminStore | null;
  /** マップ編集で登録されている場所（店舗の位置の候補） */
  locations: AdminMapFacility[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: AdminStoreInput) => void;
  /** 編集時のみ：営業停止・非表示にする */
  onHide?: () => void;
  /** 編集時のみ：完全に削除する（元に戻せない） */
  onDelete?: () => void;
}

const emptyInput: AdminStoreInput = {
  id: '',
  name: '',
  description: '',
  type: 'booth',
  floor: 1,
  map_x: 46,
  map_y: 15,
  ticket_prefix: '',
  login_id: '',
  password: '',
  is_open: true,
  is_visible: true,
  current_wait_min: 5,
  current_queue_count: 0,
};

const storeTypes = [
  { value: 'booth', label: '体験ブース' },
  { value: 'food', label: '飲食ブース' },
  { value: 'stage', label: 'イベントもの' },
  { value: 'shop', label: '物販' },
  { value: 'information', label: '案内' },
  { value: 'toilet', label: 'トイレ' },
  { value: 'first_aid', label: '救護室' },
  { value: 'support', label: 'サポート' },
] as const;

interface LocationOption {
  key: string;
  floor: number;
  x: number;
  y: number;
  label: string;
  disabled: boolean;
}

const locationKey = (floor: number, x: number, y: number) => `${floor}:${x}:${y}`;

export default function AdminStoreForm({
  store,
  locations,
  saving,
  onCancel,
  onSubmit,
  onHide,
  onDelete,
}: Props) {
  const [input, setInput] = useState<AdminStoreInput>(emptyInput);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  useEffect(() => {
    // 店舗を切り替えたら、削除確認はリセットする
    setConfirmingDelete(false);
    setConfirmName('');

    if (!store) {
      setInput(emptyInput);
      return;
    }

    setInput({
      id: store.id,
      name: store.name,
      description: store.description ?? '',
      type: store.type ?? 'booth',
      floor: store.floor ?? 1,
      map_x: store.map_x ?? 50,
      map_y: store.map_y ?? 50,
      ticket_prefix: store.ticket_prefix ?? '',
      login_id: store.login_id ?? '',
      password: '',
      is_open: store.is_open,
      is_visible: store.is_visible,
      current_wait_min: store.current_wait_min,
      current_queue_count: store.current_queue_count,
    });
  }, [store]);

  const update = <K extends keyof AdminStoreInput>(key: K, value: AdminStoreInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  // 候補は「店舗がまだ入っていない場所」＋「他の店舗が使用中の場所（選べない）」
  const locationOptions = useMemo<LocationOption[]>(() => {
    const occupants = new Map<string, AdminMapFacility>();
    for (const item of locations) {
      if (item.store_id) occupants.set(locationKey(item.floor, item.x, item.y), item);
    }

    const places = new Map<string, AdminMapFacility>();
    for (const item of locations) {
      if (item.store_id) continue;
      const key = locationKey(item.floor, item.x, item.y);
      if (!places.has(key)) places.set(key, item);
    }

    return [...places.entries()]
      .sort(
        ([, a], [, b]) =>
          a.floor - b.floor || a.name.localeCompare(b.name, 'ja', { numeric: true }),
      )
      .map(([key, place]) => {
        const occupant = occupants.get(key);
        const usedByOther = occupant && occupant.store_id !== store?.id ? occupant : null;
        return {
          key,
          floor: place.floor,
          x: place.x,
          y: place.y,
          label: `${place.floor}F ${place.name}${
            usedByOther ? `（使用中: ${usedByOther.store_name ?? usedByOther.store_id}）` : ''
          }`,
          disabled: Boolean(usedByOther),
        };
      });
  }, [locations, store?.id]);

  const selectedKey = locationKey(input.floor, input.map_x, input.map_y);
  const hasSelectedOption = locationOptions.some((option) => option.key === selectedKey);

  const selectLocation = (key: string) => {
    const option = locationOptions.find((item) => item.key === key);
    if (!option) return;
    setInput((current) => ({
      ...current,
      floor: option.floor,
      map_x: option.x,
      map_y: option.y,
    }));
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-foreground">
          {store ? '店舗を編集' : '新規店舗を作成'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
        >
          閉じる
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">ID</span>
          <input
            value={input.id ?? ''}
            onChange={(event) => update('id', event.target.value)}
            disabled={Boolean(store)}
            placeholder="store-101"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none disabled:opacity-60"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">店舗名</span>
          <input
            value={input.name}
            onChange={(event) => update('name', event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">種類</span>
          <select
            value={input.type}
            onChange={(event) => update('type', event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          >
            {storeTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">受付番号 prefix</span>
          <input
            value={input.ticket_prefix}
            onChange={(event) => update('ticket_prefix', event.target.value.toUpperCase())}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          />
        </label>
        <label className="sm:col-span-2 text-sm">
          <span className="mb-1 block text-muted-foreground">説明</span>
          <textarea
            value={input.description}
            onChange={(event) => update('description', event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">ログインID</span>
          <input
            value={input.login_id}
            onChange={(event) => update('login_id', event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">
            パスワード{store ? '（変更時のみ）' : ''}
          </span>
          <input
            type="password"
            value={input.password}
            onChange={(event) => update('password', event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">一人当たりの待ち時間（分）</span>
          <input
            type="number"
            min={0}
            value={input.current_wait_min}
            onChange={(event) => update('current_wait_min', Number(event.target.value))}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">待ち人数</span>
          <input
            type="number"
            min={0}
            value={input.current_queue_count}
            onChange={(event) => update('current_queue_count', Number(event.target.value))}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          />
        </label>
        <label className="sm:col-span-2 text-sm">
          <span className="mb-1 block text-muted-foreground">店舗位置</span>
          <select
            value={hasSelectedOption || store ? selectedKey : ''}
            onChange={(event) => selectLocation(event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          >
            {!hasSelectedOption && !store && (
              <option value="" disabled>
                場所を選択してください
              </option>
            )}
            {!hasSelectedOption && store && (
              <option value={selectedKey}>
                現在の位置: {input.floor}F（X:{input.map_x}% Y:{input.map_y}%）
              </option>
            )}
            {locationOptions.map((option) => (
              <option key={option.key} value={option.key} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">
            選択位置: {input.floor}F / X:{input.map_x}% / Y:{input.map_y}%　候補にない場所は
            <Link to="/admin/map" className="font-bold" style={{ color: 'var(--primary)' }}>
              マップ編集
            </Link>
            で追加できます。
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-foreground">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={input.is_open}
            onChange={(event) => update('is_open', event.target.checked)}
          />
          営業中
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={input.is_visible}
            onChange={(event) => update('is_visible', event.target.checked)}
          />
          来場者画面に表示
        </label>
      </div>

      <button
        type="button"
        onClick={() => onSubmit(input)}
        disabled={saving}
        className="mt-4 w-full rounded-xl py-3 font-bold text-white disabled:opacity-50"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        {saving ? '保存中...' : '保存する'}
      </button>

      {store && (onHide || onDelete) && (
        <div className="mt-6 space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-bold text-muted-foreground">店舗の停止・削除</h3>

          {onHide && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                来場者画面から隠して営業を止めます。データは残り、あとから戻せます。
              </p>
              <button
                type="button"
                onClick={onHide}
                disabled={saving || !store.is_visible}
                className="shrink-0 rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-40"
              >
                営業停止・非表示にする
              </button>
            </div>
          )}

          {onDelete && !confirmingDelete && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                店舗とその注文・メニュー・売上・ログインアカウントをすべて消します。元に戻せません。
              </p>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
                className="shrink-0 rounded-xl border border-red-500 px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-500/10 disabled:opacity-40"
              >
                完全に削除する
              </button>
            </div>
          )}

          {onDelete && confirmingDelete && (
            <div className="space-y-3 rounded-xl border border-red-500 bg-red-500/5 p-3">
              <p className="text-sm font-bold text-red-500">この操作は元に戻せません</p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                <li>店舗「{store.name}」</li>
                <li>注文履歴・売上（現在の収益 ¥{store.revenue.toLocaleString('ja-JP')} / {store.order_count}件）</li>
                <li>メニュー、売上入力、受付番号</li>
                <li>店舗のログインアカウントとマップ上の位置</li>
              </ul>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  確認のため、店舗名「{store.name}」を入力してください
                </span>
                <input
                  value={confirmName}
                  onChange={(event) => setConfirmName(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
                  autoComplete="off"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={saving || confirmName.trim() !== store.name.trim()}
                  className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  {saving ? '削除中...' : '完全に削除する'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setConfirmName('');
                  }}
                  disabled={saving}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm text-foreground hover:bg-muted"
                >
                  やめる
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
