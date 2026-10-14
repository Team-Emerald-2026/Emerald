/** 校内マップの階・画像・場所の種類（来場者マップと管理画面で共通） */

export const floors = ['1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F'] as const;
export type MapFloor = (typeof floors)[number];

export const mapImageByFloor: Record<MapFloor, string> = {
  '1F': '/campus-map-1f.png',
  '2F': '/campus-map-2f.png',
  '3F': '/campus-map-3f.png',
  '4F': '/campus-map-4f.png',
  '5F': '/campus-map-5f.png',
  '6F': '/campus-map-6f.png',
  '7F': '/campus-map-7f.png',
  '8F': '/campus-map-8f.png',
};

/** 管理画面で選べる種類（value はバックエンドに保存される値） */
export const FACILITY_TYPES = [
  { value: 'booth', label: '体験', color: 'var(--primary)' },
  { value: 'food', label: 'フード', color: 'var(--accent)' },
  { value: 'information', label: '案内', color: '#0ea5a3' },
  { value: 'shop', label: '金券販売', color: '#7c5cff' },
  { value: 'support', label: '運営サポート', color: '#d97706' },
] as const;

/**
 * 以前は選べた種類。今は新しく選べないが、すでに登録済みの場所が持っていることがあるので、
 * 表示（ラベル・色）のためだけに残す。
 */
export const LEGACY_FACILITY_TYPES = [
  { value: 'stage', label: 'イベントもの', color: 'var(--primary)' },
  { value: 'toilet', label: 'トイレ', color: '#3b82f6' },
  { value: 'first_aid', label: '救護室', color: '#e11d48' },
] as const;

export function facilityTypeInfo(type: string) {
  return (
    FACILITY_TYPES.find((item) => item.value === type) ??
    LEGACY_FACILITY_TYPES.find((item) => item.value === type) ??
    FACILITY_TYPES[0]
  );
}

/**
 * 種類の選択肢。通常は FACILITY_TYPES だけ。
 * 登録済みの種類が旧種類のときは、画面で空欄にならないよう、その種類も（旧）として足す。
 */
export function facilityTypeOptions(currentType?: string | null) {
  const legacy = LEGACY_FACILITY_TYPES.find((item) => item.value === currentType);
  return legacy
    ? [...FACILITY_TYPES, { value: legacy.value, label: `${legacy.label}（旧）`, color: legacy.color }]
    : [...FACILITY_TYPES];
}
