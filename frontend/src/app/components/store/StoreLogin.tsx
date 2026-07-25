import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Store, KeyRound } from 'lucide-react';
import { loginStoreAccount } from '../../lib/api';
import { useFestival, loginStore } from '../../lib/festivalStore';
import { ApiError, loginBooth } from '../../lib/api';

const TOKEN_KEY = 'kt_store_token';

export default function StoreLogin() {
  const session = useFestival((s) => s.session);
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to="/store" replace />;

  const submit = async () => {
    if (!loginId.trim()) {
      setError('ログインIDを入力してください。');
      return;
    }
    if (!pw) {
      setError('パスワードを入力してください。');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await loginStoreAccount({
        login_id: loginId.trim(),
        password: pw,
      });

      localStorage.setItem(TOKEN_KEY, result.token);
      loginStore(result.store_id);
      navigate('/store');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ログインに失敗しました。';
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
        <h1 className="mt-3 font-display text-2xl font-bold text-foreground">店舗ログイン</h1>
        <p className="text-sm text-muted-foreground">京都TECH学園祭 店舗向け管理画面</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">ログインID</span>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
            <Store className="h-4 w-4 text-muted-foreground" />
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="例: takoyaki01"
              className="w-full bg-transparent py-2.5 text-foreground outline-none"
            />
          </div>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">パスワード</span>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && submit()}
              placeholder="パスワード"
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
          {loading ? 'ログイン中...' : 'ログイン'}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          初めての方は{' '}
          <Link to="/store/register" className="underline" style={{ color: 'var(--primary)' }}>
            新規登録
          </Link>
        </p>
      </div>
    </div>
  );
}