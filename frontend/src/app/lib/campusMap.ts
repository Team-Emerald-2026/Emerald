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
  { value: 'booth', label: '体験ブース', color: 'var(--primary)' },
  { value: 'food', label: '飲食ブース', color: 'var(--accent)' },
  { value: 'stage', label: 'イベントもの', color: 'var(--primary)' },
  { value: 'shop', label: '物販', color: '#7c5cff' },
  { value: 'information', label: '案内', color: '#0ea5a3' },
  { value: 'toilet', label: 'トイレ', color: '#3b82f6' },
  { value: 'first_aid', label: '救護室', color: '#e11d48' },
  { value: 'support', label: 'サポート', color: '#d97706' },
] as const;

export function facilityTypeInfo(type: string) {
  return FACILITY_TYPES.find((item) => item.value === type) ?? FACILITY_TYPES[0];
}
