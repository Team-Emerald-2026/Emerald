import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  BarChart3,
  KeyRound,
  Store,
} from 'lucide-react';

type StoreType = 'food' | 'booth';

type AdminStore = {
  id: string;
  name: string;
  description: string;
  type: StoreType;
  login_id: string;
  password?: string;
};

// TODO(API): GET 店舗一覧 / 総収益 に差し替え
const INITIAL_STORES: AdminStore[] = [
  {
    id: 'store-101',
    name: 'KTCカフェ',
    description: '学園祭限定メニューを提供するカフェ',
    type: 'food',
    login_id: 'cafe01',
  },
  {
    id: 'store-102',
    name: 'やきそば',
    description: '人気のやきそば',
    type: 'food',
    login_id: 'yaki01',
  },
];

const typeLabel = (type: StoreType) => (type === 'food' ? 'フード' : 'ブース');

export default function Admin() {
  const [stores, setStores] = useState<AdminStore[]>(INITIAL_STORES);
  // TODO(API): GET 総収益
  const [totalRevenue] = useState(123450);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<StoreType>('food');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [issued, setIssued] = useState<AdminStore | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<StoreType>('food');

  const resetForm = () => {
    setName('');
    setDescription('');
    setType('food');
    setLoginId('');
    setPassword('');
  };

  const createStore = () => {
    setError('');
    setMessage('');
    setIssued(null);

    if (!name.trim()) {
      setError('店舗名を入力してください。');
      return;
    }
    if (!description.trim()) {
      setError('説明を入力してください。');
      return;
    }
    if (!loginId.trim()) {
      setError('ログインIDを入力してください。');
      return;
    }
    if (password.length < 8) {
      setError('パスワードは8文字以上にしてください。');
      return;
    }
    if (stores.some((s) => s.login_id === loginId.trim())) {
      setError('このログインIDは既に使われています。');
      return;
    }

    // TODO(API): POST 店舗作成（login_id / password 発行）
    const created: AdminStore = {
      id: `store-${Math.random().toString(36).slice(2, 10)}`,
      name: name.trim(),
      description: description.trim(),
      type,
      login_id: loginId.trim(),
      password,
    };

    setStores((prev) => [...prev, created]);
    setIssued(created);
    setMessage('店舗を作成しました。下のID・パスワードを店舗リーダーに伝えてください。');
    resetForm();
  };

  const startEdit = (store: AdminStore) => {
    setEditingId(store.id);
    setEditName(store.name);
    setEditDescription(store.description);
    setEditType(store.type);
    setError('');
    setMessage('');
  };

  const saveEdit = () => {
    if (!editingId) return;
    if (!editName.trim()) {
      setError('店舗名を入力してください。');
      return;
    }
    if (!editDescription.trim()) {
      setError('説明を入力してください。');
      return;
    }

    // TODO(API): PATCH 店舗編集
    setStores((prev) =>
      prev.map((s) =>
        s.id === editingId
          ? {
              ...s,
              name: editName.trim(),
              description: editDescription.trim(),
              type: editType,
            }
          : s,
      ),
    );
    setEditingId(null);
    setMessage('店舗情報を更新しました。（画面のみ・API未接続）');
  };

  const removeStore = (id: string) => {
    if (!window.confirm('この店舗を削除しますか？')) return;
    // TODO(API): DELETE 店舗削除
    setStores((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
    if (issued?.id === id) setIssued(null);
    setMessage('店舗を削除しました。（画面のみ・API未接続）');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">管理者</p>
          <h1 className="truncate font-display text-base font-bold text-foreground">管理画面</h1>
        </div>
        <Link
          to="/store/login"
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
        >
          ログインへ
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4">
        {error && (
          <p className="rounded-xl border border-border bg-card p-3 text-sm" style={{ color: 'var(--busy)' }}>
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-xl border border-border bg-card p-3 text-sm" style={{ color: 'var(--ok)' }}>
            {message}
          </p>
        )}

        {/* 総収益 */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" />
            総収益
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            ¥{totalRevenue.toLocaleString('ja-JP')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">※ 仮データ（API接続後に更新）</p>
        </section>

        {/* 新規店舗作成 */}
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Plus className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            新規店舗の作成
          </h2>

          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">店舗名</span>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
              <Store className="h-4 w-4 text-muted-foreground" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: たこ焼き屋"
                className="w-full bg-transparent py-2.5 text-foreground outline-none"
              />
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">説明</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="店舗の説明"
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">種別</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as StoreType)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
            >
              <option value="food">フード</option>
              <option value="booth">ブース（体験など）</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">ログインID（店舗リーダーに伝える）</span>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="例: takoyaki01"
                className="w-full bg-transparent py-2.5 text-foreground outline-none"
              />
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">パスワード（店舗リーダーに伝える）</span>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8文字以上"
                className="w-full bg-transparent py-2.5 text-foreground outline-none"
              />
            </div>
          </label>

          <button
            type="button"
            onClick={createStore}
            className="w-full rounded-xl py-3 font-bold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            店舗を作成してIDを発行
          </button>

          {issued && (
            <div
              className="rounded-xl border p-3 text-sm"
              style={{ borderColor: 'var(--ok)', backgroundColor: 'var(--ok-soft)' }}
            >
              <p className="font-bold text-foreground">発行情報（リーダーに伝えてください）</p>
              <p className="mt-2 text-foreground">店舗: {issued.name}</p>
              <p className="text-foreground">ログインID: {issued.login_id}</p>
              <p className="text-foreground">パスワード: {issued.password}</p>
            </div>
          )}
        </section>

        {/* 店舗一覧 */}
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-foreground">
            店舗一覧（{stores.length}）
          </h2>

          {stores.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
              店舗がありません。上のフォームから作成してください。
            </p>
          ) : (
            <ul className="space-y-3">
              {stores.map((store) => (
                <li key={store.id} className="rounded-2xl border border-border bg-card p-4">
                  {editingId === store.id ? (
                    <div className="space-y-3">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none"
                      />
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as StoreType)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none"
                      >
                        <option value="food">フード</option>
                        <option value="booth">ブース（体験など）</option>
                      </select>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="flex-1 rounded-xl py-2 text-sm font-bold text-white"
                          style={{ backgroundColor: 'var(--primary)' }}
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="flex-1 rounded-xl border border-border py-2 text-sm font-bold text-foreground hover:bg-muted"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-foreground">{store.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{store.description}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {typeLabel(store.type)} · ID: {store.login_id} · {store.id}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(store)}
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStore(store.id)}
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-muted"
                          style={{ color: 'var(--busy)' }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          削除
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 分析（後続） */}
        <section className="rounded-2xl border border-dashed border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            データ集計・分析・可視化
          </div>
          <p className="mt-2 text-sm text-muted-foreground">準備中（API・集計ができてから実装）</p>
        </section>
      </main>
    </div>
  );
}
