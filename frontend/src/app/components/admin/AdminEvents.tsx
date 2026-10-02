import { Fragment, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Edit3, ExternalLink, Plus, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminShell from './AdminShell';
import EventDayTabs from '../EventDayTabs';
import {
  ApiError,
  createAdminEvent,
  deleteAdminEvent,
  fetchAdminEvents,
  updateAdminEvent,
  type EventNotice,
  type EventNoticeInput,
} from '../../lib/api';
import {
  EVENT_DAYS,
  buildTimetableRows,
  classifyItem,
  defaultDayKey,
  getEventDay,
  jstParts,
  minutesToTime,
  noticesForDay,
  timeLabel,
  timeToMinutes,
  toStartsAt,
  type EventDayKey,
} from '../../lib/eventSchedule';
import { logoutAdminSession, useFestival } from '../../lib/festivalStore';
import { ADMIN_PUBLIC_ACCESS } from '../../lib/adminAccess';

type FormState = {
  title: string;
  body: string;
  type: 'event' | 'notice';
  /** 開催日（YYYY-MM-DD）。お知らせのみ '' = 両日共通 */
  day: string;
  /** HH:MM（イベントのみ） */
  time: string;
  is_published: boolean;
};

const emptyForm = (day: EventDayKey): FormState => ({
  title: '',
  body: '',
  type: 'event',
  day,
  time: '12:00',
  is_published: true,
});

function toForm(item: EventNotice, fallbackDay: EventDayKey): FormState {
  const parts = jstParts(item.starts_at);
  const knownDay = parts && getEventDay(parts.day) ? parts.day : '';

  if (item.type === 'notice') {
    return {
      title: item.title,
      body: item.body,
      type: 'notice',
      day: knownDay,
      time: '12:00',
      is_published: item.is_published ?? true,
    };
  }

  return {
    title: item.title,
    body: item.body,
    type: 'event',
    day: knownDay || fallbackDay,
    time: parts ? minutesToTime(parts.minutes) : '12:00',
    is_published: item.is_published ?? true,
  };
}

function noticeDayLabel(item: EventNotice) {
  const info = classifyItem(item);
  if (info.kind === 'notice') {
    return info.day ? (getEventDay(info.day)?.short ?? info.day) : '両日共通';
  }
  return '日程外';
}

export default function AdminEvents() {
  const adminSession = useFestival((s) => s.adminSession);
  const [items, setItems] = useState<EventNotice[]>([]);
  const [dayKey, setDayKey] = useState<EventDayKey>(defaultDayKey);
  const [editing, setEditing] = useState<EventNotice | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultDayKey()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadItems = (signal?: AbortSignal) => {
    if (!adminSession && !ADMIN_PUBLIC_ACCESS) return Promise.resolve();
    setLoading(true);
    setError('');
    return fetchAdminEvents(adminSession?.token, signal)
      .then((data) => setItems(data))
      .catch((err: unknown) => {
        if (signal?.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          logoutAdminSession();
          return;
        }
        setError('イベント・お知らせ一覧を取得できませんでした。');
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadItems(controller.signal);
    return () => controller.abort();
  }, [adminSession]);

  const classified = useMemo(() => items.map(classifyItem), [items]);
  const rows = useMemo(() => buildTimetableRows(classified, dayKey), [classified, dayKey]);
  const dayNotices = useMemo(() => noticesForDay(classified, dayKey), [classified, dayKey]);
  const allNotices = useMemo(
    () =>
      classified
        .filter((c) => c.kind === 'notice')
        .map((c) => c.item),
    [classified],
  );
  const orphans = useMemo(
    () =>
      classified
        .filter((c) => c.kind === 'orphan')
        .map((c) => c.item),
    [classified],
  );
  const formDay = getEventDay(form.day);

  const openCreate = (hour?: number) => {
    setEditing(null);
    setForm({
      ...emptyForm(dayKey),
      time: hour != null ? minutesToTime(hour * 60) : '12:00',
    });
    setShowForm(true);
    setMessage('');
    setError('');
  };

  const openCreateNotice = () => {
    setEditing(null);
    setForm({ ...emptyForm(dayKey), type: 'notice', day: dayKey });
    setShowForm(true);
    setMessage('');
    setError('');
  };

  const openEdit = (item: EventNotice) => {
    setEditing(item);
    setForm(toForm(item, dayKey));
    setShowForm(true);
    setMessage('');
    setError('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    if ((!adminSession && !ADMIN_PUBLIC_ACCESS) || saving) return;
    if (!form.title.trim()) {
      setError('タイトルを入力してください。');
      return;
    }
    if (!form.body.trim()) {
      setError('内容を入力してください。');
      return;
    }

    let startsAt: string | null = null;

    if (form.type === 'event') {
      const day = getEventDay(form.day);
      if (!day) {
        setError('開催日を選んでください。');
        return;
      }
      const minutes = timeToMinutes(form.time);
      if (minutes == null) {
        setError('時間を入力してください。');
        return;
      }
      if (minutes < day.startMinutes || minutes > day.endMinutes) {
        setError(
          `${day.label}は ${minutesToTime(day.startMinutes)}〜${minutesToTime(day.endMinutes)} の間で指定してください。`,
        );
        return;
      }
      startsAt = toStartsAt(day.key, form.time);
    } else if (form.day) {
      if (!getEventDay(form.day)) {
        setError('表示する日を選び直してください。');
        return;
      }
      startsAt = toStartsAt(form.day, '00:00');
    }

    // 終了時刻は付けない（公開は「公開する」のチェックで切り替える）
    const input: EventNoticeInput = {
      title: form.title.trim(),
      body: form.body.trim(),
      type: form.type,
      starts_at: startsAt,
      ends_at: null,
      is_published: form.is_published,
    };

    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (editing) {
        await updateAdminEvent(adminSession?.token, editing.id, input);
        setMessage('更新しました。来場者のイベント画面にも反映されます。');
      } else {
        await createAdminEvent(adminSession?.token, input);
        setMessage('作成しました。来場者のイベント画面にも反映されます。');
      }
      if (form.type === 'event' && getEventDay(form.day)) {
        setDayKey(form.day as EventDayKey);
      }
      closeForm();
      await loadItems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: EventNotice) => {
    if ((!adminSession && !ADMIN_PUBLIC_ACCESS) || saving) return;
    if (!window.confirm(`「${item.title}」を削除しますか？`)) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deleteAdminEvent(adminSession?.token, item.id);
      setMessage('削除しました。来場者画面からも消えます。');
      if (editing?.id === item.id) closeForm();
      await loadItems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '削除に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const renderEventItem = (item: EventNotice, minutes?: number) => (
    <div key={item.id} className="flex items-start gap-1 rounded-lg px-1 py-1 hover:bg-muted/60">
      <button type="button" onClick={() => openEdit(item)} className="min-w-0 flex-1 text-left">
        <p className="font-display text-base font-bold text-foreground">
          {minutes != null && (
            <span className="mr-2 text-xs font-bold tabular-nums text-muted-foreground">
              {timeLabel(minutes)}
            </span>
          )}
          {item.title}
          {!item.is_published && (
            <span className="ml-2 text-xs font-medium text-muted-foreground">（非公開）</span>
          )}
        </p>
        {item.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>}
      </button>
      <button
        type="button"
        onClick={() => openEdit(item)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        title="編集"
      >
        <Edit3 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => void remove(item)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-red-500 hover:bg-muted"
        title="削除"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const renderNoticeItem = (item: EventNotice, index: number) => (
    <li
      key={item.id}
      className={`flex items-start gap-2 px-3 py-3 ${index > 0 ? 'border-t border-border' : ''}`}
    >
      <button type="button" onClick={() => openEdit(item)} className="min-w-0 flex-1 text-left">
        <p className="font-display font-bold text-foreground">
          <span className="mr-2 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {noticeDayLabel(item)}
          </span>
          {item.title}
          {!item.is_published && (
            <span className="ml-2 text-xs font-medium text-muted-foreground">（非公開）</span>
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
      </button>
      <button
        type="button"
        onClick={() => openEdit(item)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
      >
        <Edit3 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => void remove(item)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-red-500 hover:bg-muted"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );

  return (
    <AdminShell title="イベント・お知らせ">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">時間割の編集</h2>
          <p className="text-sm text-muted-foreground">
            ここで保存すると、来場者の「イベント」タブにすぐ反映されます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/events"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" />
            来場者画面を見る
          </Link>
          <button
            type="button"
            onClick={openCreateNotice}
            className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-bold text-foreground hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            お知らせ
          </button>
          <button
            type="button"
            onClick={() => openCreate()}
            className="flex items-center gap-1 rounded-xl px-4 py-2 font-bold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Plus className="h-4 w-4" />
            イベント
          </button>
        </div>
      </div>

      {loading && (
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          読み込み中...
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm text-red-500">{error}</p>
      )}
      {message && (
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm" style={{ color: 'var(--ok)' }}>
          {message}
        </p>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div
            className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-lg sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-event-form-title"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 id="admin-event-form-title" className="font-display text-lg font-bold text-foreground">
                {editing ? '編集' : form.type === 'notice' ? 'お知らせを追加' : 'イベントを追加'}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"
                aria-label="閉じる"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto p-4">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">種別</span>
                <select
                  value={form.type}
                  onChange={(e) => {
                    const type = e.target.value as 'event' | 'notice';
                    setForm((prev) => ({
                      ...prev,
                      type,
                      // イベントは開催日が必須。お知らせは「両日共通」も選べる
                      day: type === 'event' && !getEventDay(prev.day) ? dayKey : prev.day,
                    }));
                  }}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground"
                >
                  <option value="event">イベント（時間割）</option>
                  <option value="notice">お知らせ</option>
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  {form.type === 'event' ? '開催日' : '表示する日'}
                </span>
                <select
                  value={form.day}
                  onChange={(e) => updateField('day', e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground"
                >
                  {form.type === 'notice' && <option value="">両日共通</option>}
                  {EVENT_DAYS.map((day) => (
                    <option key={day.key} value={day.key}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>

              {form.type === 'event' && (
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">
                    時間
                    {formDay && (
                      <span className="ml-2 text-xs">
                        （{minutesToTime(formDay.startMinutes)}〜{minutesToTime(formDay.endMinutes)}）
                      </span>
                    )}
                  </span>
                  <input
                    type="time"
                    value={form.time}
                    min={formDay ? minutesToTime(formDay.startMinutes) : undefined}
                    max={formDay ? minutesToTime(formDay.endMinutes) : undefined}
                    onChange={(e) => updateField('time', e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground"
                  />
                </label>
              )}

              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">タイトル</span>
                <input
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder={form.type === 'notice' ? '例: 呼び出し番号の見方' : '例: スペシャルゲスト登壇'}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
                  autoFocus
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">内容</span>
                <textarea
                  value={form.body}
                  onChange={(e) => updateField('body', e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground outline-none"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => updateField('is_published', e.target.checked)}
                />
                公開する（オフだと来場者には見えません）
              </label>

              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            <div className="flex gap-2 border-t border-border p-4">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving}
                className="flex-1 rounded-xl py-3 font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {saving ? '保存中...' : '保存する'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-border px-4 py-3 text-sm text-foreground hover:bg-muted"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3">
        <EventDayTabs value={dayKey} onChange={setDayKey} />
      </div>

      {/* 来場者と同じ時間割プレビュー＋行ごとの追加 */}
      <section className="mb-5">
        <h3 className="mb-2 px-1 text-sm font-bold text-muted-foreground">タイムテーブル（プレビュー）</h3>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-[4.5rem_1fr] border-b border-border bg-muted/50 text-xs font-bold text-muted-foreground">
            <div className="border-r border-border px-3 py-2.5">時間</div>
            <div className="px-3 py-2.5">内容</div>
          </div>
          {rows.map((row) => (
            <Fragment key={row.hour}>
              <div className="grid min-h-14 grid-cols-[4.5rem_1fr] border-b border-border last:border-b-0">
                <div className="border-r border-border bg-muted/30 px-3 py-3">
                  <span className="text-sm font-bold tabular-nums text-foreground">
                    {timeLabel(row.hour * 60)}
                  </span>
                </div>
                <div className="space-y-2 px-2 py-2">
                  {row.exact.map((item) => renderEventItem(item))}
                  {row.exact.length === 0 && (
                    <button
                      type="button"
                      onClick={() => openCreate(row.hour)}
                      className="flex w-full items-center gap-1 rounded-lg px-2 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      この時間に追加
                    </button>
                  )}
                </div>
              </div>
              {row.between.map(({ minutes, item }) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[4.5rem_1fr] border-b border-border bg-primary/5 last:border-b-0"
                >
                  <div className="flex items-start justify-end border-r border-border px-3 py-3">
                    <span className="text-xs font-bold tabular-nums text-muted-foreground">
                      {timeLabel(minutes)}
                    </span>
                  </div>
                  <div className="border-l-2 px-2 py-2" style={{ borderColor: 'var(--primary)' }}>
                    {renderEventItem(item)}
                  </div>
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-muted-foreground">
            お知らせ（{getEventDay(dayKey)?.short}と両日共通）
          </h3>
          <button
            type="button"
            onClick={openCreateNotice}
            className="text-xs font-bold"
            style={{ color: 'var(--primary)' }}
          >
            + 追加
          </button>
        </div>
        <ul className="overflow-hidden rounded-2xl border border-border bg-card">
          {dayNotices.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              この日のお知らせはまだありません
            </li>
          ) : (
            dayNotices.map((item, index) => renderNoticeItem(item, index))
          )}
        </ul>
        {allNotices.length > dayNotices.length && (
          <p className="px-1 text-xs text-muted-foreground">
            別の日のお知らせは、上の日付タブを切り替えると確認できます。
          </p>
        )}
      </section>

      {orphans.length > 0 && (
        <section className="mt-5 space-y-2">
          <h3 className="px-1 text-sm font-bold text-red-500">日程外のデータ（修正または削除してください）</h3>
          <p className="px-1 text-xs text-muted-foreground">
            開催日（10/24・10/25）に入っていないため、来場者画面には表示されません。
          </p>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {orphans.map((item, index) => renderNoticeItem(item, index))}
          </ul>
        </section>
      )}

      {!loading && items.length === 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-8 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">まだ登録がありません。「イベント」から追加してください。</p>
        </div>
      )}
    </AdminShell>
  );
}
