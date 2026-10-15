import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { fetchTicker, type TickerItem } from '../lib/api';
import { jstParts, timeLabel } from '../lib/eventSchedule';

/** 流すお知らせを取り直す間隔。イベントの時刻になったときや、緊急のお知らせをすぐ出すための定期確認 */
const TICKER_POLL_MS = 30_000;
/** 本文を何文字まで流すか（長すぎると読み終わる前に流れ去るため） */
const BODY_MAX_CHARS = 60;
const SEPARATOR = '　　　◆　　　';

function toText(item: TickerItem): string {
  const parts = jstParts(item.starts_at);
  const time = parts ? `【${timeLabel(parts.minutes)}〜】` : '';
  const flatBody = item.body.replace(/\s+/g, ' ').trim();
  const body = flatBody.length > BODY_MAX_CHARS ? `${flatBody.slice(0, BODY_MAX_CHARS)}…` : flatBody;
  return `${time}${item.title}${body ? `　${body}` : ''}`;
}

/**
 * ホームのヘッダーのすぐ下に出す電光掲示板（Layout.tsx でホームのときだけ表示）。
 * 管理画面で「掲示板に流す」を設定したイベントを、その時間帯だけ右から左へ流す。
 * 「掲示板にすぐ流す」にしたお知らせは、イベントより先に流す。
 * 流すものがないときも帯は出したままにして、「流れているお知らせはない」ことを示す。
 */
export default function HomeTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    let controller: AbortController | null = null;

    const load = () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      fetchTicker(current.signal)
        .then((next) => {
          if (!current.signal.aborted) setItems(next);
        })
        .catch(() => {
          // 掲示板は補助の表示。失敗しても、いま出ているものはそのままにする
        });
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };

    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, TICKER_POLL_MS);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      controller?.abort();
    };
  }, []);

  const text = useMemo(() => items.map(toText).join(SEPARATOR), [items]);

  // 文字数が多いほどゆっくり長く流して、読み終わる前に消えないようにする
  const duration = Math.max(14, 8 + text.length * 0.3);

  return (
    <Link
      to="/events"
      // ダークテーマでは背景と同化しないよう、シルバーの帯にする（白文字が読める濃さにしている）
      className="flex h-11 shrink-0 items-stretch overflow-hidden border-b border-border bg-[#15324a] text-white dark:bg-[#565f67]"
    >
      <span className="sr-only">
        {text ? `お知らせ: ${text}` : 'お知らせ: いま流れているお知らせはありません'}
      </span>
      <span
        className="flex shrink-0 items-center gap-1.5 px-3 text-sm font-bold text-white"
        style={{ backgroundColor: 'var(--accent)' }}
        aria-hidden="true"
      >
        <Megaphone className="h-4 w-4" />
        お知らせ
      </span>
      {text ? (
        <span className="relative min-w-0 flex-1 overflow-hidden" aria-hidden="true">
          {/* key を変えて、内容が変わったら最初から流し直す */}
          <span
            key={text}
            className="ticker-track absolute inset-y-0 left-0 flex items-center text-base font-bold"
            style={{ ['--ticker-duration' as string]: `${duration}s` }}
          >
            {text}
          </span>
        </span>
      ) : (
        <span
          className="flex min-w-0 flex-1 items-center truncate px-3 text-sm text-white/70"
          aria-hidden="true"
        >
          いま流れているお知らせはありません
        </span>
      )}
    </Link>
  );
}
