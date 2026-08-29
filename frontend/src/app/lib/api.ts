const DEFAULT_API_BASE = '/api';

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '');

export interface BoothLoginResponse {
  token: string;
  store_id: string | null;
  role?: 'store' | 'admin';
}

export type BoothKind = 'booth' | 'food' | 'stage';

export interface BoothDashboard {
  id: string;
  name: string;
  description: string | null;
  is_open: boolean;
  current_wait_min: number;
  current_queue_count: number;
  wait_display_mode?: 'minutes' | 'text';
  wait_display_text?: string | null;
  revenue?: number;
  type?: string;
}

export interface BackendStore {
  id: string;
  name: string;
  description: string | null;
  is_open: boolean;
  is_visible?: boolean;
  type?: string;
  current_wait_min: number;
  current_queue_count: number;
  wait_time?: number;
  wait_display_mode?: 'minutes' | 'text';
  wait_display_text?: string | null;
  map_facility_id?: string | null;
  menu_items?: BackendMenuItem[];
  ticket_numbers?: string[];
}

export interface BackendMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
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
  store_id: string | null;
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

function flattenResource<T extends { id: string }>(item: Record<string, unknown>): T {
  const attributes = isRecord(item.attributes) ? item.attributes : item;
  return {
    ...attributes,
    id: String(attributes.id ?? item.id ?? ''),
  } as T;
}

function normalizeCollection<T extends { id: string }>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  if (isRecord(payload) && Array.isArray((payload as JsonApiCollection).data)) {
    return (payload as JsonApiCollection).data!.flatMap((item) =>
      isRecord(item) ? [flattenResource<T>(item)] : [],
    );
  }

  return [];
}

function normalizeItem<T extends { id: string }>(payload: unknown): T | null {
  if (!isRecord(payload)) return null;

  const data = payload.data;
  if (isRecord(data)) {
    return flattenResource<T>(data);
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

export function fetchBoothMenuItems(token: string, signal?: AbortSignal) {
  return request('/v1/booth/accounting/menu-items', { signal, token }).then((payload) =>
    normalizeCollection<BackendMenuItem>(payload),
  );
}

export function createBoothMenuItem(
  token: string,
  input: { name: string; price: number },
  signal?: AbortSignal,
) {
  return request('/v1/booth/accounting/menu-items', {
    method: 'POST',
    token,
    body: input,
    signal,
  }).then((payload) => {
    const created = normalizeItem<BackendMenuItem>(payload);
    if (!created) {
      throw new Error('商品を追加できませんでした。');
    }
    return created;
  });
}

export function updateBoothMenuItem(
  token: string,
  id: string,
  input: { name: string; price: number },
  signal?: AbortSignal,
) {
  return request(`/v1/booth/accounting/menu-items/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    token,
    body: input,
    signal,
  }).then((payload) => {
    const updated = normalizeItem<BackendMenuItem>(payload);
    if (!updated) {
      throw new Error('商品を更新できませんでした。');
    }
    return updated;
  });
}

export function deleteBoothMenuItem(token: string, id: string, signal?: AbortSignal) {
  return request(`/v1/booth/accounting/menu-items/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    token,
    signal,
  });
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

export function fetchAdminStore(token: string, id: string, signal?: AbortSignal) {
  return request(`/v1/admin/stores/${encodeURIComponent(id)}`, { signal, token }).then((payload) =>
    isRecord(payload) ? (payload.data as AdminStore) : null,
  );
}

export function fetchAdminRevenue(token: string, signal?: AbortSignal) {
  return request('/v1/admin/revenue', { signal, token }).then((payload) =>
    isRecord(payload) ? (payload.data as AdminRevenue) : null,
  );
}

export interface AdminRevenueStore {
  store_id: string;
  store_name: string;
  order_revenue: number;
  sales_entry_revenue: number;
  revenue: number;
}

export interface AdminRevenue {
  total_revenue: number;
  order_revenue: number;
  sales_entry_revenue: number;
  stores: AdminRevenueStore[];
}

export interface EventNotice {
  id: string;
  title: string;
  body: string;
  type: 'event' | 'notice';
  starts_at: string | null;
  ends_at: string | null;
  is_published?: boolean;
}

export interface EventNoticeInput {
  title: string;
  body: string;
  type: 'event' | 'notice';
  starts_at?: string | null;
  ends_at?: string | null;
  is_published?: boolean;
}

export function fetchEvents(signal?: AbortSignal) {
  return request('/v1/events', { signal }).then((payload) =>
    normalizeCollection<EventNotice>(payload),
  );
}

export function fetchEvent(id: string, signal?: AbortSignal) {
  return request(`/v1/events/${encodeURIComponent(id)}`, { signal }).then((payload) =>
    normalizeItem<EventNotice>(payload),
  );
}

export function fetchAdminEvents(token: string, signal?: AbortSignal) {
  return request('/v1/admin/events', { signal, token }).then((payload) =>
    normalizeCollection<EventNotice>(payload),
  );
}

export function createAdminEvent(token: string, input: EventNoticeInput, signal?: AbortSignal) {
  return request('/v1/admin/events', {
    method: 'POST',
    token,
    body: input,
    signal,
  }).then((payload) => normalizeItem<EventNotice>(payload));
}

export function updateAdminEvent(
  token: string,
  id: string,
  input: EventNoticeInput,
  signal?: AbortSignal,
) {
  return request(`/v1/admin/events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body: input,
    signal,
  }).then((payload) => normalizeItem<EventNotice>(payload));
}

export function deleteAdminEvent(token: string, id: string, signal?: AbortSignal) {
  return request(`/v1/admin/events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
    signal,
  });
}

export interface CallNumber {
  id: string;
  store_id: string;
  store_name: string | null;
  ticket_number: string;
  called_at: string | null;
}

export interface MonitorCallNumber {
  store_id: string;
  store_name: string;
  current_call_number: string | null;
  called_numbers: string[];
  waiting_numbers: string[];
  waiting_count: number;
}

export function fetchCallNumbers(storeId?: string, signal?: AbortSignal) {
  const query = storeId ? `?store_id=${encodeURIComponent(storeId)}` : '';
  return request(`/v1/call-numbers${query}`, { signal }).then((payload) => {
    if (isRecord(payload) && Array.isArray(payload.data)) return payload.data as CallNumber[];
    return [];
  });
}

export function fetchMonitorCallNumbers(signal?: AbortSignal) {
  return request('/v1/monitor/call-numbers', { signal }).then((payload) => {
    if (isRecord(payload) && Array.isArray(payload.data)) return payload.data as MonitorCallNumber[];
    return [];
  });
}

export interface SalesEntry {
  id: string;
  store_id: string;
  amount: number;
  memo: string | null;
  recorded_at: string | null;
}

export interface SalesEntryInput {
  amount: number;
  memo?: string;
  recorded_at?: string;
}

export function fetchBoothSales(token: string, signal?: AbortSignal) {
  return request('/v1/booth/sales', { signal, token }).then((payload) =>
    normalizeCollection<SalesEntry>(payload),
  );
}

export function createBoothSale(token: string, input: SalesEntryInput, signal?: AbortSignal) {
  return request('/v1/booth/sales', {
    method: 'POST',
    token,
    body: input,
    signal,
  }).then((payload) => normalizeItem<SalesEntry>(payload));
}

export function updateBoothSale(
  token: string,
  id: string,
  input: SalesEntryInput,
  signal?: AbortSignal,
) {
  return request(`/v1/booth/sales/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body: input,
    signal,
  }).then((payload) => normalizeItem<SalesEntry>(payload));
}

export function deleteBoothSale(token: string, id: string, signal?: AbortSignal) {
  return request(`/v1/booth/sales/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
    signal,
  });
}

export function updateWaitTime(
  token: string,
  storeId: string,
  input: {
    current_wait_min: number;
    current_queue_count: number;
    wait_display_mode?: 'minutes' | 'text';
    wait_display_text?: string | null;
  },
  signal?: AbortSignal,
) {
  return request(`/v1/store/${encodeURIComponent(storeId)}/wait-time`, {
    method: 'PATCH',
    token,
    body: input,
    signal,
  }) as Promise<{
    id: string;
    current_wait_min: number;
    current_queue_count: number;
    wait_display_mode: 'minutes' | 'text';
    wait_display_text: string | null;
    updated_at: string | null;
  }>;
}

export function callBoothOrder(token: string, orderId: number, signal?: AbortSignal) {
  return request(`/v1/booth/accounting/orders/${orderId}/call`, {
    method: 'PATCH',
    token,
    signal,
  });
}

export function serveBoothOrder(token: string, orderId: number, signal?: AbortSignal) {
  return request(`/v1/booth/accounting/orders/${orderId}/serve`, {
    method: 'PATCH',
    token,
    signal,
  });
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
  type?: string;
  revenue?: number;
}

export function fetchStoreProfile(token: string, signal?: AbortSignal): Promise<StoreProfile> {
  return fetchBoothDashboard(token, signal).then((payload) => {
    if (!payload) {
      throw new Error('店舗情報を取得できませんでした。');
    }
    return payload;
  });
}

export function updateStoreProfile(
  token: string,
  storeId: string,
  input: {
    name: string;
    description: string;
    current_wait_min: number;
    is_open: boolean;
    type?: BoothKind;
  },
  signal?: AbortSignal,
) {
  return request(`/v1/booth/dashboard/${encodeURIComponent(storeId)}`, {
    method: 'PATCH',
    token,
    body: input,
    signal,
  }).then((payload) => {
    const updated = normalizeItem<StoreProfile>(payload);
    if (!updated) {
      throw new Error('店舗情報を保存できませんでした。');
    }
    return updated;
  });
}
