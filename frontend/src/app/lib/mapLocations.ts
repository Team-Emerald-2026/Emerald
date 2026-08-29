export const mapLocations = [
  { key: '1f-northwest-room', name: '1F 北西教室', floor: 1, map_x: 46, map_y: 15 },
  { key: '1f-southwest-open', name: '1F 南西空間', floor: 1, map_x: 42, map_y: 61 },
  { key: '3f-301', name: '301', floor: 3, map_x: 23, map_y: 77 },
  { key: '3f-302', name: '302', floor: 3, map_x: 38, map_y: 77 },
  { key: '3f-303-1', name: '303-1', floor: 3, map_x: 52, map_y: 60 },
  { key: '3f-303-2', name: '303-2', floor: 3, map_x: 52, map_y: 73 },
  { key: '3f-303-3', name: '303-3', floor: 3, map_x: 52, map_y: 86 },
  { key: '3f-303-4', name: '303-4', floor: 3, map_x: 61, map_y: 86 },
  { key: '3f-304-6', name: '304-6', floor: 3, map_x: 70, map_y: 60 },
  { key: '3f-304-7', name: '304-7', floor: 3, map_x: 70, map_y: 73 },
  { key: '3f-304-5', name: '304-5', floor: 3, map_x: 70, map_y: 86 },
  { key: '4f-401', name: '401', floor: 4, map_x: 23, map_y: 77 },
  { key: '4f-402', name: '402', floor: 4, map_x: 38, map_y: 77 },
  { key: '4f-403', name: '403', floor: 4, map_x: 54, map_y: 77 },
  { key: '4f-404', name: '404', floor: 4, map_x: 69, map_y: 77 },
  { key: '5f-501', name: '501', floor: 5, map_x: 23, map_y: 77 },
  { key: '5f-502', name: '502', floor: 5, map_x: 38, map_y: 77 },
  { key: '5f-503', name: '503', floor: 5, map_x: 54, map_y: 77 },
  { key: '5f-504', name: '504', floor: 5, map_x: 69, map_y: 77 },
  { key: '6f-601', name: '601', floor: 6, map_x: 23, map_y: 77 },
  { key: '6f-602', name: '602', floor: 6, map_x: 38, map_y: 77 },
  { key: '6f-603', name: '603', floor: 6, map_x: 54, map_y: 77 },
  { key: '6f-604', name: '604', floor: 6, map_x: 69, map_y: 77 },
  { key: '7f-701', name: '701', floor: 7, map_x: 23, map_y: 77 },
  { key: '7f-702', name: '702', floor: 7, map_x: 38, map_y: 77 },
  { key: '7f-703', name: '703', floor: 7, map_x: 54, map_y: 77 },
  { key: '7f-704', name: '704', floor: 7, map_x: 69, map_y: 77 },
  { key: '8f-801', name: '801', floor: 8, map_x: 34, map_y: 77 },
  { key: '8f-802', name: '802', floor: 8, map_x: 63, map_y: 77 },
] as const;

export function findMapLocation(floor: number, mapX: number, mapY: number) {
  return mapLocations.find(
    (location) =>
      location.floor === floor &&
      location.map_x === mapX &&
      location.map_y === mapY,
  );
}
