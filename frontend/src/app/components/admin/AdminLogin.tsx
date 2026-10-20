import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Shield } from 'lucide-react';
import { ApiError, loginAdmin } from '../../lib/api';
import { loginAdminSession, useFestival } from '../../lib/festivalStore';

export default function AdminLogin() {
  const adminSession = useFestival((s) => s.adminSession);
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      loginAdminSession(result.login_id, result.token);
      navigate('/admin');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('ログインIDまたはパスワードが正しくありません。');
      } else if (e instanceof ApiError && e.status === 429) {
        setError('ログインの試行回数が多すぎます。1分ほど待ってから再試行してください。');
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

        <form
          className="space-y-3 rounded-2xl border border-border bg-card p-6 sm:p-8"
          action="/admin/login"
          method="post"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">ログインID</span>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <input
                name="admin_login_id"
                value={id}
                onChange={(e) => setId(e.target.value)}
                autoComplete="section-admin username"
                className="w-full bg-transparent py-2.5 text-foreground outline-none"
              />
            </div>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">パスワード</span>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <input
                name="admin_password"
                type={showPassword ? 'text' : 'password'}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="section-admin current-password"
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
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full rounded-xl py-3 font-bold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {submitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
