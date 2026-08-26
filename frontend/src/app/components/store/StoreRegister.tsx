import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Store, KeyRound, UserRound } from 'lucide-react';
import { registerStore } from '../../lib/api';
import { useFestival, loginStore } from '../../lib/festivalStore';

export default function StoreRegister() {
  const session = useFestival((s) => s.session);
  const navigate = useNavigate();

  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to="/store" replace />;

  const submit = async () => {
    if (!storeName.trim()) {
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

    setLoading(true);
    setError('');

    try {
      const result = await registerStore({
        store_name: storeName.trim(),
        description: description.trim(),
        login_id: loginId.trim(),
        password,
      });

      loginStore(result.store_id, result.token);
      navigate('/store');
    } catch (err) {
      const message = err instanceof Error ? err.message : '登録に失敗しました。';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 bg-background p-6">
      <div className="text-center">
        <span
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Store className="h-7 w-7 text-white" />
        </span>
        <h1 className="mt-3 font-display text-2xl font-bold text-foreground">店舗新規登録</h1>
        <p className="text-sm text-muted-foreground">京都TECH学園祭 店舗向け管理画面</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">店舗名</span>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
            <Store className="h-4 w-4 text-muted-foreground" />
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
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
            placeholder="例: 学園祭限定メニュー"
            rows={2}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">ログインID</span>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="例: takoyaki01"
              className="w-full bg-transparent py-2.5 text-foreground outline-none"
            />
          </div>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">パスワード（8文字以上）</span>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && submit()}
              placeholder="8文字以上"
              className="w-full bg-transparent py-2.5 text-foreground outline-none"
            />
          </div>
        </label>

        {error && (
          <p className="text-sm" style={{ color: 'var(--busy)' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="w-full rounded-xl py-3 font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          {loading ? '登録中...' : '登録する'}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          すでにアカウントがある場合は{' '}
          <Link to="/store/login" className="underline" style={{ color: 'var(--primary)' }}>
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}