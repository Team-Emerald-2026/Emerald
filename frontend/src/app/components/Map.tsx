import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FlaskConical,
  UtensilsCrossed,
  Ticket,
  Info as InfoIcon,
  HeartPulse,
  Headset,
  Toilet,
  Palette,
  CupSoda,
  DoorOpen,
  type LucideIcon,
} from 'lucide-react';
import { fetchMapFacilities, type BackendMapFacility } from '../lib/api';
import { floors, mapImageByFloor, type MapFloor } from '../lib/campusMap';

// 管理画面で選べるのは 体験 / フード / 作品展示 / 案内 / 金券販売 / 運営サポート / 男子トイレ / 女子トイレ / 男女トイレ /
// 自販機 / 非常口 の11個。救護室は、以前に登録された場所を表示するためだけに残している。
type BoothType =
  | 'フード'
  | '体験'
  | '作品展示'
  | '案内'
  | '運営サポート'
  | '金券販売'
  | '男子トイレ'
  | '女子トイレ'
  | '男女トイレ'
  | '自販機'
  | '非常口'
  | '救護室';

/** 凡例・絞り込みの並び順 */
const typeOrder: BoothType[] = [
  'フード',
  '体験',
  '作品展示',
  '案内',
  '運営サポート',
  '金券販売',
  '男子トイレ',
  '女子トイレ',
  '男女トイレ',
  '自販機',
  '非常口',
  '救護室',
];
type Floor = `${number}F`;

interface Facility {
  id: string;
  storeId: string | null;
  name: string;
  /** 場所の名前（部屋番号など）。地図のピンにはこれを表示する。なければ name を使う */
  label: string | null;
  type: BoothType;
  floor: Floor;
  x: number; // マップ上の相対座標（%）
  y: number;
}

/** 地図のピンに表示する文字（部屋番号などの場所の名前。なければ名前） */
const pinText = (f: Facility) => f.label ?? f.name;

/** 一覧やカードで、名前に添える部屋番号（名前と同じなら不要） */
const roomNote = (f: Facility) => (f.label && f.label !== f.name ? f.label : null);

const campusMap = {
  name: '京都TECH学園祭 校内マップ',
};

const typeIcon: Record<BoothType, LucideIcon> = {
  体験: FlaskConical,
  フード: UtensilsCrossed,
  金券販売: Ticket,
  男子トイレ: Toilet,
  女子トイレ: Toilet,
  男女トイレ: Toilet,
  作品展示: Palette,
  自販機: CupSoda,
  非常口: DoorOpen,
  案内: InfoIcon,
  救護室: HeartPulse,
  運営サポート: Headset,
};

const typeColor: Record<BoothType, string> = {
  体験: 'var(--primary)',
  フード: 'var(--accent)',
  金券販売: '#7c5cff',
  男子トイレ: '#2563eb',
  女子トイレ: '#db2777',
  男女トイレ: '#64748b',
  作品展示: '#9333ea',
  自販機: '#0891b2',
  非常口: '#237f52',
  案内: '#0ea5a3',
  救護室: '#e11d48',
  運営サポート: '#d97706',
};

/** 非常口は、アイコンの代わりに本物の非常口マーク（ISO 7010 E001、パブリックドメイン）を表示する */
const EXIT_SIGN_SRC = '/icons/emergency-exit.svg';

function ExitSign({ className }: { className: string }) {
  return <img src={EXIT_SIGN_SRC} alt="" aria-hidden="true" className={`${className} rounded-[3px] shadow-md`} />;
}

function toBoothType(type: string): BoothType {
  switch (type) {
    case 'food':
    case 'フード':
      return 'フード';
    case 'shop':
    case '金券販売':
    case '物販':
      return '金券販売';
    case 'toilet_men':
    case '男子トイレ':
      return '男子トイレ';
    case 'toilet_women':
    case '女子トイレ':
      return '女子トイレ';
    case 'toilet':
    case 'トイレ':
    case '男女トイレ':
      return '男女トイレ';
    case 'exhibit':
    case '作品展示':
      return '作品展示';
    case 'vending_machine':
    case '自販機':
      return '自販機';
    case 'emergency_exit':
    case '非常口':
      return '非常口';
    case 'information':
    case 'info':
    case '案内':
      return '案内';
    case 'first_aid':
    case '救護室':
      return '救護室';
    case 'support':
    case 'サポート':
    case '運営サポート':
      return '運営サポート';
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

  return {
    id: facility.id,
    storeId,
    name: facility.name,
    label: facility.label?.trim() || null,
    type: toBoothType(facility.type),
    floor: `${Number.isFinite(floorNum) ? floorNum : 1}F`,
    // 位置は管理画面の「マップ編集」で保存した値をそのまま使う
    x: toPercent(Number(facility.x), 240),
    y: toPercent(Number(facility.y), 180),
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
      const key = facility.storeId
        ? `store:${facility.storeId}`
        : `place:${facility.floor}:${facility.name}`;
      const current = unique[key];
      if (!current || (facility.storeId && !current.storeId)) {
        unique[key] = facility;
      }
    }

    // 場所の一覧は DB が元。固定リストで補わない（管理画面で消した場所が復活しないように）
    return Object.values(unique);
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
    () =>
      Array.from(new Set(displayFacilities.map((f) => f.type))).sort(
        (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b),
      ),
    [displayFacilities],
  );

  const match = (f: Facility) => f.floor === floor && (type === 'すべて' || f.type === type);
  // ピンは管理画面で登録した位置のまま表示する（自動で動かすと管理画面の見た目とずれるため）
  const filtered = displayFacilities.filter(match);
  const selectedFacility =
    displayFacilities.find(
      (f) =>
        (targetStoreId != null && f.storeId === targetStoreId) ||
        (targetFacilityId != null && f.id === targetFacilityId),
    ) ?? null;

  useEffect(() => {
    if (!selectedFacility) return;
    document
      .getElementById(`facility-${selectedFacility.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedFacility]);

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
      <li id={`facility-${f.id}`}>
        <button
          type="button"
          onClick={() => selectFacility(f)}
          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
            isSelected
              ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/10 ring-2 ring-[color:var(--primary)]'
              : 'border-border bg-card'
          }`}
        >
          {f.type === '非常口' ? (
            <ExitSign className="h-9 w-9 shrink-0" />
          ) : (
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
              style={{ backgroundColor: typeColor[f.type] }}
            >
              <Icon className="h-4 w-4 text-white" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{f.name}</p>
            <p className="text-xs text-muted-foreground">
              {f.floor}
              {roomNote(f) ? `・${roomNote(f)}` : ''}・{f.type}
            </p>
          </div>
          <span className="shrink-0 text-xs font-bold" style={{ color: 'var(--primary)' }}>
            {isSelected ? '選択中' : '地図で見る'}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-3 p-4">
      <h1 className="font-display text-2xl font-bold text-foreground">{campusMap.name}</h1>

      {error && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {error}
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-border bg-card p-2.5">
        <div>
          <p className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">フロア</p>
          <div className="flex gap-1 overflow-x-auto">
            {floors.map((item) => {
              const active = floor === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFloor(item)}
                  className="min-h-9 shrink-0 rounded-full px-3 text-xs font-bold"
                  style={{
                    backgroundColor: active ? 'var(--primary)' : 'var(--muted)',
                    color: active ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <span className="shrink-0 text-muted-foreground">種類</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="min-h-9 w-full rounded-lg border border-input bg-background px-2 text-foreground"
          >
            {(['すべて', ...boothTypes] as const).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="px-1 text-lg font-bold text-foreground">{floor} の地図</p>
      {/* 比率は画像と同じまま左右の余白だけ広げて、階を切り替えてもピンの位置がずれないようにする */}
      <div className="-mx-4">
        <div
          className={`relative isolate aspect-[1324/745] w-full overflow-hidden border-y border-border bg-muted sm:rounded-2xl sm:border ${
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
          {/* 右上の建物のない余白に現在のフロア名を重ねて表示する */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none font-display text-2xl font-bold text-black"
            style={{ left: '88%', top: '12%' }}
          >
            {floor}
          </span>
          {filtered.map((f) => {
            const isSelected = selectedFacility?.id === f.id;
            const hasSelection = selectedFacility != null;
            const PinIcon = typeIcon[f.type];
            return (
              // 外側のボタンの余白で、指で押せる範囲を確保する（見た目のピンは小さめ）
              <button
                key={f.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  selectFacility(f);
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 p-1 transition ${
                  isSelected ? 'z-20' : hasSelection ? 'z-0 opacity-55' : 'z-0'
                }`}
                style={{ left: `${f.x}%`, top: `${f.y}%` }}
                title={pinText(f)}
                aria-label={roomNote(f) ? `${f.name}（${roomNote(f)}）` : f.name}
                aria-pressed={isSelected}
              >
                {f.type === '非常口' ? (
                  <ExitSign
                    className={`block h-5 w-5 transition-transform ${isSelected ? 'scale-125 ring-2 ring-white' : ''}`}
                  />
                ) : (
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full border-2 border-white shadow-md transition-transform ${
                      isSelected ? 'scale-125 ring-2 ring-white' : ''
                    }`}
                    style={{ backgroundColor: typeColor[f.type] }}
                  >
                    <PinIcon className="h-2.5 w-2.5 text-white" aria-hidden="true" />
                  </span>
                )}
                {isSelected && (
                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 max-w-40 -translate-x-1/2 truncate whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[11px] font-bold leading-none text-white shadow-md">
                    {f.name}
                    {roomNote(f) ? `（${roomNote(f)}）` : ''}
                  </span>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs text-muted-foreground">
              この階に表示できるブースはありません
            </p>
          )}
        </div>
      </div>

      {boothTypes.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1.5 px-1" aria-label="アイコンの意味">
          {boothTypes.map((t) => {
            const LegendIcon = typeIcon[t];
            return (
              <li key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {t === '非常口' ? (
                  <ExitSign className="h-5 w-5" />
                ) : (
                  <span
                    className="grid h-5 w-5 place-items-center rounded-full"
                    style={{ backgroundColor: typeColor[t] }}
                  >
                    <LegendIcon className="h-3 w-3 text-white" aria-hidden="true" />
                  </span>
                )}
                {t}
              </li>
            );
          })}
        </ul>
      )}

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
                {selectedFacility.floor}
                {roomNote(selectedFacility) ? `・${roomNote(selectedFacility)}` : ''}・{selectedFacility.type}
              </p>
            </div>
            <button
              type="button"
              onClick={clearSelectedFacility}
              className="min-h-11 shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              閉じる
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            {selectedFacility.storeId ? (
              <Link
                to={`/attractions?detail=${encodeURIComponent(selectedFacility.storeId)}`}
                className="min-h-11 flex-1 rounded-xl px-3 py-2 text-center text-sm font-bold text-white"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                ブース詳細
              </Link>
            ) : (
              <span className="min-h-11 flex-1 rounded-xl bg-muted px-3 py-2 text-center text-sm font-bold leading-7 text-muted-foreground">
                詳細準備中
              </span>
            )}
            {selectedFacility.type === 'フード' && selectedFacility.storeId && (
              <Link
                to={`/restaurants?store=${encodeURIComponent(selectedFacility.storeId)}`}
                className="min-h-11 flex-1 rounded-xl border border-border px-3 py-2 text-center text-sm font-bold text-foreground"
              >
                呼び出しを見る
              </Link>
            )}
          </div>
        </section>
      )}

      {filtered.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">このフロアのブースはありません。</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((f) => (
            <FacilityRow key={f.id} f={f} />
          ))}
        </ul>
      )}

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
