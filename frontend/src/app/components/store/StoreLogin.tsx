import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Store, KeyRound } from 'lucide-react';
import { useFestival, loginStore } from '../../lib/festivalStore';

export default function StoreLogin() {
  const session = useFestival((s) => s.session);
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');

  if (session) return <Navigate to="/store" replace />;

  // デモ用認証：店舗IDが入力され、パスワードが "festival" なら通過
  const submit = () => {
    if (!id.trim()) {
      setError('店舗IDを入力してください。');
      return;
    }
    if (pw !== 'festival') {
      setError('パスワードが正しくありません。（デモ: festival）');
      return;
    }
    loginStore(id.trim());
    navigate('/store');
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
          <span className="mb-1 block text-muted-foreground">店舗ID</span>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
            <Store className="h-4 w-4 text-muted-foreground" />
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="例: yatai-a"
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
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="festival"
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
          className="w-full rounded-xl py-3 font-bold text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          ログイン
        </button>
      </div>
    </div>
  );
}
