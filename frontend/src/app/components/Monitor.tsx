import { useEffect, useMemo, useState } from 'react';
import { fetchMonitorCallNumbers, type MonitorCallNumber } from '../lib/api';

/** 呼び出し番号の取得間隔（ミリ秒） */
const CALL_NUMBERS_INTERVAL_MS = 5000;
/** 左右2店舗の切り替え間隔（ミリ秒） */
const ROTATE_INTERVAL_MS = 12000;

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
    </div>
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
  const latest = entry.current_call_number;

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
            {calledNumbers.map((number) => {
              const isLatest = number === latest;
              return (
                <li
                  key={number}
                  className={
                    isLatest
                      ? 'rounded-3xl bg-[#2bc79a] px-6 py-2 font-display text-7xl font-bold text-[#06241b]'
                      : 'rounded-2xl bg-[#18241f] px-4 py-2 font-display text-5xl font-bold text-[#e8efec]'
                  }
                >
                  {number}
                </li>
              );
            })}
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
