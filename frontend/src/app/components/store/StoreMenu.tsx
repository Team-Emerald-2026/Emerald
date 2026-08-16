import { useCallback, useEffect, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import StoreShell from './StoreShell';
import { useFestival } from '../../lib/festivalStore';
import {
  createMenuItem,
  deleteMenuItem,
  fetchMenuItems,
  updateMenuItem,
  type MenuItem,
} from '../../lib/api';

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

const emptyForm = {
  name: '',
  description: '',
  price: '',
  is_available: true,
};

export default function StoreMenu() {
  const session = useFestival((s) => s.session);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!session?.token) {
      setError('ログイン情報がありません。再度ログインしてください。');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchMenuItems(session.token);
      setItems(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '商品一覧の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? '',
      price: String(item.price),
      is_available: item.is_available,
    });
    setMessage('');
    setError('');
  };

  const save = async () => {
    if (!session?.token) {
      setError('ログイン情報がありません。再度ログインしてください。');
      return;
    }
    if (!form.name.trim()) {
      setError('商品名を入力してください。');
      return;
    }
    const price = Number(form.price);
    if (!Number.isInteger(price) || price < 0) {
      setError('価格は0以上の整数で入力してください。');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      is_available: form.is_available,
    };

    try {
      if (editingId) {
        await updateMenuItem(session.token, editingId, payload);
        setMessage('商品を更新しました。');
      } else {
        await createMenuItem(session.token, payload);
        setMessage('商品を追加しました。');
      }
      resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!session?.token) return;
    if (!window.confirm('この商品を削除しますか？')) return;

    setError('');
    setMessage('');
    try {
      await deleteMenuItem(session.token, id);
      if (editingId === id) resetForm();
      setMessage('商品を削除しました。');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '削除に失敗しました。');
    }
  };

  const toggleAvailable = async (item: MenuItem) => {
    if (!session?.token) return;
    try {
      await updateMenuItem(session.token, item.id, { is_available: !item.is_available });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '販売状態の更新に失敗しました。');
    }
  };

  return (
    <StoreShell title="商品管理">
      {error && (
        <p
          className="mb-4 rounded-xl border border-border bg-card p-4 text-sm"
          style={{ color: 'var(--busy)' }}
        >
          {error}
        </p>
      )}
      {message && (
        <p
          className="mb-4 rounded-xl border border-border bg-card p-4 text-sm"
          style={{ color: 'var(--ok)' }}
        >
          {message}
        </p>
      )}

      <section className="mb-5 space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <UtensilsCrossed className="h-6 w-6 text-white" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              {editingId ? '商品を編集' : '商品を追加'}
            </h2>
            <p className="text-sm text-muted-foreground">
              来場者の注文画面とレジに反映されます
            </p>
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">商品名</span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">説明</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">価格（円）</span>
          <input
            type="number"
            min={0}
            step={1}
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.is_available}
            onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.checked }))}
          />
          販売中にする
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-xl py-3 font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {saving ? '保存中...' : editingId ? '更新する' : '追加する'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              キャンセル
            </button>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="px-1 font-display text-base font-bold text-foreground">登録済み商品</h3>
        {loading ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
            読み込み中...
          </p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
            まだ商品がありません
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground">{item.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {item.description?.trim() || '説明なし'}
                    </p>
                    <p className="mt-1 font-display text-lg font-bold text-foreground">
                      {yen(item.price)}
                    </p>
                    <p
                      className="mt-1 text-xs"
                      style={{ color: item.is_available ? 'var(--ok)' : 'var(--busy)' }}
                    >
                      {item.is_available ? '販売中' : '非売'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleAvailable(item)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      {item.is_available ? '非売にする' : '販売する'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(item.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      style={{ color: 'var(--busy)' }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </StoreShell>
  );
}
