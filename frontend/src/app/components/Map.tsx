import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  SlidersHorizontal,
  X,
  FlaskConical,
  UtensilsCrossed,
  ShoppingBag,
  DoorClosed,
  Info as InfoIcon,
  HeartPulse,
  Headset,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import { fetchMapFacilities, type BackendMapFacility } from '../lib/api';
import { Skeleton, SkeletonText } from './Skeleton';

type BoothType = '体験' | 'フード' | '物販' | 'トイレ' | '案内' | '救護室' | 'サポート';
type Floor = `${number}F`;

interface Facility {
  id: string;
  storeId: string | null;
  name: string;
  type: BoothType;
  floor: Floor;
  x: number; // マップ上の相対座標（%）
  y: number;
}

const campusMap = {
  name: '京都TECH学園祭 校内マップ',
};

const floors = ['1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F'] as const;
type MapFloor = (typeof floors)[number];

const mapImageByFloor: Record<MapFloor, string> = {
  '1F': '/campus-map-1f.png',
  '2F': '/campus-map-2f.png',
  '3F': '/campus-map-3f.png',
  '4F': '/campus-map-4f.png',
  '5F': '/campus-map-5f.png',
  '6F': '/campus-map-6f.png',
  '7F': '/campus-map-7f.png',
  '8F': '/campus-map-8f.png',
};

const typeIcon: Record<BoothType, LucideIcon> = {
  体験: FlaskConical,
  フード: UtensilsCrossed,
  物販: ShoppingBag,
  トイレ: DoorClosed,
  案内: InfoIcon,
  救護室: HeartPulse,
  サポート: Headset,
};

const typeColor: Record<BoothType, string> = {
  体験: 'var(--primary)',
  フード: 'var(--accent)',
  物販: '#7c5cff',
  トイレ: '#3b82f6',
  案内: '#0ea5a3',
  救護室: '#e11d48',
  サポート: '#d97706',
};

function toBoothType(type: string): BoothType {
  switch (type) {
    case 'food':
    case 'フード':
      return 'フード';
    case 'shop':
    case '物販':
      return '物販';
    case 'toilet':
    case 'トイレ':
      return 'トイレ';
    case 'information':
    case 'info':
    case '案内':
      return '案内';
    case 'first_aid':
    case '救護室':
      return '救護室';
    case 'support':
    case 'サポート':
      return 'サポート';
    default:
      return '体験';
  }
}

function toPercent(value: number, max: number): number {
  if (!Number.isFinite(value)) return 50;
  if (value >= 0 && value <= 100) return value;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function toFacility(facility: BackendMapFacility): Facility {
  const floor = Number(facility.floor);

  return {
    id: facility.id,
    storeId: facility.store_id,
    name: facility.name,
    type: toBoothType(facility.type),
    floor: `${Number.isFinite(floor) ? floor : 1}F`,
    x: toPercent(Number(facility.x), 240),
    y: toPercent(Number(facility.y), 180),
  };
}

function FacilityRowSkeleton() {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonText className="w-3/5" />
        <SkeletonText className="w-1/3" />
      </div>
      <Skeleton className="h-8 w-14 shrink-0 rounded-lg" />
    </li>
  );
}

export default function Map() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilter, setShowFilter] = useState(false);
  const [floor, setFloor] = useState<'すべて' | MapFloor>('1F');
  const [type, setType] = useState<'すべて' | BoothType>('すべて');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null);
  const targetStoreId = searchParams.get('store');
  const targetFacilityId = searchParams.get('facility');

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetchMapFacilities(controller.signal)
      .then((backendFacilities) => {
        setFacilities(backendFacilities.map(toFacility));
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('バックエンドから校内マップ情報を取得できませんでした。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const target = facilities.find(
      (f) =>
        (targetStoreId != null && f.storeId === targetStoreId) ||
        (targetFacilityId != null && f.id === targetFacilityId),
    );
    if (target && floors.includes(target.floor as MapFloor)) {
      setFloor(target.floor as MapFloor);
    }
  }, [facilities, targetStoreId, targetFacilityId]);

  const boothTypes = useMemo(
    () => Array.from(new Set(facilities.map((f) => f.type))),
    [facilities],
  );

  const match = (f: Facility) =>
    (floor === 'すべて' || f.floor === floor) && (type === 'すべて' || f.type === type);
  const filtered = facilities.filter(match);
  const selectedFacility =
    facilities.find(
      (f) =>
        (targetStoreId != null && f.storeId === targetStoreId) ||
        (targetFacilityId != null && f.id === targetFacilityId),
    ) ?? null;

  const selectFacility = (f: Facility) => {
    const next = new URLSearchParams(searchParams);
    next.set(f.storeId ? 'store' : 'facility', f.storeId || f.id);
    if (f.storeId) next.delete('facility');
    else next.delete('store');
    setSearchParams(next);
    if (floors.includes(f.floor as MapFloor)) setFloor(f.floor as MapFloor);
  };

  const clearSelectedFacility = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('store');
    next.delete('facility');
    setSearchParams(next);
  };

  const FacilityRow = ({ f }: { f: Facility }) => {
    const Icon = typeIcon[f.type];
    const isSelected = selectedFacility?.id === f.id;
    return (
      <li
        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
          isSelected
            ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/10'
            : 'border-border bg-card'
        }`}
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: typeColor[f.type] }}
        >
          <Icon className="h-4 w-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{f.name}</p>
          <p className="text-xs text-muted-foreground">
            {f.floor}・{f.type}
          </p>
        </div>
        <button
          type="button"
          onClick={() => selectFacility(f)}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          詳細
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="font-display text-2xl font-bold text-foreground">{campusMap.name}</h1>

      {error && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {error}
        </div>
      )}

      {/* フィルタトグル */}
      <button
        type="button"
        onClick={() => setShowFilter((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-foreground hover:bg-muted"
      >
        {showFilter ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
        {showFilter ? 'フィルタを閉じる' : '階層・ブースタイプを表示'}
      </button>

      {showFilter && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">階層</span>
            <select
              value={floor}
              onChange={(e) => setFloor(e.target.value as typeof floor)}
              className="w-full rounded-lg border border-input bg-background px-2 py-2 text-foreground"
            >
              {(['すべて', ...floors] as const).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">ブースタイプ</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="w-full rounded-lg border border-input bg-background px-2 py-2 text-foreground"
            >
              {(['すべて', ...boothTypes] as const).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* 校内マップ（クリックで座標を計測・開発用） */}
      <div
        className="relative aspect-[4/3] w-full cursor-crosshair overflow-hidden rounded-2xl border border-border bg-muted"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
          const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
          setClickPos({ x, y });
        }}
      >
        <img
          src={floor === 'すべて' ? mapImageByFloor['1F'] : mapImageByFloor[floor]}
          alt={`${floor === 'すべて' ? '1F' : floor} 校内マップ`}
          className="absolute inset-0 h-full w-full object-contain"
        />
        {loading && !error && (
          <div className="absolute inset-0 bg-muted p-4" aria-label="校内マップ情報を読み込み中">
            <Skeleton className="h-full w-full rounded-xl" />
          </div>
        )}
        {!loading && !error && filtered.map((f) => {
          const Icon = typeIcon[f.type];
          const isSelected = selectedFacility?.id === f.id;
          const hasSelection = selectedFacility != null;
          return (
            <div
              key={f.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 ${isSelected ? 'z-10' : 'z-0'}`}
              style={{ left: `${f.x}%`, top: `${f.y}%` }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  selectFacility(f);
                }}
                className={`grid place-items-center rounded-full shadow-md transition ${
                  isSelected
                    ? 'h-10 w-10 scale-110 ring-4 ring-white'
                    : hasSelection
                      ? 'h-8 w-8 ring-2 ring-white/70 opacity-45'
                      : 'h-8 w-8 ring-2 ring-white/70'
                }`}
                style={{ backgroundColor: typeColor[f.type] }}
                title={f.name}
                aria-pressed={isSelected}
              >
                <Icon className={`${isSelected ? 'h-5 w-5' : 'h-4 w-4'} text-white`} />
              </button>
            </div>
          );
        })}
        {!loading && !error && filtered.length === 0 && (
          <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            該当するブースがありません
          </p>
        )}
      </div>

      {clickPos && (
        <p className="text-sm text-muted-foreground">
          クリック位置: x={clickPos.x}, y={clickPos.y}
          （この数字を seeder にコピー）
        </p>
      )}

      {selectedFacility && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-muted-foreground">選択中のブース</p>
              <h2 className="mt-1 truncate font-display text-lg font-bold text-foreground">
                {selectedFacility.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedFacility.floor}・{selectedFacility.type}
              </p>
            </div>
            <button
              type="button"
              onClick={clearSelectedFacility}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              閉じる
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {selectedFacility.storeId ? (
              <Link
                to={`/attractions?detail=${encodeURIComponent(selectedFacility.storeId)}`}
                className="rounded-xl border border-border px-3 py-2 text-center text-sm font-bold text-foreground hover:bg-muted"
              >
                ブース詳細
              </Link>
            ) : (
              <span className="rounded-xl bg-muted px-3 py-2 text-center text-sm font-bold text-muted-foreground">
                詳細準備中
              </span>
            )}
            {selectedFacility.type === 'フード' && selectedFacility.storeId ? (
              <Link
                to={`/restaurants?store=${encodeURIComponent(selectedFacility.storeId)}`}
                className="rounded-xl px-3 py-2 text-center text-sm font-bold text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                呼び出しを見る
              </Link>
            ) : (
              <span className="rounded-xl bg-muted px-3 py-2 text-center text-sm font-bold text-muted-foreground">
                対象外
              </span>
            )}
          </div>
        </section>
      )}

      {/* 一覧 */}
      {loading && !error && (
        <ul className="space-y-2" aria-label="施設一覧を読み込み中">
          {Array.from({ length: 5 }).map((_, index) => (
            <FacilityRowSkeleton key={index} />
          ))}
        </ul>
      )}

      {!loading && !error && (floor === 'すべて' ? (
        <div className="space-y-4">
          {floors.map((fl) => {
            const rows = filtered.filter((f) => f.floor === fl);
            if (rows.length === 0) return null;
            return (
              <section key={fl}>
                <h2 className="mb-2 flex items-center gap-2 px-1 font-display text-base font-bold text-foreground">
                  <MapPin className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                  {fl}
                </h2>
                <ul className="space-y-2">
                  {rows.map((f) => (
                    <FacilityRow key={f.id} f={f} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((f) => (
            <FacilityRow key={f.id} f={f} />
          ))}
        </ul>
      ))}

      {/* 案内ボックス */}
      <div
        className="flex gap-2 rounded-xl p-3 text-sm"
        style={{ backgroundColor: 'var(--info-soft)', color: 'var(--info)' }}
      >
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <p>困ったときは1Fの総合案内、または2Fの運営サポート本部へお越しください。</p>
      </div>
    </div>
  );
}
