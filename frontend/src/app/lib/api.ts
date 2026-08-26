const DEFAULT_API_BASE = '/api';

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '');

export interface BoothLoginResponse {
  token: string;
  store_id: string | null;
  role?: 'store' | 'admin';
}

export interface BoothDashboard {
  id: string;
  name: string;
  description: string | null;
  is_open: boolean;
  current_wait_min: number;
  current_queue_count: number;
}

export interface BackendStore {
  id: string;
  name: string;
  description: string | null;
  is_open: boolean;
  is_visible?: boolean;
  current_wait_min: number;
  current_queue_count: number;
}

export interface AdminLoginResponse {
  token: string;
  role: 'admin';
  login_id: string;
}

export interface AdminStore {
  id: string;
  name: string;
  description: string | null;
  type: string;
  floor: number;
  map_x: number;
  map_y: number;
  ticket_prefix: string | null;
  is_open: boolean;
  is_visible: boolean;
  current_wait_min: number;
  current_queue_count: number;
  login_id: string | null;
  revenue: number;
  order_count: number;
}

export interface AdminAnalyticsStore {
  store_id: string;
  store_name: string;
  is_open: boolean;
  is_visible: boolean;
  revenue: number;
  order_count: number;
}

export interface AdminAnalytics {
  total_revenue: number;
  total_orders: number;
  settled_orders: number;
  stores: AdminAnalyticsStore[];
}

export interface AdminStoreInput {
  id?: string;
  name: string;
  description: string;
  type: string;
  floor: number;
  map_x: number;
  map_y: number;
  ticket_prefix?: string;
  login_id?: string;
  password?: string;
  is_open: boolean;
  is_visible: boolean;
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

type RequestMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: RequestMethod;
  signal?: AbortSignal;
  token?: string;
  body?: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

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

async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
  const { method = 'GET', signal, token, body } = options;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const hasBody = body !== undefined;
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;
    try {
      const errorBody = (await response.json()) as unknown;
      if (isRecord(errorBody)) {
        if (typeof errorBody.message === 'string' && errorBody.message.trim()) {
          message = errorBody.message;
        } else if (isRecord(errorBody.error) && typeof errorBody.error.message === 'string') {
          message = errorBody.error.message;
        }
      }
    } catch {
      // keep default message
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return null;
  return response.json() as Promise<unknown>;
}

export function fetchRestaurants(signal?: AbortSignal) {
  return request('/v1/restaurants', { signal }).then((payload) =>
    normalizeCollection<BackendStore>(payload),
  );
}

export function fetchRestaurant(id: string, signal?: AbortSignal) {
  return request(`/v1/restaurants/${encodeURIComponent(id)}`, { signal }).then((payload) =>
    normalizeItem<BackendStore>(payload),
  );
}

export function fetchMapFacilities(signal?: AbortSignal) {
  return request('/v1/map/facilities', { signal }).then((payload) =>
    normalizeCollection<BackendMapFacility>(payload),
  );
}


export function loginBooth(loginId: string, password: string, signal?: AbortSignal) {
  return request('/v1/booth/auth/login', {
    method: 'POST',
    signal,
    body: {
      login_id: loginId,
      password,
    },
  }) as Promise<BoothLoginResponse>;
}

export function loginAdmin(loginId: string, password: string, signal?: AbortSignal) {
  return request('/v1/admin/auth/login', {
    method: 'POST',
    signal,
    body: {
      login_id: loginId,
      password,
    },
  }) as Promise<AdminLoginResponse>;
}

export function logoutBooth(token: string, signal?: AbortSignal) {
  return request('/v1/booth/auth/logout', {
    method: 'POST',
    signal,
    token,
  });
}

export function logoutAdmin(token: string, signal?: AbortSignal) {
  return request('/v1/admin/auth/logout', {
    method: 'POST',
    signal,
    token,
  });
}

export function fetchBoothDashboard(token: string, signal?: AbortSignal) {
  return request('/v1/booth/dashboard', { signal, token }).then((payload) =>
    normalizeItem<BoothDashboard>(payload),
  );
}

export function fetchAdminStores(token: string, signal?: AbortSignal) {
  return request('/v1/admin/stores', { signal, token }).then((payload) => {
    if (isRecord(payload) && Array.isArray(payload.data)) return payload.data as AdminStore[];
    return [];
  });
}

export function createAdminStore(token: string, input: AdminStoreInput, signal?: AbortSignal) {
  return request('/v1/admin/stores', {
    method: 'POST',
    signal,
    token,
    body: input,
  }).then((payload) => (isRecord(payload) ? payload.data as AdminStore : null));
}

export function updateAdminStore(
  token: string,
  id: string,
  input: AdminStoreInput,
  signal?: AbortSignal,
) {
  return request(`/v1/admin/stores/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    signal,
    token,
    body: input,
  }).then((payload) => (isRecord(payload) ? payload.data as AdminStore : null));
}

export function hideAdminStore(token: string, id: string, signal?: AbortSignal) {
  return request(`/v1/admin/stores/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal,
    token,
  }).then((payload) => (isRecord(payload) ? payload.data as AdminStore : null));
}

export function fetchAdminAnalytics(token: string, signal?: AbortSignal) {
  return request('/v1/admin/analytics', { signal, token }).then((payload) =>
    isRecord(payload) ? payload.data as AdminAnalytics : null,
  );
}

export interface AuthResponse {
  token: string;
  store_id: string;
  store_name?: string;
  login_id?: string;
}

async function postJson(path: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `API request failed: ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export function registerStore(input: {
  store_name: string;
  description: string;
  login_id: string;
  password: string;
}) {
  return postJson('/v1/auth/register', input) as Promise<AuthResponse>;
}

export function loginStoreAccount(input: {
  login_id: string;
  password: string;
}) {
  return postJson('/v1/auth/login', input) as Promise<AuthResponse>;
}
export interface StoreProfile {
  id: string;
  name: string;
  description: string | null;
  is_open: boolean;
  current_wait_min: number;
  current_queue_count: number;
}

export async function fetchStoreProfile(token: string): Promise<StoreProfile> {
  const response = await fetch(`${apiBase}/v1/booth/dashboard`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const payload = await response.json();
  const item = payload?.data;
  const attributes = item?.attributes ?? {};

  return {
    id: String(attributes.id ?? item?.id ?? ''),
    name: String(attributes.name ?? ''),
    description: (attributes.description as string | null) ?? null,
    is_open: Boolean(attributes.is_open),
    current_wait_min: Number(attributes.current_wait_min ?? 0),
    current_queue_count: Number(attributes.current_queue_count ?? 0),
  };
}
export async function updateStoreProfile(
  token: string,
  storeId: string,
  input: {
    name: string;
    description: string;
    is_open: boolean;
  },
): Promise<StoreProfile> {
  const response = await fetch(
    `${apiBase}/v1/booth/dashboard/${encodeURIComponent(storeId)}`,
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const payload = await response.json();
  const item = payload?.data;
  const attributes = item?.attributes ?? {};

  return {
    id: String(attributes.id ?? item?.id ?? storeId),
    name: String(attributes.name ?? ''),
    description: (attributes.description as string | null) ?? null,
    is_open: Boolean(attributes.is_open),
    current_wait_min: Number(attributes.current_wait_min ?? 0),
    current_queue_count: Number(attributes.current_queue_count ?? 0),
  };
}
