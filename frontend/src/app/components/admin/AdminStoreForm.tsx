import { useEffect, useState } from 'react';
import type { AdminStore, AdminStoreInput } from '../../lib/api';
import { findMapLocation, mapLocations } from '../../lib/mapLocations';

interface Props {
  store: AdminStore | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: AdminStoreInput) => void;
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
  current_wait_min: 0,
  current_queue_count: 0,
};

const storeTypes = [
  { value: 'booth', label: '体験' },
  { value: 'food', label: 'フード' },
  { value: 'shop', label: '物販' },
  { value: 'information', label: '案内' },
  { value: 'toilet', label: 'トイレ' },
  { value: 'first_aid', label: '救護室' },
  { value: 'support', label: 'サポート' },
] as const;

export default function AdminStoreForm({ store, saving, onCancel, onSubmit }: Props) {
  const [input, setInput] = useState<AdminStoreInput>(emptyInput);

  useEffect(() => {
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

  const selectedLocation = findMapLocation(input.floor, input.map_x, input.map_y);

  const selectLocation = (key: string) => {
    const location = mapLocations.find((item) => item.key === key);
    if (!location) return;
    setInput((current) => ({
      ...current,
      floor: location.floor,
      map_x: location.map_x,
      map_y: location.map_y,
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
          <span className="mb-1 block text-muted-foreground">待ち時間（分）</span>
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
            value={selectedLocation?.key ?? ''}
            onChange={(event) => selectLocation(event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          >
            <option value="" disabled>
              場所を選択してください
            </option>
            {mapLocations.map((location) => (
              <option key={location.key} value={location.key}>
                {location.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted-foreground">
            選択位置: {input.floor}F / X:{input.map_x}% / Y:{input.map_y}%
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
    </section>
  );
}
