import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Shield } from 'lucide-react';
import { ApiError, loginAdmin } from '../../lib/api';
import { loginAdminSession, useFestival } from '../../lib/festivalStore';

export default function AdminLogin() {
  const session = useFestival((s) => s.session);
  const adminSession = useFestival((s) => s.adminSession);
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Navigate to="/store" replace />;
  if (adminSession) return <Navigate to="/admin" replace />;

  const submit = async () => {
    if (submitting) return;
    if (!id.trim()) {
      setError('ログインIDを入力してください。');
      return;
    }
    if (!pw) {
      setError('パスワードを入力してください。');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await loginAdmin(id.trim(), pw);
      loginAdminSession(result.login_id);
      navigate('/admin');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('ログインIDまたはパスワードが正しくありません。');
      } else {
        setError('ログインに失敗しました。時間をおいて再試行してください。');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div className="text-center">
          <span
            className="mx-auto grid h-14 w-14 place-items-center rounded-2xl"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Shield className="h-7 w-7 text-white" />
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold text-foreground">管理者ログイン</h1>
          <p className="text-sm text-muted-foreground">京都TECH学園祭 管理者向け管理画面</p>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">ログインID</span>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                autoComplete="username"
                className="w-full bg-transparent py-2.5 text-foreground outline-none"
              />
            </div>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">パスワード</span>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                autoComplete="current-password"
                className="w-full bg-transparent py-2.5 text-foreground outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                className="grid h-11 w-11 place-items-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
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
            disabled={submitting}
            className="min-h-12 w-full rounded-xl py-3 font-bold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {submitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </div>
      </div>
    </div>
  );
}
