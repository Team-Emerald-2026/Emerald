import { useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Power, Ticket, Trash2, Users } from 'lucide-react';
import StoreShell from './StoreShell';
import {
  createBoothMenuItem,
  deleteBoothMenuItem,
  fetchBoothMenuItems,
  fetchStoreProfile,
  setBoothMenuItemSoldOut,
  updateBoothMenuItem,
  updateStoreProfile,
  type BackendMenuItem,
  type BoothKind,
  type StoreProfile as StoreProfileData,
} from '../../lib/api';
import { useFestival } from '../../lib/festivalStore';

const boothTypes: Array<{ value: BoothKind; label: string }> = [
  { value: 'food', label: 'フード' },
  { value: 'booth', label: '体験' },
  { value: 'exhibit', label: '作品展示' },
  { value: 'information', label: '案内' },
  { value: 'shop', label: '金券販売' },
];

const yen = (value: number) => `¥${value.toLocaleString('ja-JP')}`;

function toBoothKind(type?: string | null): BoothKind {
  if (type === 'food' || type === 'exhibit' || type === 'information' || type === 'shop') return type;
  // 体験のほか、廃止した種類（イベントもの・トイレなど）は体験として扱う
  return 'booth';
}

export default function StoreProfile() {
  const session = useFestival((s) => s.session);
  const [profile, setProfile] = useState<StoreProfileData | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [boothType, setBoothType] = useState<BoothKind>('booth');
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
  // 整理券の設定（枚数と、非表示にした番号）
  const [ticketLimitInput, setTicketLimitInput] = useState('50');
  const [disabledTickets, setDisabledTickets] = useState<number[]>([]);
  const [ticketError, setTicketError] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [savingTickets, setSavingTickets] = useState(false);

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
        setMenuItems(items.filter((item) => item.is_available !== false));
        setTicketLimitInput(String(data.ticket_limit ?? 50));
        setDisabledTickets((data.disabled_ticket_numbers ?? []).map(Number));
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
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const updated = await updateStoreProfile(session.token, profile.id, {
        name: name.trim(),
        description: description.trim(),
        is_open: isOpen,
        type: boothType,
      });
      setProfile(updated);
      setName(updated.name);
      setDescription(updated.description ?? '');
      setBoothType(toBoothKind(updated.type));
      setIsOpen(Boolean(updated.is_open));
      setMessage('店舗情報を保存しました。');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  // いま保存されている整理券の枚数（画面の入力途中の値ではなく、サーバーに保存済みの値）
  const savedTicketLimit = Math.max(1, Number(profile?.ticket_limit) || 50);
  const parsedTicketLimit = Number(ticketLimitInput);
  const ticketLimitValid =
    Number.isInteger(parsedTicketLimit) && parsedTicketLimit >= 1 && parsedTicketLimit <= 999;

  /** 整理券の設定（枚数・非表示の番号）を保存する。店舗名などは保存済みの値を使う */
  const saveTicketSettings = async (nextLimit: number, nextDisabled: number[]) => {
    if (!session?.token || !profile) {
      setTicketError('ログイン情報がありません。再度ログインしてください。');
      return;
    }

    setSavingTickets(true);
    setTicketError('');
    setTicketMessage('');

    try {
      const updated = await updateStoreProfile(session.token, profile.id, {
        name: profile.name,
        description: profile.description ?? '',
        is_open: isOpen,
        ticket_limit: nextLimit,
        disabled_ticket_numbers: nextDisabled,
      });
      setProfile(updated);
      setTicketLimitInput(String(updated.ticket_limit ?? nextLimit));
      setDisabledTickets((updated.disabled_ticket_numbers ?? nextDisabled).map(Number));
      setTicketMessage('整理券の設定を保存しました。');
    } catch (err: unknown) {
      setTicketError(err instanceof Error ? err.message : '整理券の設定を保存できませんでした。');
    } finally {
      setSavingTickets(false);
    }
  };

  /** 番号をタップして、非表示（紛失）と再表示を切り替える */
  const toggleTicketNumber = (num: number) => {
    if (savingTickets) return;
    const next = disabledTickets.includes(num)
      ? disabledTickets.filter((n) => n !== num)
      : [...disabledTickets, num].sort((a, b) => a - b);
    setDisabledTickets(next);
    void saveTicketSettings(savedTicketLimit, next);
  };

  const saveTicketLimit = () => {
    if (!ticketLimitValid) {
      setTicketError('整理券の枚数は1〜999の整数で入力してください。');
      return;
    }
    void saveTicketSettings(parsedTicketLimit, disabledTickets);
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

  const toggleSoldOut = async (item: BackendMenuItem) => {
    if (!session?.token) {
      setProductError('ログイン情報がありません。再度ログインしてください。');
      return;
    }

    setSavingProduct(true);
    setProductError('');

    try {
      const updated = await setBoothMenuItemSoldOut(session.token, item.id, !item.is_sold_out);
      setMenuItems((current) =>
        current.map((entry) => (String(entry.id) === String(updated.id) ? updated : entry)),
      );
    } catch (err: unknown) {
      setProductError(err instanceof Error ? err.message : '売り切れの設定を変更できませんでした。');
    } finally {
      setSavingProduct(false);
    }
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
                  className={`absolute left-0 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    isOpen ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
                <span className="sr-only">{isOpen ? '営業中' : '受付停止中'}</span>
              </button>
            </div>

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
                      <div className="flex items-center gap-2">
                        <p
                          className={`truncate font-medium ${
                            item.is_sold_out ? 'text-muted-foreground line-through' : 'text-foreground'
                          }`}
                        >
                          {item.name}
                        </p>
                        {item.is_sold_out && (
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
                            style={{ backgroundColor: 'var(--busy-soft)', color: 'var(--busy)' }}
                          >
                            売り切れ
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{yen(item.price)}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleSoldOut(item)}
                        disabled={savingProduct}
                        className="min-h-10 rounded-lg border border-border px-3 text-xs font-bold text-foreground hover:bg-muted disabled:opacity-60"
                      >
                        {item.is_sold_out ? '販売再開' : '売り切れにする'}
                      </button>
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

          <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <Ticket className="h-6 w-6 text-white" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">整理券</h2>
                <p className="text-sm text-muted-foreground">
                  1〜{savedTicketLimit}番を順番に使い回します。無くした番号はタップで非表示にすると、発番のときに飛ばされます。
                </p>
              </div>
            </div>

            {ticketError && (
              <p className="text-sm" style={{ color: 'var(--busy)' }}>
                {ticketError}
              </p>
            )}
            {ticketMessage && (
              <p className="text-sm" style={{ color: 'var(--ok)' }}>
                {ticketMessage}
              </p>
            )}

            <div className="flex items-end gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">整理券の枚数（増やすと追加）</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  step={1}
                  value={ticketLimitInput}
                  onChange={(e) => setTicketLimitInput(e.target.value)}
                  className="w-28 rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
                />
              </label>
              <button
                type="button"
                onClick={saveTicketLimit}
                disabled={savingTickets}
                className="min-h-11 rounded-xl px-4 py-2.5 font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {savingTickets ? '保存中...' : '枚数を保存'}
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              使用できる番号:{' '}
              <span className="font-bold text-foreground">
                {savedTicketLimit - disabledTickets.filter((n) => n <= savedTicketLimit).length}
              </span>{' '}
              / {savedTicketLimit} 枚
              {disabledTickets.filter((n) => n <= savedTicketLimit).length > 0 && (
                <>
                  （非表示: {disabledTickets.filter((n) => n <= savedTicketLimit).join(', ')}番）
                </>
              )}
            </p>

            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
              {Array.from({ length: savedTicketLimit }, (_, i) => i + 1).map((num) => {
                const hidden = disabledTickets.includes(num);
                return (
                  <button
                    key={num}
                    type="button"
                    role="switch"
                    aria-checked={!hidden}
                    aria-label={`整理券${num}番を${hidden ? '再表示' : '非表示に'}する`}
                    onClick={() => toggleTicketNumber(num)}
                    disabled={savingTickets}
                    className={`min-h-10 rounded-lg border text-sm font-bold transition-colors disabled:opacity-60 ${
                      hidden
                        ? 'border-border bg-muted text-muted-foreground line-through'
                        : 'border-border bg-background text-foreground hover:bg-muted'
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              グレー（取り消し線）の番号は非表示中です。もう一度タップすると再表示されます。
            </p>
          </section>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-4">
              <Power className="h-5 w-5" style={{ color: isOpen ? 'var(--ok)' : 'var(--muted-foreground)' }} />
              <p className="mt-2 text-sm text-muted-foreground">営業状態</p>
              <p className="font-display text-2xl font-bold text-foreground">
                {isOpen ? '営業中' : '受付停止中'}
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <Users className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              <p className="mt-2 text-sm text-muted-foreground">待ち人数</p>
              <p className="font-display text-2xl font-bold text-foreground">
                {Number(profile.current_queue_count) || 0}
                <span className="ml-1 text-sm font-medium">人</span>
              </p>
            </section>
          </div>
        </div>
      )}
    </StoreShell>
  );
}
