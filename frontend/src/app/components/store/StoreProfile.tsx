import { useEffect, useState } from 'react';
import { Building2, Clock, Users } from 'lucide-react';
import StoreShell from './StoreShell';
import {
  fetchStoreProfile,
  updateStoreProfile,
  type StoreProfile as StoreProfileData,
} from '../../lib/api';
import { useFestival } from '../../lib/festivalStore';

export default function StoreProfile() {
  const session = useFestival((s) => s.session);
  const [profile, setProfile] = useState<StoreProfileData | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.token) {
      setError('ログイン情報がありません。再度ログインしてください。');
      setLoading(false);
      return;
    }

    fetchStoreProfile(session.token)
      .then((data) => {
        setProfile(data);
        setName(data.name);
        setDescription(data.description ?? '');
        setIsOpen(data.is_open);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '店舗情報を取得できませんでした。');
      })
      .finally(() => setLoading(false));
  }, [session?.token]);

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
      });
      setProfile(updated);
      setName(updated.name);
      setDescription(updated.description ?? '');
      setIsOpen(updated.is_open);
      setMessage('店舗情報を保存しました。');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
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
                <p className="text-sm text-muted-foreground">店舗ID: {profile.id}</p>
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

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isOpen}
                onChange={(e) => setIsOpen(e.target.checked)}
              />
              営業中にする
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

          <div className="grid grid-cols-2 gap-3">
            <section className="rounded-2xl border border-border bg-card p-4">
              <Clock className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              <p className="mt-2 text-sm text-muted-foreground">待ち時間</p>
              <p className="font-display text-2xl font-bold text-foreground">
                {profile.current_wait_min}
                <span className="ml-1 text-sm font-medium">分</span>
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <Users className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              <p className="mt-2 text-sm text-muted-foreground">待ち人数</p>
              <p className="font-display text-2xl font-bold text-foreground">
                {profile.current_queue_count}
                <span className="ml-1 text-sm font-medium">人</span>
              </p>
            </section>
          </div>
        </div>
      )}
    </StoreShell>
  );
}