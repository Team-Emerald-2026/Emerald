import { useEffect, useState } from 'react';
import type { AdminStore, AdminStoreInput } from '../../lib/api';

interface Props {
  store: AdminStore | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: AdminStoreInput) => void;
}

const emptyInput: AdminStoreInput = {
  name: '',
  description: '',
  ticket_prefix: '',
  login_id: '',
  password: '',
  is_open: true,
  is_visible: true,
  current_wait_min: 0,
  current_queue_count: 0,
};

export default function AdminStoreForm({ store, saving, onCancel, onSubmit }: Props) {
  const [input, setInput] = useState<AdminStoreInput>(emptyInput);

  useEffect(() => {
    if (!store) {
      setInput(emptyInput);
      return;
    }

    setInput({
      name: store.name,
      description: store.description ?? '',
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
          <span className="mb-1 block text-muted-foreground">店舗名</span>
          <input
            value={input.name}
            onChange={(event) => update('name', event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          />
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
