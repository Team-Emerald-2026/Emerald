import { useEffect, useMemo, useState } from 'react';
import type { TransitionEvent } from 'react';
import {
  fetchFestivalDay,
  fetchMonitorCallNumbers,
  type FestivalDay,
  type MonitorCallNumber,
} from '../lib/api';

/** 呼び出し番号の取得間隔（ミリ秒） */
const CALL_NUMBERS_INTERVAL_MS = 5000;
/** 本日フラグの再取得間隔（ミリ秒） */
const FESTIVAL_DAY_INTERVAL_MS = 30000;
/** スライド／呼び出し番号の切り替え間隔（ミリ秒） */
const ROTATE_INTERVAL_MS = 12000;
/** フェードイン／フェードアウトの時間（ミリ秒） */
const FADE_MS = 900;

type ImageSlide = {
  kind: 'image';
  src: string;
  label: string;
  /** 指定がある日だけ出す。未指定は両日 */
  days?: FestivalDay[];
};

type CallView = {
  kind: 'calls';
  left: MonitorCallNumber | null;
  right: MonitorCallNumber | null;
};

type MonitorView = ImageSlide | CallView;

type FadeLayer = {
  key: string;
  view: MonitorView;
  visible: boolean;
};

function viewKey(view: MonitorView): string {
  if (view.kind === 'image') return `image:${view.src}`;
  return `calls:${view.left?.store_id ?? '-'}:${view.right?.store_id ?? '-'}`;
}

const IMAGE_SLIDES: ImageSlide[] = [
  { kind: 'image', src: '/monitor-slides/slide-01.png', label: '京都テック学園祭2026' },
  { kind: 'image', src: '/monitor-slides/slide-02.png', label: '1F・2F' },
  { kind: 'image', src: '/monitor-slides/slide-03.png', label: '3F' },
  { kind: 'image', src: '/monitor-slides/slide-04.png', label: '4F' },
  { kind: 'image', src: '/monitor-slides/slide-05.png', label: '5F' },
  { kind: 'image', src: '/monitor-slides/slide-06.png', label: '6F' },
  { kind: 'image', src: '/monitor-slides/slide-07.png', label: '7F' },
  { kind: 'image', src: '/monitor-slides/slide-08.png', label: '8F' },
  { kind: 'image', src: '/monitor-slides/slide-09.png', label: 'スペシャルゲスト', days: ['day1'] },
];

function pairStores(
  stores: MonitorCallNumber[],
): Array<[MonitorCallNumber | null, MonitorCallNumber | null]> {
  const pairs: Array<[MonitorCallNumber | null, MonitorCallNumber | null]> = [];
  for (let i = 0; i < stores.length; i += 2) {
    pairs.push([stores[i] ?? null, stores[i + 1] ?? null]);
  }
  return pairs;
}

/**
 * 2店舗カードのあとに、同じ枠へ位置スライドを1枚入れる。
 * 店舗が無いときはスライドだけを回す。
 */
function buildViews(day: FestivalDay, stores: MonitorCallNumber[]): MonitorView[] {
  const slides = IMAGE_SLIDES.filter((slide) => !slide.days || slide.days.includes(day));
  const pairs = pairStores(stores);
  if (pairs.length === 0) return slides;

  const views: MonitorView[] = [];
  const rounds = Math.max(pairs.length, slides.length);
  for (let i = 0; i < rounds; i++) {
    const [left, right] = pairs[i % pairs.length];
    views.push({ kind: 'calls', left, right });
    views.push(slides[i % slides.length]);
  }
  return views;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * 校内モニター（階段上プロジェクター）向け画面。
 * 2店舗カードのあとに、同じ大きさの枠へ位置スライドを画像ごと出す。
 * 2日目はゲストスライドを出さない。
 */
export default function Monitor() {
  const [monitorData, setMonitorData] = useState<MonitorCallNumber[]>([]);
  const [festivalDay, setFestivalDay] = useState<FestivalDay>('day1');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasError, setHasError] = useState(false);
  const [viewIndex, setViewIndex] = useState(0);
  const [layers, setLayers] = useState<FadeLayer[]>([]);
  const now = useClock();

  useEffect(() => {
    IMAGE_SLIDES.forEach((slide) => {
      const image = new Image();
      image.src = slide.src;
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      fetchMonitorCallNumbers(controller.signal)
        .then((data) => {
          setMonitorData(data);
          setLastUpdated(new Date());
          setHasError(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setHasError(true);
        });
    };
    load();
    const timer = setInterval(load, CALL_NUMBERS_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      fetchFestivalDay(controller.signal)
        .then(setFestivalDay)
        .catch(() => {
          if (controller.signal.aborted) return;
        });
    };
    load();
    const timer = setInterval(load, FESTIVAL_DAY_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  const views = useMemo(() => buildViews(festivalDay, monitorData), [festivalDay, monitorData]);
  const viewCount = views.length;

  useEffect(() => {
    if (viewCount <= 1) return;
    const timer = setInterval(() => {
      setViewIndex((current) => (current + 1) % viewCount);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [viewCount]);

  const safeIndex = viewCount === 0 ? 0 : viewIndex % viewCount;
  const current = views[safeIndex];
  const currentKey = current ? viewKey(current) : '';

  useEffect(() => {
    if (!current) return;

    setLayers((prev) => {
      const shown = prev.find((layer) => layer.key === currentKey && layer.visible);
      if (shown) {
        return prev.map((layer) => (layer.key === currentKey ? { ...layer, view: current } : layer));
      }

      const next = prev.map((layer) => ({
        ...layer,
        visible: false,
        view: layer.key === currentKey ? current : layer.view,
      }));
      if (!next.some((layer) => layer.key === currentKey)) {
        next.push({ key: currentKey, view: current, visible: false });
      }
      return next;
    });

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setLayers((prev) =>
          prev.map((layer) => ({ ...layer, visible: layer.key === currentKey })),
        );
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [current, currentKey]);

  const handleFadeEnd = (event: TransitionEvent<HTMLDivElement>, key: string) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'opacity') return;
    setLayers((prev) => prev.filter((layer) => layer.visible || layer.key !== key));
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#0b1310] px-6 py-5 text-[#e8efec]">
      <header className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">呼び出し番号のご案内</h1>
          <p className="mt-1 text-sm text-[#93a39b]">
            番号が表示されたら、各店舗のカウンターまでお越しください。
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl font-bold tabular-nums">
            {now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="mt-1 text-xs text-[#93a39b]">
            {hasError
              ? '通信エラー：最後に取得した情報を表示しています'
              : lastUpdated
                ? `更新 ${lastUpdated.toLocaleTimeString('ja-JP')}`
                : '読み込み中…'}
          </p>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        {layers.length === 0 ? (
          <p className="grid h-full place-items-center text-xl text-[#93a39b]">読み込み中…</p>
        ) : (
          layers.map((layer) => (
            <div
              key={layer.key}
              className={`absolute inset-0 grid grid-cols-2 content-stretch gap-5 transition-opacity ease-in-out ${
                layer.visible ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ transitionDuration: `${FADE_MS}ms` }}
              onTransitionEnd={(event) => handleFadeEnd(event, layer.key)}
            >
              {layer.view.kind === 'image' ? (
                <SlidePanel slide={layer.view} />
              ) : (
                <>
                  <StorePanel entry={layer.view.left} />
                  <StorePanel entry={layer.view.right} />
                </>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}

function SlidePanel({ slide }: { slide: ImageSlide }) {
  return (
    <section className="relative col-span-2 h-full min-h-0 overflow-hidden rounded-3xl border border-[#243831] bg-[#7ec8ff]">
      <img
        src={slide.src}
        alt={slide.label}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </section>
  );
}

function StorePanel({ entry }: { entry: MonitorCallNumber | null }) {
  if (!entry) {
    return (
      <section className="flex h-full min-h-0 flex-col rounded-3xl border border-[#243831] bg-[#0f1a16] p-6 opacity-50">
        <p className="grid flex-1 place-items-center text-lg text-[#93a39b]">—</p>
      </section>
    );
  }

  if (entry.is_open === false) {
    return (
      <section className="flex h-full min-h-0 flex-col rounded-3xl border border-[#243831] bg-[#0f1a16] p-6 opacity-70">
        <StoreHeader entry={entry} />
        <p className="grid flex-1 place-items-center text-2xl text-[#93a39b]">準備中</p>
      </section>
    );
  }

  const calledNumbers = Array.isArray(entry.called_numbers) ? entry.called_numbers : [];

  return (
    <section className="flex h-full min-h-0 flex-col rounded-3xl border border-[#243831] bg-[#121d19] p-6">
      <StoreHeader entry={entry} />

      {calledNumbers.length === 0 ? (
        <p className="grid flex-1 place-items-center text-center text-2xl text-[#93a39b]">
          ただいまお呼び出し中の番号はありません
        </p>
      ) : (
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-center text-lg text-[#93a39b]">お呼び出し中</p>
          <ul className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {calledNumbers.map((number) => (
              <li
                key={number}
                className="rounded-3xl bg-[#2bc79a] px-6 py-2 font-display text-7xl font-bold text-[#06241b]"
              >
                {number}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 border-t border-[#243831] pt-3 text-right text-lg text-[#93a39b]">
        待ち{' '}
        <span className="font-display text-3xl font-bold text-[#e8efec]">{entry.waiting_count}</span>{' '}
        組
      </p>
    </section>
  );
}

function StoreHeader({ entry }: { entry: MonitorCallNumber }) {
  const locationName =
    entry.location_name && entry.location_name !== entry.store_name ? entry.location_name : null;

  return (
    <header className="flex items-baseline gap-3">
      {locationName && (
        <span className="rounded-lg bg-[#18241f] px-2.5 py-1 font-display text-lg font-bold text-[#2bc79a]">
          {locationName}
        </span>
      )}
      <h2 className="truncate font-display text-3xl font-bold">{entry.store_name}</h2>
    </header>
  );
}
