import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TransitionEvent } from 'react';
import { fetchMonitorCallNumbers, type MonitorCallNumber } from '../lib/api';

/** 呼び出し番号の取得間隔（ミリ秒） */
const CALL_NUMBERS_INTERVAL_MS = 5000;
/** カードを1枚分スワイプする間隔（ミリ秒） */
const ROTATE_INTERVAL_MS = 12000;
/** スワイプのアニメーション時間（ミリ秒） */
const SWIPE_MS = 700;
/** 同時に見える2枚のあいだのすき間（ピクセル） */
const CARD_GAP_PX = 20;

/**
 * 呼び出し番号カードの横に出す案内カードの中身。
 * 先生のパワポが届くまでは、下の TEST_SLIDES を流す。
 * 本番の画像（png / jpg / webp）を assets/monitor-slides に置くと、ファイル名の昇順でそちらに切り替わる。
 */
type MonitorSlide =
  | { kind: 'image'; src: string; label: string }
  | {
      kind: 'test';
      label: string;
      kicker: string;
      title: string;
      lines: string[];
      background: string;
      accent: string;
    };

const TEST_SLIDES: MonitorSlide[] = [
  {
    kind: 'test',
    label: 'テスト: 学園祭のご案内',
    kicker: 'TEST 01',
    title: '学園祭のご案内',
    lines: ['表示確認用のテストスライドです'],
    background: '#0d3b31',
    accent: '#2bc79a',
  },
  {
    kind: 'test',
    label: 'テスト: 呼び出し番号の見方',
    kicker: 'TEST 02',
    title: 'A-12',
    lines: ['呼び出し番号の見方', '番号が出たら、各店舗のカウンターへ'],
    background: '#10241f',
    accent: '#2bc79a',
  },
  {
    kind: 'test',
    label: 'テスト: 今日のプログラム',
    kicker: 'TEST 03',
    title: '今日のプログラム（仮）',
    lines: ['10:00  開場', '12:00  ステージ発表', '15:00  抽選会'],
    background: '#142820',
    accent: '#e7a598',
  },
  {
    kind: 'test',
    label: 'テスト: 会場のご案内',
    kicker: 'TEST 04',
    title: '会場のご案内（仮）',
    lines: ['1F 飲食　　2F 展示　　3F ステージ'],
    background: '#101c28',
    accent: '#7eb6ff',
  },
  {
    kind: 'test',
    label: 'テスト: ご来場のお願い',
    kicker: 'TEST 05',
    title: 'ご来場のお願い',
    lines: ['通路はゆずり合ってお進みください', '係員の指示にお従いください'],
    background: '#2a2114',
    accent: '#f0b429',
  },
  {
    kind: 'test',
    label: 'テスト: 本番の資料は準備中',
    kicker: 'TEST 06',
    title: '本番の資料は準備中',
    lines: ['パワポの画像が届き次第、この表示を差し替えます'],
    background: '#1a1f2b',
    accent: '#c4b5fd',
  },
];

const slideModules = import.meta.glob('../../assets/monitor-slides/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
});

function monitorImageSlides(): MonitorSlide[] {
  return Object.entries(slideModules)
    .sort(([a], [b]) => {
      const nameA = a.split(/[/\\]/).pop() ?? a;
      const nameB = b.split(/[/\\]/).pop() ?? b;
      return nameA.localeCompare(nameB, 'en');
    })
    .map(([path, src], index) => ({
      kind: 'image' as const,
      src: String(src),
      label: `案内スライド ${index + 1}`,
    }));
}

type MonitorCard =
  | { kind: 'store'; key: string; entry: MonitorCallNumber }
  | { kind: 'slide'; key: string; slide: MonitorSlide };

/** ブースとスライドを交互に並べる。店舗がないときはスライドだけ、スライドがないときは店舗だけ。 */
function buildStrip(stores: MonitorCallNumber[], slides: MonitorSlide[]): MonitorCard[] {
  if (stores.length === 0) {
    return slides.map((slide, index) => ({ kind: 'slide', key: `slide-${index}`, slide }));
  }
  if (slides.length === 0) {
    return stores.map((entry, index) => ({
      kind: 'store',
      key: `store-${index}-${entry.store_id}`,
      entry,
    }));
  }

  const count = Math.max(stores.length, slides.length);
  const cards: MonitorCard[] = [];
  for (let index = 0; index < count; index += 1) {
    const entry = stores[index % stores.length];
    const slide = slides[index % slides.length];
    cards.push({ kind: 'store', key: `store-${index}-${entry.store_id}`, entry });
    cards.push({ kind: 'slide', key: `slide-${index}`, slide });
  }
  return cards;
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
 * 校内モニター（プロジェクター）向け呼び出し番号。
 * ブースとスライドを交互に並べ、2枚だけ見せて1枚分ずつスワイプする。
 */
export default function Monitor() {
  const [monitorData, setMonitorData] = useState<MonitorCallNumber[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasError, setHasError] = useState(false);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(0);
  const now = useClock();
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      fetchMonitorCallNumbers(controller.signal)
        .then((data) => {
          setMonitorData(data);
          setLastUpdated(new Date());
          setHasError(false);
          setReady(true);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setHasError(true);
          setReady(true);
        });
    };
    load();
    const timer = setInterval(load, CALL_NUMBERS_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  const imageSlides = useMemo(() => monitorImageSlides(), []);
  const slides = imageSlides.length > 0 ? imageSlides : TEST_SLIDES;
  const cards = useMemo(
    () => (ready ? buildStrip(monitorData, slides) : []),
    [ready, monitorData, slides],
  );
  const cardsKey = cards.map((card) => card.key).join('|');
  const track = useMemo(() => {
    if (cards.length < 2) return cards;
    return [
      ...cards,
      { ...cards[0], key: `loop-a-${cards[0].key}` },
      { ...cards[1], key: `loop-b-${cards[1].key}` },
    ];
  }, [cards]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      setCardWidth(Math.max(0, (viewport.clientWidth - CARD_GAP_PX) / 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setAnimate(false);
    setIndex(0);
  }, [cardsKey]);

  useEffect(() => {
    if (cards.length <= 1) return;
    const timer = window.setInterval(() => {
      setAnimate(true);
      setIndex((current) => current + 1);
    }, ROTATE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [cards.length]);

  const safeIndex = cards.length === 0 ? 0 : index % cards.length;

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    if (cards.length > 0 && index >= cards.length) {
      setAnimate(false);
      setIndex(0);
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0b1310] px-6 py-5 text-[#e8efec]">
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

      <main ref={viewportRef} className="min-h-0 flex-1 overflow-hidden">
        {cards.length === 0 ? (
          <p className="grid h-full place-items-center text-xl text-[#93a39b]">
            {ready ? 'ただいま表示する店舗はありません' : '読み込み中…'}
          </p>
        ) : (
          <div
            className="flex h-full"
            style={{
              gap: CARD_GAP_PX,
              transform: `translateX(-${index * (cardWidth + CARD_GAP_PX)}px)`,
              transition:
                animate && !reduceMotion
                  ? `transform ${SWIPE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
                  : 'none',
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {track.map((card) => (
              <div key={card.key} className="h-full shrink-0" style={{ width: cardWidth || undefined }}>
                {card.kind === 'store' ? (
                  <StorePanel entry={card.entry} />
                ) : (
                  <SlidePanel slide={card.slide} />
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {cards.length > 1 && (
        <footer className="mt-4 flex items-center justify-center gap-2">
          {cards.map((card, cardIndex) => (
            <span
              key={card.key}
              className={
                cardIndex === safeIndex
                  ? 'h-2.5 w-8 rounded-full bg-[#2bc79a]'
                  : 'h-2.5 w-2.5 rounded-full bg-[#243831]'
              }
              aria-current={cardIndex === safeIndex ? 'true' : undefined}
            />
          ))}
          <span className="ml-2 text-sm text-[#93a39b]">
            {safeIndex + 1} / {cards.length}
          </span>
        </footer>
      )}

    </div>
  );
}

function SlidePanel({ slide }: { slide: MonitorSlide }) {
  const test = slide.kind === 'test';

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-[#243831] bg-[#121d19] p-6"
      aria-label={test ? '案内スライド（テスト）' : '案内スライド'}
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-3xl font-bold">ご案内</h2>
        {test && <p className="text-sm text-[#93a39b]">テスト表示</p>}
      </header>
      <p className="sr-only">{slide.label}</p>
      <div className="mt-4 min-h-0 flex-1">
        {slide.kind === 'image' ? (
          <img
            src={slide.src}
            alt=""
            draggable={false}
            className="h-full w-full rounded-2xl object-contain"
          />
        ) : (
          <article
            className="flex h-full flex-col justify-between rounded-2xl px-6 py-5"
            style={{ backgroundColor: slide.background }}
          >
            <p className="text-sm font-bold tracking-wide" style={{ color: slide.accent }}>
              {slide.kicker}
            </p>
            <div>
              <p className="font-display text-4xl font-bold leading-tight text-white">{slide.title}</p>
              <div className="mt-3 space-y-1">
                {slide.lines.map((line) => (
                  <p key={line} className="text-2xl text-white/85">
                    {line}
                  </p>
                ))}
              </div>
            </div>
            <p className="text-sm text-white/55">テストデータ</p>
          </article>
        )}
      </div>
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
