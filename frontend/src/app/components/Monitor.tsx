import { useEffect, useMemo, useState } from 'react';
import { fetchMonitorCallNumbers, type MonitorCallNumber } from '../lib/api';

/** 呼び出し番号の取得間隔（ミリ秒） */
const CALL_NUMBERS_INTERVAL_MS = 5000;
/** 左右2店舗の切り替え間隔（ミリ秒） */
const ROTATE_INTERVAL_MS = 12000;

/**
 * 校内モニター下部に流す案内スライド。
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

function pairStores(
  stores: MonitorCallNumber[],
): Array<[MonitorCallNumber | null, MonitorCallNumber | null]> {
  const pairs: Array<[MonitorCallNumber | null, MonitorCallNumber | null]> = [];
  for (let i = 0; i < stores.length; i += 2) {
    pairs.push([stores[i] ?? null, stores[i + 1] ?? null]);
  }
  return pairs;
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
 * 管理画面で「校内モニターに表示」にした店舗を、2店舗ずつ左右に出して切り替える。
 */
export default function Monitor() {
  const [monitorData, setMonitorData] = useState<MonitorCallNumber[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasError, setHasError] = useState(false);
  const [pairIndex, setPairIndex] = useState(0);
  const now = useClock();

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

  const pairs = useMemo(() => pairStores(monitorData), [monitorData]);
  const pairCount = pairs.length;

  useEffect(() => {
    if (pairCount <= 1) return;
    const timer = setInterval(() => {
      setPairIndex((current) => (current + 1) % pairCount);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pairCount]);

  const safeIndex = pairCount === 0 ? 0 : pairIndex % pairCount;
  const [left, right] = pairs[safeIndex] ?? [null, null];

  const imageSlides = useMemo(() => monitorImageSlides(), []);
  const slides = imageSlides.length > 0 ? imageSlides : TEST_SLIDES;

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

      <main className="grid flex-1 grid-cols-2 content-stretch gap-5">
        {pairCount === 0 ? (
          <p className="col-span-2 grid place-items-center text-xl text-[#93a39b]">
            ただいま表示する店舗はありません
          </p>
        ) : (
          <>
            <StorePanel entry={left} />
            <StorePanel entry={right} />
          </>
        )}
      </main>

      {pairCount > 1 && (
        <footer className="mt-4 flex items-center justify-center gap-2">
          {pairs.map((_, index) => (
            <span
              key={index}
              className={
                index === safeIndex
                  ? 'h-2.5 w-8 rounded-full bg-[#2bc79a]'
                  : 'h-2.5 w-2.5 rounded-full bg-[#243831]'
              }
              aria-current={index === safeIndex ? 'true' : undefined}
            />
          ))}
          <span className="ml-2 text-sm text-[#93a39b]">
            {safeIndex + 1} / {pairCount}
          </span>
        </footer>
      )}

      <SlideReel slides={slides} test={imageSlides.length === 0} />
    </div>
  );
}

function SlideReel({ slides, test }: { slides: MonitorSlide[]; test: boolean }) {
  if (slides.length === 0) return null;

  const duration = Math.max(36, slides.length * 8);

  return (
    <section
      className="mt-4 shrink-0 overflow-hidden rounded-3xl border border-[#243831] bg-[#0f1a16]"
      aria-label={test ? '案内スライド（テスト）' : '案内スライド'}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-3 text-sm text-[#93a39b]">
        <p>ご案内</p>
        {test && <p>テスト表示</p>}
      </div>
      <p className="sr-only">{slides.map((slide) => slide.label).join('、')}</p>
      <div className="overflow-hidden px-4 py-3">
        <div
          className="monitor-slide-track flex w-max"
          style={{ ['--monitor-slide-duration' as string]: `${duration}s` }}
        >
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex gap-4 pr-4" aria-hidden="true">
              {slides.map((slide, index) => (
                <li key={`${copy}-${slide.label}-${index}`} className="shrink-0">
                  <SlideCard slide={slide} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

function SlideCard({ slide }: { slide: MonitorSlide }) {
  const frame = 'aspect-video h-[clamp(168px,30vh,340px)] w-auto max-w-none shrink-0 rounded-2xl';

  if (slide.kind === 'image') {
    return <img src={slide.src} alt="" draggable={false} className={`${frame} border border-[#243831] object-cover`} />;
  }

  return (
    <article className={`${frame} flex flex-col justify-between px-6 py-4`} style={{ backgroundColor: slide.background }}>
      <p className="text-sm font-bold tracking-wide" style={{ color: slide.accent }}>
        {slide.kicker}
      </p>
      <div className="min-w-0">
        <h3 className="truncate font-display text-3xl font-bold text-white">{slide.title}</h3>
        <div className="mt-2 space-y-1">
          {slide.lines.map((line) => (
            <p key={line} className="truncate text-lg text-white/85">
              {line}
            </p>
          ))}
        </div>
      </div>
      <p className="text-sm text-white/55">テストデータ</p>
    </article>
  );
}

function StorePanel({ entry }: { entry: MonitorCallNumber | null }) {
  if (!entry) {
    return (
      <section className="flex min-h-0 flex-col rounded-3xl border border-[#243831] bg-[#0f1a16] p-6 opacity-50">
        <p className="grid flex-1 place-items-center text-lg text-[#93a39b]">—</p>
      </section>
    );
  }

  if (entry.is_open === false) {
    return (
      <section className="flex min-h-0 flex-col rounded-3xl border border-[#243831] bg-[#0f1a16] p-6 opacity-70">
        <StoreHeader entry={entry} />
        <p className="grid flex-1 place-items-center text-2xl text-[#93a39b]">準備中</p>
      </section>
    );
  }

  const calledNumbers = Array.isArray(entry.called_numbers) ? entry.called_numbers : [];

  return (
    <section className="flex min-h-0 flex-col rounded-3xl border border-[#243831] bg-[#121d19] p-6">
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
