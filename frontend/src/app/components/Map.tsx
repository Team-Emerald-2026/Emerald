import { useEffect, useMemo, useState } from 'react';
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

type BoothType = '体験' | 'フード' | '物販' | 'トイレ' | '案内' | '救護室' | 'サポート';
type Floor = `${number}F`;

interface Facility {
  id: string;
  name: string;
  type: BoothType;
  floor: Floor;
  x: number; // マップ上の相対座標（%）
  y: number;
}

const campusMap = {
  name: '京都TECH学園祭 校内マップ',
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
    name: facility.name,
    type: toBoothType(facility.type),
    floor: `${Number.isFinite(floor) ? floor : 1}F`,
    x: toPercent(Number(facility.x), 240),
    y: toPercent(Number(facility.y), 180),
  };
}

export default function Map() {
  const [showFilter, setShowFilter] = useState(false);
  const [floor, setFloor] = useState<'すべて' | Floor>('すべて');
  const [type, setType] = useState<'すべて' | BoothType>('すべて');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const floors = useMemo(
    () => Array.from(new Set(facilities.map((f) => f.floor))).sort((a, b) => Number(a.slice(0, -1)) - Number(b.slice(0, -1))),
    [facilities],
  );
  const boothTypes = useMemo(
    () => Array.from(new Set(facilities.map((f) => f.type))),
    [facilities],
  );

  const match = (f: Facility) =>
    (floor === 'すべて' || f.floor === floor) && (type === 'すべて' || f.type === type);
  const filtered = facilities.filter(match);

  const FacilityRow = ({ f }: { f: Facility }) => {
    const Icon = typeIcon[f.type];
    return (
      <li className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
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

      {loading && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          校内マップ情報を読み込み中です。
        </div>
      )}

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

      {/* 簡易マップ */}
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border"
        style={{ background: 'linear-gradient(135deg,#0f7b5f22,#7c5cff22)' }}
      >
        {!loading && !error && filtered.map((f) => {
          const Icon = typeIcon[f.type];
          return (
            <div
              key={f.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${f.x}%`, top: `${f.y}%` }}
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-full shadow-md ring-2 ring-white/70"
                style={{ backgroundColor: typeColor[f.type] }}
                title={f.name}
              >
                <Icon className="h-4 w-4 text-white" />
              </span>
            </div>
          );
        })}
        {!loading && !error && filtered.length === 0 && (
          <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            該当するブースがありません
          </p>
        )}
      </div>

      {/* 一覧 */}
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
