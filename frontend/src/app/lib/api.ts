const DEFAULT_API_BASE = '/api';

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '');

export interface BackendStore {
  id: string;
  name: string;
  description: string | null;
  is_open: boolean;
  current_wait_min: number;
  current_queue_count: number;
}

export interface BackendMapFacility {
  id: string;
  store_id: string;
  name: string;
  type: string;
  floor: number;
  x: number;
  y: number;
}

type JsonApiItem = {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
};

type JsonApiCollection = {
  data?: JsonApiItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeCollection<T extends { id: string }>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  if (isRecord(payload) && Array.isArray((payload as JsonApiCollection).data)) {
    return (payload as JsonApiCollection).data!.map((item) => {
      const attributes = item.attributes ?? {};
      return {
        ...attributes,
        id: String(attributes.id ?? item.id ?? ''),
      } as T;
    });
  }

  return [];
}

function normalizeItem<T extends { id: string }>(payload: unknown): T | null {
  if (!isRecord(payload)) return null;

  const data = payload.data;
  if (isRecord(data)) {
    const item = data as JsonApiItem;
    const attributes = item.attributes ?? {};
    return {
      ...attributes,
      id: String(attributes.id ?? item.id ?? ''),
    } as T;
  }

  return payload as T;
}

async function request(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

export function fetchRestaurants(signal?: AbortSignal) {
  return request('/v1/restaurants', signal).then((payload) =>
    normalizeCollection<BackendStore>(payload),
  );
}

export function fetchRestaurant(id: string, signal?: AbortSignal) {
  return request(`/v1/restaurants/${encodeURIComponent(id)}`, signal).then((payload) =>
    normalizeItem<BackendStore>(payload),
  );
}

export function fetchMapFacilities(signal?: AbortSignal) {
  return request('/v1/map/facilities', signal).then((payload) =>
    normalizeCollection<BackendMapFacility>(payload),
  );
}
