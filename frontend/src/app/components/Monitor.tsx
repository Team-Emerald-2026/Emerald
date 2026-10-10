import { useEffect, useMemo, useState } from 'react';
import {
  fetchMapFacilities,
  fetchMonitorCallNumbers,
  type BackendMapFacility,
  type MonitorCallNumber,
} from '../lib/api';
/** 呼び出し番号の取得間隔（ミリ秒） */
const CALL_NUMBERS_INTERVAL_MS = 5000;
/** ブース枠と店舗の紐付け（マップ施設）の再取得間隔（ミリ秒） */
const FACILITIES_INTERVAL_MS = 60000;

/**
 * モニターに表示する対象ブース枠（303・304 の 8 枠）。
 * 店舗との紐付けは floor/x/y の一致で判定するため、
 * 管理画面のマップ編集でこれらのピンを動かした場合は、ここの座標も同じ値に直すこと。
 * （座標は MapFacilitiesSeeder と同じ。304-8 は仮の位置）
 */
const TARGET_BOOTHS = [
  { key: '303-1', name: '303-1', floor: 3, map_x: 50, map_y: 62 },
  { key: '303-2', name: '303-2', floor: 3, map_x: 66, map_y: 62 },
  { key: '303-3', name: '303-3', floor: 3, map_x: 50, map_y: 88 },
  { key: '303-4', name: '303-4', floor: 3, map_x: 66, map_y: 88 },
  { key: '304-5', name: '304-5', floor: 3, map_x: 80, map_y: 78 },
  { key: '304-6', name: '304-6', floor: 3, map_x: 50, map_y: 36 },
  { key: '304-7', name: '304-7', floor: 3, map_x: 68, map_y: 36 },
  { key: '304-8', name: '304-8', floor: 3, map_x: 82, map_y: 36 },
];

interface BoothSlot {
  key: string;
  label: string;
  storeId: string | null;
  monitor: MonitorCallNumber | null;
}

/**
 * ブース枠（座標）に割り当てられた店舗を探す。
 * 管理画面で店舗を作成すると、選んだブース枠と同じ floor/x/y の
 * map_facilities レコード（store_id 付き）が作られる仕組みを利用する。
 */
function findStoreIdForBooth(
  booth: (typeof TARGET_BOOTHS)[number],
  facilities: BackendMapFacility[],
): string | null {
  const facility = facilities.find(
    (f) =>
      f.store_id !== null &&
      f.floor === booth.floor &&
      f.x === booth.map_x &&
      f.y === booth.map_y,
  );
  return facility?.store_id ?? null;
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
 * 校内モニター（プロジェクター）向け呼び出し番号一覧。
 * 認証不要の公開ページ。303・304 教室の 8 ブースのみを表示する。
 */
export default function Monitor() {
  const [facilities, setFacilities] = useState<BackendMapFacility[]>([]);
  const [monitorData, setMonitorData] = useState<MonitorCallNumber[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasError, setHasError] = useState(false);
  const now = useClock();

  // ブース枠と店舗の紐付けを取得（低頻度で更新）
  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      fetchMapFacilities(controller.signal)
        .then(setFacilities)
        .catch(() => {
          /* 紐付けは前回取得分を維持 */
        });
    };
    load();
    const timer = setInterval(load, FACILITIES_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  // 呼び出し番号をポーリング
  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      fetchMonitorCallNumbers(controller.signal)
        .then((data) => {
          setMonitorData(data);
          setLastUpdated(new Date());
          setHasError(false);
        })
        .catch(() => setHasError(true));
    };
    load();
    const timer = setInterval(load, CALL_NUMBERS_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  const slots: BoothSlot[] = useMemo(() => {
    const monitorByStoreId = new Map(monitorData.map((entry) => [entry.store_id, entry]));
    return TARGET_BOOTHS.map((booth) => {
      const storeId = findStoreIdForBooth(booth, facilities);
      return {
        key: booth.key,
        label: booth.name,
        storeId,
        monitor: storeId ? (monitorByStoreId.get(storeId) ?? null) : null,
      };
    });
  }, [facilities, monitorData]);

  return (
    <div className="flex min-h-dvh flex-col bg-[#0b1310] px-6 py-5 text-[#e8efec]">
      {/* ヘッダー */}
      <header className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">
            呼び出し番号のご案内
            <span className="ml-4 text-2xl font-bold text-[#2bc79a]">303・304 教室</span>
          </h1>
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

      {/* ブース一覧（303-1〜4・304-5〜8 の 8 枠） */}
      <main className="grid flex-1 grid-cols-2 content-start gap-4 xl:grid-cols-4">
        {slots.map((slot) => (
          <BoothCard key={slot.key} slot={slot} />
        ))}
      </main>
    </div>
  );
}

function BoothCard({ slot }: { slot: BoothSlot }) {
  const { label, storeId, monitor } = slot;

  // ブース枠に店舗が割り当てられていない
  if (!storeId) {
    return (
      <section className="flex min-h-56 flex-col rounded-3xl border border-[#243831] bg-[#0f1a16] p-5 opacity-60">
        <BoothHeader label={label} storeName={null} />
        <p className="grid flex-1 place-items-center text-sm text-[#93a39b]">店舗未割当</p>
      </section>
    );
  }

  // 店舗はあるが営業中でない（モニター API は営業中店舗のみ返す）
  if (!monitor) {
    return (
      <section className="flex min-h-56 flex-col rounded-3xl border border-[#243831] bg-[#0f1a16] p-5 opacity-60">
        <BoothHeader label={label} storeName={null} />
        <p className="grid flex-1 place-items-center text-sm text-[#93a39b]">準備中</p>
      </section>
    );
  }

  const calledNumbers = monitor.called_numbers;
  const latest = monitor.current_call_number;

  return (
    <section className="flex min-h-56 flex-col rounded-3xl border border-[#243831] bg-[#121d19] p-5">
      <BoothHeader label={label} storeName={monitor.store_name} />

      {calledNumbers.length === 0 ? (
        <p className="grid flex-1 place-items-center text-base text-[#93a39b]">
          ただいまお呼び出し中の番号はありません
        </p>
      ) : (
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-center text-sm text-[#93a39b]">お呼び出し中</p>
          <ul className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {calledNumbers.map((number) => {
              const isLatest = number === latest;
              return (
                <li
                  key={number}
                  className={
                    isLatest
                      ? 'rounded-2xl bg-[#2bc79a] px-4 py-1.5 font-display text-5xl font-bold text-[#06241b]'
                      : 'rounded-2xl bg-[#18241f] px-3 py-1.5 font-display text-3xl font-bold text-[#e8efec]'
                  }
                >
                  {number}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-3 border-t border-[#243831] pt-2 text-right text-sm text-[#93a39b]">
        待ち <span className="font-display text-xl font-bold text-[#e8efec]">{monitor.waiting_count}</span> 組
      </p>
    </section>
  );
}

function BoothHeader({ label, storeName }: { label: string; storeName: string | null }) {
  return (
    <header className="flex items-baseline gap-3">
      <span className="rounded-lg bg-[#18241f] px-2.5 py-1 font-display text-lg font-bold text-[#2bc79a]">
        {label}
      </span>
      <h2 className="truncate font-display text-xl font-bold">{storeName ?? '—'}</h2>
    </header>
  );
}
