import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FlaskConical,
  UtensilsCrossed,
  ShoppingBag,
  DoorClosed,
  Info as InfoIcon,
  HeartPulse,
  Headset,
  type LucideIcon,
} from 'lucide-react';
import { fetchMapFacilities, type BackendMapFacility } from '../lib/api';
import { mapLocations } from '../lib/mapLocations';

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
  const floorNum = Number(facility.floor);
  const storeId = facility.store_id ?? '';
  const placeholder = !storeId
    ? mapLocations.find(
        (location) => location.floor === floorNum && location.name === facility.name,
      )
    : undefined;

  return {
    id: facility.id,
    storeId,
    name: facility.name,
    type: toBoothType(facility.type),
    floor: `${Number.isFinite(floorNum) ? floorNum : 1}F`,
    x: placeholder ? placeholder.map_x : toPercent(Number(facility.x), 240),
    y: placeholder ? placeholder.map_y : toPercent(Number(facility.y), 180),
  };
}

export default function CampusMap() {
  const [searchParams, setSearchParams] = useSearchParams();
  const targetStoreId = searchParams.get('store');
  const targetFacilityId = searchParams.get('facility');
  const floorParam = searchParams.get('floor');
  const initialFloor: MapFloor =
    floorParam && (floors as readonly string[]).includes(floorParam)
      ? (floorParam as MapFloor)
      : '1F';
  const [floor, setFloor] = useState<MapFloor>(initialFloor);
  const [type, setType] = useState<'すべて' | BoothType>('すべて');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchMapFacilities(controller.signal)
      .then((backendFacilities) => {
        setFacilities(backendFacilities.map(toFacility));
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('バックエンドから校内マップ情報を取得できませんでした。');
      });

    return () => controller.abort();
  }, []);

  const displayFacilities = useMemo(() => {
    const unique: Record<string, Facility> = Object.create(null);
    for (const facility of facilities) {
      const key = `${facility.floor}:${Math.round(facility.x)}:${Math.round(facility.y)}`;
      const current = unique[key];
      if (!current || (facility.storeId && !current.storeId)) {
        unique[key] = facility;
      }
    }

    const merged = Object.values(unique);
    const names = new Set(merged.map((facility) => `${facility.floor}:${facility.name}`));
    const coords = new Set(
      merged.map((facility) => `${facility.floor}:${Math.round(facility.x)}:${Math.round(facility.y)}`),
    );

    for (const location of mapLocations) {
      const floorLabel = `${location.floor}F`;
      const nameKey = `${floorLabel}:${location.name}`;
      const coordKey = `${floorLabel}:${location.map_x}:${location.map_y}`;
      if (names.has(nameKey) || coords.has(coordKey)) continue;
      merged.push({
        id: location.key,
        storeId: '',
        name: location.name,
        type: '体験',
        floor: floorLabel,
        x: location.map_x,
        y: location.map_y,
      });
    }

    return merged;
  }, [facilities]);

  useEffect(() => {
    const target = displayFacilities.find(
      (f) =>
        (targetStoreId != null && f.storeId === targetStoreId) ||
        (targetFacilityId != null && f.id === targetFacilityId),
    );
    if (target && floors.includes(target.floor as MapFloor)) {
      setFloor(target.floor as MapFloor);
    }
  }, [displayFacilities, targetStoreId, targetFacilityId]);

  const boothTypes = useMemo(
    () => Array.from(new Set(displayFacilities.map((f) => f.type))),
    [displayFacilities],
  );

  const match = (f: Facility) => f.floor === floor && (type === 'すべて' || f.type === type);
  const filtered = displayFacilities.filter(match);
  const selectedFacility =
    displayFacilities.find(
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

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">階層</span>
          <select
            value={floor}
            onChange={(e) => setFloor(e.target.value as typeof floor)}
            className="w-full rounded-lg border border-input bg-background px-2 py-2 text-foreground"
          >
            {floors.map((f) => (
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

      <div
        className={`relative aspect-[825/466] w-full overflow-hidden rounded-2xl border border-border bg-muted ${
          import.meta.env.DEV ? 'cursor-crosshair' : ''
        }`}
        onClick={(e) => {
          if (!import.meta.env.DEV) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
          const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
          setClickPos({ x, y });
        }}
      >
        <img
          src={mapImageByFloor[floor]}
          alt={`${floor} 校内マップ`}
          className="absolute inset-0 h-full w-full object-fill"
        />
        <span className="absolute left-3 top-3 z-10 rounded-full bg-black/70 px-2.5 py-1 text-xs font-bold text-white">
          {floor}
        </span>
        {filtered.map((f) => {
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
        {filtered.length === 0 && (
          <p className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs text-muted-foreground">
            この階に表示できるブースはありません
          </p>
        )}
      </div>

      {import.meta.env.DEV && clickPos && (
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

      {filtered.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">この階層のブースはありません。</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((f) => (
            <FacilityRow key={f.id} f={f} />
          ))}
        </ul>
      )}

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
