import { useEffect, useState } from 'react';
import { Building2, Clock, Pencil, Plus, Power, Trash2, Users } from 'lucide-react';
import StoreShell from './StoreShell';
import {
  createBoothMenuItem,
  deleteBoothMenuItem,
  fetchBoothMenuItems,
  fetchStoreProfile,
  updateBoothMenuItem,
  updateStoreProfile,
  updateWaitTime,
  type BackendMenuItem,
  type BoothKind,
  type StoreProfile as StoreProfileData,
} from '../../lib/api';
import { setWaitMinPerPerson, useFestival } from '../../lib/festivalStore';

const DEFAULT_WAIT_MIN_PER_PERSON = 5;

const boothTypes: Array<{ value: BoothKind; label: string }> = [
  { value: 'booth', label: '体験ブース' },
  { value: 'food', label: '飲食ブース' },
  { value: 'stage', label: 'イベントもの' },
];

const yen = (value: number) => `¥${value.toLocaleString('ja-JP')}`;

function toBoothKind(type?: string | null): BoothKind {
  if (type === 'food') return 'food';
  if (type === 'stage' || type === 'shop') return 'stage';
  return 'booth';
}

export default function StoreProfile() {
  const session = useFestival((s) => s.session);
  const waitingPeople = useFestival((s) => s.waiting);
  const storedWaitMin = useFestival((s) => s.waitMinPerPerson);
  const [profile, setProfile] = useState<StoreProfileData | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [boothType, setBoothType] = useState<BoothKind>('booth');
  const [waitMin, setWaitMin] = useState(DEFAULT_WAIT_MIN_PER_PERSON);
  const [isOpen, setIsOpen] = useState(true);
  const [menuItems, setMenuItems] = useState<BackendMenuItem[]>([]);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [productError, setProductError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    if (!session?.token) {
      setError('ログイン情報がありません。再度ログインしてください。');
      setLoading(false);
      return;
    }

    const token = session.token;
    Promise.all([fetchStoreProfile(token), fetchBoothMenuItems(token)])
      .then(([data, items]) => {
        setProfile(data);
        setName(data.name);
        setDescription(data.description ?? '');
        setBoothType(toBoothKind(data.type));
        setIsOpen(Boolean(data.is_open));
        setWaitMin(storedWaitMin > 0 ? storedWaitMin : DEFAULT_WAIT_MIN_PER_PERSON);
        setMenuItems(items.filter((item) => item.is_available !== false));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '店舗情報を取得できませんでした。');
      })
      .finally(() => setLoading(false));
  }, [session?.token]);

  const resetProductForm = () => {
    setProductName('');
    setProductPrice('');
    setEditingProductId(null);
    setProductError('');
  };

  const save = async () => {
    if (!session?.token || !profile) {
      setError('ログイン情報がありません。再度ログインしてください。');
      return;
    }
    if (!name.trim()) {
      setError('店舗名を入力してください。');
      return;
    }
    if (!description.trim()) {
      setError('説明を入力してください。');
      return;
    }
    if (!Number.isInteger(waitMin) || waitMin < 0) {
      setError('一人当たりの待ち時間は0以上の整数で入力してください。');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const updated = await updateStoreProfile(session.token, profile.id, {
        name: name.trim(),
        description: description.trim(),
        current_wait_min: waitingPeople * waitMin,
        is_open: isOpen,
        type: boothType,
      });
      setWaitMinPerPerson(waitMin);
      if (session.storeId) {
        await updateWaitTime(session.token, session.storeId, {
          current_wait_min: waitingPeople * waitMin,
          current_queue_count: waitingPeople,
        });
      }
      setProfile(updated);
      setName(updated.name);
      setDescription(updated.description ?? '');
      setBoothType(toBoothKind(updated.type));
      setIsOpen(Boolean(updated.is_open));
      setWaitMin(waitMin);
      setMessage('店舗情報を保存しました。');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const parsedPrice = Number(productPrice);
  const productPriceValid = Number.isInteger(parsedPrice) && parsedPrice >= 0;

  const saveProduct = async () => {
    if (!session?.token) {
      setProductError('ログイン情報がありません。再度ログインしてください。');
      return;
    }
    if (!productName.trim()) {
      setProductError('商品名を入力してください。');
      return;
    }
    if (!productPriceValid) {
      setProductError('値段は0以上の整数で入力してください。');
      return;
    }

    setSavingProduct(true);
    setProductError('');

    try {
      const payload = { name: productName.trim(), price: parsedPrice };
      if (editingProductId !== null) {
        const updated = await updateBoothMenuItem(session.token, editingProductId, payload);
        setMenuItems((current) =>
          current.map((item) => (String(item.id) === String(updated.id) ? updated : item)),
        );
      } else {
        const created = await createBoothMenuItem(session.token, payload);
        setMenuItems((current) => [...current, created]);
      }
      resetProductForm();
    } catch (err: unknown) {
      setProductError(err instanceof Error ? err.message : '商品の保存に失敗しました。');
    } finally {
      setSavingProduct(false);
    }
  };

  const startEditProduct = (item: BackendMenuItem) => {
    setEditingProductId(item.id);
    setProductName(item.name);
    setProductPrice(String(item.price));
    setProductError('');
  };

  const removeProduct = async (item: BackendMenuItem) => {
    if (!session?.token) {
      setProductError('ログイン情報がありません。再度ログインしてください。');
      return;
    }

    setSavingProduct(true);
    setProductError('');

    try {
      await deleteBoothMenuItem(session.token, item.id);
      setMenuItems((current) => current.filter((entry) => String(entry.id) !== String(item.id)));
      if (String(editingProductId) === String(item.id)) {
        resetProductForm();
      }
    } catch (err: unknown) {
      setProductError(err instanceof Error ? err.message : '商品の削除に失敗しました。');
    } finally {
      setSavingProduct(false);
    }
  };

  return (
    <StoreShell title="店舗情報">
      {loading && (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          読み込み中...
        </p>
      )}

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

      {profile && (
        <div className="space-y-4">
          <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <Building2 className="h-6 w-6 text-white" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">プロフィール編集</h2>
                <p className="text-sm text-muted-foreground">
                  店舗ID（問い合わせ時に使用）: {profile.id}
                </p>
              </div>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">店舗名</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">説明</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
              />
            </label>

            <fieldset className="text-sm">
              <legend className="mb-2 text-muted-foreground">ブース種別</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ブース種別">
                {boothTypes.map((type) => {
                  const active = boothType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setBoothType(type.value)}
                      className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: active ? 'var(--primary)' : 'var(--muted)',
                        color: active ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                      }}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isOpen ? '営業中' : '受付停止中'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isOpen
                    ? '来場者画面に営業中と表示します'
                    : '来場者画面に受付停止中と表示します'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isOpen}
                onClick={() => setIsOpen((current) => !current)}
                className="relative h-8 w-14 rounded-full transition-colors"
                style={{ backgroundColor: isOpen ? 'var(--ok)' : 'var(--muted)' }}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    isOpen ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
                <span className="sr-only">{isOpen ? '営業中' : '準備中'}</span>
              </button>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">一人当たりの待ち時間</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={180}
                  step={1}
                  value={waitMin}
                  onChange={(e) => setWaitMin(Number(e.target.value))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
                />
                <span className="shrink-0 text-sm text-muted-foreground">分</span>
              </div>
              <span className="mt-1 block text-xs text-muted-foreground">
                来場者画面の表示: 待ち人数{waitingPeople}人 × {waitMin}分 = 待ち約{waitingPeople * waitMin}分
              </span>
            </label>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full rounded-xl py-3 font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {saving ? '保存中...' : '保存する'}
            </button>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">商品</h2>
              <p className="text-sm text-muted-foreground">商品名と値段のみ登録・編集できます。</p>
            </div>

            {productError && (
              <p className="text-sm" style={{ color: 'var(--busy)' }}>
                {productError}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">商品名</span>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="例: 焼きそば"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">値段</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  placeholder="400"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
                />
              </label>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={saveProduct}
                  disabled={savingProduct}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl px-4 py-2.5 font-bold text-white disabled:opacity-60"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {editingProductId !== null ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {savingProduct ? '保存中...' : editingProductId !== null ? '更新' : '追加'}
                </button>
                {editingProductId !== null && (
                  <button
                    type="button"
                    onClick={resetProductForm}
                    className="min-h-11 rounded-xl border border-border px-3 py-2.5 text-sm text-foreground hover:bg-muted"
                  >
                    キャンセル
                  </button>
                )}
              </div>
            </div>

            {menuItems.length === 0 ? (
              <p className="rounded-xl border border-border bg-background p-4 text-center text-sm text-muted-foreground">
                登録されている商品はありません。
              </p>
            ) : (
              <ul className="space-y-2">
                {menuItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{yen(item.price)}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEditProduct(item)}
                        className="grid h-10 w-10 place-items-center rounded-lg border border-border text-foreground hover:bg-muted"
                        aria-label={`${item.name}を編集`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeProduct(item)}
                        disabled={savingProduct}
                        className="grid h-10 w-10 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-60"
                        style={{ color: 'var(--busy)' }}
                        aria-label={`${item.name}を削除`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <section className="rounded-2xl border border-border bg-card p-4">
              <Power className="h-5 w-5" style={{ color: isOpen ? 'var(--ok)' : 'var(--muted-foreground)' }} />
              <p className="mt-2 text-sm text-muted-foreground">営業状態</p>
              <p className="font-display text-2xl font-bold text-foreground">
                {isOpen ? '営業中' : '受付停止中'}
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <Clock className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              <p className="mt-2 text-sm text-muted-foreground">一人当たり待ち時間</p>
              <p className="font-display text-2xl font-bold text-foreground">
                {waitMin}
                <span className="ml-1 text-sm font-medium">分</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                表示待ち時間 {waitingPeople * waitMin}分
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <Users className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              <p className="mt-2 text-sm text-muted-foreground">待ち人数</p>
              <p className="font-display text-2xl font-bold text-foreground">
                {waitingPeople}
                <span className="ml-1 text-sm font-medium">人</span>
              </p>
            </section>
          </div>
        </div>
      )}
    </StoreShell>
  );
}
