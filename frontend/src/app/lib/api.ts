const DEFAULT_API_BASE = '/api';

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '');

export interface BoothLoginResponse {
  token: string;
  store_id: string | null;
  role?: 'store' | 'admin';
}

export type BoothKind = 'booth' | 'food' | 'exhibit' | 'information' | 'shop';

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
  /** 整理券の枚数（1〜この番号までを使い回す。既定50） */
  ticket_limit?: number;
  /** 非表示（紛失など）にした整理券の番号。発番時に飛ばされる */
  disabled_ticket_numbers?: number[];
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
  /** 売り切れ中（メニューには表示したまま、注文だけ止める） */
  is_sold_out?: boolean;
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
  /** 使っていない（受付番号は数字だけ）。古いAPI互換のため残している */
  ticket_prefix?: string | null;
  is_open: boolean;
  is_visible: boolean;
  show_on_monitor: boolean;
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
  login_id?: string;
  password?: string;
  is_open: boolean;
  is_visible: boolean;
  show_on_monitor: boolean;
  current_wait_min: number;
  current_queue_count: number;
}

export interface BackendMapFacility {
  id: string;
  store_id: string | null;
  name: string;
  /** 場所の名前（部屋番号など）。店舗が入った枠でも、同じ位置の空き枠の名前が入る。なければ null */
  label?: string | null;
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
    public readonly code?: string,
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
    let code: string | undefined;
    try {
      const errorBody = (await response.json()) as unknown;
      if (isRecord(errorBody)) {
        if (typeof errorBody.message === 'string' && errorBody.message.trim()) {
          message = errorBody.message;
        } else if (isRecord(errorBody.error) && typeof errorBody.error.message === 'string') {
          message = errorBody.error.message;
        }
        if (isRecord(errorBody.error) && typeof errorBody.error.code === 'string') {
          code = errorBody.error.code;
        }
      }
    } catch {
      // keep default message
    }
    throw new ApiError(message, response.status, code);
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

/** 商品の売り切れを切り替える（売り切れ中もメニューには表示され、注文だけ止まる） */
export function setBoothMenuItemSoldOut(
  token: string,
  id: number | string,
  isSoldOut: boolean,
  signal?: AbortSignal,
) {
  return request(`/v1/booth/accounting/menu-items/${encodeURIComponent(String(id))}/sold-out`, {
    method: 'PATCH',
    token,
    body: { is_sold_out: isSoldOut },
    signal,
  }).then((payload) => {
    const updated = normalizeItem<BackendMenuItem>(payload);
    if (!updated) {
      throw new Error('売り切れの設定を変更できませんでした。');
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

export function fetchAdminStores(token?: string, signal?: AbortSignal) {
  return request('/v1/admin/stores', { signal, token }).then((payload) => {
    if (isRecord(payload) && Array.isArray(payload.data)) return payload.data as AdminStore[];
    return [];
  });
}

export function createAdminStore(token: string | undefined, input: AdminStoreInput, signal?: AbortSignal) {
  return request('/v1/admin/stores', {
    method: 'POST',
    signal,
    token,
    body: input,
  }).then((payload) => (isRecord(payload) ? payload.data as AdminStore : null));
}

export function updateAdminStore(
  token: string | undefined,
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

export function hideAdminStore(token: string | undefined, id: string, signal?: AbortSignal) {
  return request(`/v1/admin/stores/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal,
    token,
  }).then((payload) => (isRecord(payload) ? payload.data as AdminStore : null));
}

/** 店舗を完全に削除する（注文・メニュー・ログインアカウント等も消える。元に戻せない） */
export function deleteAdminStorePermanently(token: string | undefined, id: string, signal?: AbortSignal) {
  return request(`/v1/admin/stores/${encodeURIComponent(id)}/permanent`, {
    method: 'DELETE',
    signal,
    token,
  });
}

/** 管理画面「マップ編集」用の場所（ピン） */
export interface AdminMapFacility {
  id: string;
  /** 紐づいている店舗のID（空き枠なら null） */
  store_id: string | null;
  store_name: string | null;
  /** 紐づいている店舗が来場者画面に表示中か（空き枠なら null） */
  store_visible: boolean | null;
  name: string;
  /** 場所の名前（部屋番号など）。店舗が入った枠は同じ位置の空き枠の名前。なければ null */
  label: string | null;
  type: string;
  floor: number;
  x: number;
  y: number;
}

export interface AdminMapFacilityInput {
  name?: string;
  type?: string;
  floor?: number;
  x?: number;
  y?: number;
}

export function fetchAdminMapFacilities(token?: string, signal?: AbortSignal) {
  return request('/v1/admin/map/facilities', { signal, token }).then((payload) => {
    if (isRecord(payload) && Array.isArray(payload.data)) return payload.data as AdminMapFacility[];
    return [];
  });
}

export function createAdminMapFacility(
  token: string | undefined,
  input: Required<AdminMapFacilityInput>,
  signal?: AbortSignal,
) {
  return request('/v1/admin/map/facilities', {
    method: 'POST',
    signal,
    token,
    body: input,
  }).then((payload) => (isRecord(payload) ? (payload.data as AdminMapFacility) : null));
}

export function updateAdminMapFacility(
  token: string | undefined,
  id: string,
  input: AdminMapFacilityInput,
  signal?: AbortSignal,
) {
  return request(`/v1/admin/map/facilities/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    signal,
    token,
    body: input,
  }).then((payload) => (isRecord(payload) ? (payload.data as AdminMapFacility) : null));
}

export function deleteAdminMapFacility(token: string | undefined, id: string, signal?: AbortSignal) {
  return request(`/v1/admin/map/facilities/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal,
    token,
  });
}

export function fetchAdminAnalytics(token?: string, signal?: AbortSignal) {
  return request('/v1/admin/analytics', { signal, token }).then((payload) =>
    isRecord(payload) ? payload.data as AdminAnalytics : null,
  );
}

/** 売上データ（会計・売上入力・受付番号）をすべて消して待ち人数を 0 に戻す。元に戻せない。 */
export function resetAdminSales(token?: string, signal?: AbortSignal) {
  return request('/v1/admin/analytics', { method: 'DELETE', signal, token });
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
  /** 開始の何分前からホームの電光掲示板に流すか。null は流さない */
  ticker_lead_minutes?: number | null;
  /** イベント: 開始の何分後まで流すか（null は 20 分）。お知らせ: 流す時間（null は止めるまで） */
  ticker_after_minutes?: number | null;
  /** お知らせを掲示板に流し始めた時刻。null は流していない */
  ticker_started_at?: string | null;
  /** いま電光掲示板に流しているか */
  ticker_active?: boolean;
  /** お知らせを登録した時刻（ホームのお知らせ一覧に表示する） */
  created_at?: string | null;
  /** イベントの開催場所（校内マップの部屋）の id。null は場所なし */
  map_facility_id?: string | null;
  /** イベントの開催場所（例: 8階の 801） */
  location?: EventLocation | null;
}

export interface EventLocation {
  /** 校内マップの施設 id */
  id: string;
  floor: number;
  name: string;
}

export interface EventNoticeInput {
  title: string;
  /** 空でもよい（未入力のときは空文字で保存する） */
  body?: string;
  type: 'event' | 'notice';
  starts_at?: string | null;
  ends_at?: string | null;
  is_published?: boolean;
  ticker_lead_minutes?: number | null;
  ticker_after_minutes?: number | null;
  /** お知らせを掲示板にすぐ流すか（true で流し始め、false で止める） */
  ticker_now?: boolean;
  /** イベントの開催場所（校内マップの部屋の id）。null で場所なし */
  map_facility_id?: number | null;
}

/** ホームの電光掲示板に、いま流すお知らせ */
export interface TickerItem {
  id: string;
  title: string;
  body: string;
  /** イベントの開始時刻。お知らせは null（時刻を出さない） */
  starts_at: string | null;
  /** イベントの終了時刻。指定なし・お知らせは null */
  ends_at?: string | null;
  /** イベントの場所（例: 8F・801）。指定なし・お知らせは null */
  location?: string | null;
}

export function fetchTicker(signal?: AbortSignal) {
  return request('/v1/ticker', { signal }).then((payload) =>
    normalizeCollection<TickerItem>(payload),
  );
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

export function fetchAdminEvents(token?: string, signal?: AbortSignal) {
  return request('/v1/admin/events', { signal, token }).then((payload) =>
    normalizeCollection<EventNotice>(payload),
  );
}

export function createAdminEvent(
  token: string | undefined,
  input: EventNoticeInput,
  signal?: AbortSignal,
) {
  return request('/v1/admin/events', {
    method: 'POST',
    token,
    body: input,
    signal,
  }).then((payload) => normalizeItem<EventNotice>(payload));
}

export function updateAdminEvent(
  token: string | undefined,
  id: string,
  input: Partial<EventNoticeInput>,
  signal?: AbortSignal,
) {
  return request(`/v1/admin/events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body: input,
    signal,
  }).then((payload) => normalizeItem<EventNotice>(payload));
}

export function deleteAdminEvent(token: string | undefined, id: string, signal?: AbortSignal) {
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
  location_name?: string | null;
  is_open?: boolean;
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

/**
 * 待ち時間・待ち人数の更新。送った項目だけが更新される。
 * - current_queue_delta: 待ち人数を +1 / -1 のように増減する（注文の登録・提供と同時でも数え違いが起きない）
 * - current_queue_count: 待ち人数をその値にそろえる（current_queue_delta とは同時に送れない）
 */
export function updateWaitTime(
  token: string,
  input: {
    current_wait_min?: number;
    current_queue_count?: number;
    current_queue_delta?: number;
    wait_display_mode?: 'minutes' | 'text';
    wait_display_text?: string | null;
  },
  signal?: AbortSignal,
) {
  return request('/v1/booth/wait-time', {
    method: 'PATCH',
    token,
    body: input,
    signal,
  }).then((payload) => {
    const updated = normalizeItem<{
      id: string;
      current_wait_min: number;
      current_queue_count: number;
      wait_display_mode: 'minutes' | 'text';
      wait_display_text: string | null;
      updated_at: string | null;
    }>(payload);

    if (!updated) {
      throw new Error('待ち時間を更新できませんでした。');
    }

    return updated;
  });
}

// ---------------------------------------------------------------------------
// 注文（レジ・呼び出し・提供）
// ---------------------------------------------------------------------------

export interface BoothOrderItem {
  id: string;
  menu_item_id: number;
  /** 商品名。販売停止にしたメニューでも取得できる */
  name: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export type BoothOrderStatus = 'issued' | 'settled' | 'canceled';

export interface BoothOrder {
  /** 注文のID。API のパスに使う値（表示用の番号は ticket_number） */
  id: string;
  /** 表示用の番号（例: 101）。旧データは C-101 形式のこともある */
  ticket_number: string;
  total_price: number;
  status: BoothOrderStatus;
  ordered_at: string | null;
  called_at: string | null;
  served_at: string | null;
  settled_at: string | null;
  items: BoothOrderItem[];
}

/** 画面上の進み具合。提供済み → 呼び出し済み → 提供待ち の順で判定する */
export type BoothOrderStage = 'waiting' | 'called' | 'served' | 'canceled';

export function getBoothOrderStage(order: BoothOrder): BoothOrderStage {
  if (order.status === 'canceled') return 'canceled';
  if (order.served_at) return 'served';
  if (order.called_at) return 'called';
  return 'waiting';
}

export interface BoothOrderInput {
  items: { menu_item_id: number; quantity: number }[];
  /** true にすると、注文の作成と同じ処理の中で精算まで行う（レジの会計と同時） */
  settle?: boolean;
}

function toBoothOrder(payload: unknown, errorMessage: string): BoothOrder {
  const order = normalizeItem<BoothOrder>(payload);
  if (!order || !order.id) {
    throw new Error(errorMessage);
  }
  return { ...order, items: Array.isArray(order.items) ? order.items : [] };
}

export function fetchBoothOrders(
  token: string,
  signal?: AbortSignal,
  status?: BoothOrderStatus,
) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/v1/booth/accounting/orders${query}`, { signal, token }).then((payload) =>
    normalizeCollection<BoothOrder>(payload).map((order) => ({
      ...order,
      items: Array.isArray(order.items) ? order.items : [],
    })),
  );
}

export function createBoothOrder(token: string, input: BoothOrderInput, signal?: AbortSignal) {
  return request('/v1/booth/accounting/orders', {
    method: 'POST',
    token,
    body: input,
    signal,
  }).then((payload) => toBoothOrder(payload, '注文を登録できませんでした。'));
}

export function callBoothOrder(token: string, orderId: number | string, signal?: AbortSignal) {
  return request(`/v1/booth/accounting/orders/${encodeURIComponent(String(orderId))}/call`, {
    method: 'PATCH',
    token,
    signal,
  }).then((payload) => toBoothOrder(payload, '呼び出しに失敗しました。'));
}

export function serveBoothOrder(token: string, orderId: number | string, signal?: AbortSignal) {
  return request(`/v1/booth/accounting/orders/${encodeURIComponent(String(orderId))}/serve`, {
    method: 'PATCH',
    token,
    signal,
  }).then((payload) => toBoothOrder(payload, '提供済みにできませんでした。'));
}

/**
 * 注文の操作（作成・呼び出し・提供・戻す）が失敗したときに、画面に出すメッセージ。
 * ログインの期限切れ（401）は、呼び出し側で先に判定すること。
 * 409 は「他の端末などで、すでに状態が変わっていた」場合。
 */
export function describeOrderError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 409 && error.code === 'SOLD_OUT') {
      return `${error.message}。売り切れの商品をカートから外しました。`;
    }
    if (error.status === 409 && error.code === 'NO_TICKET_AVAILABLE') {
      // 整理券が全部出払っている（または非表示が多すぎる）とき
      return error.message;
    }
    if (error.status === 409) {
      return 'すでに状態が変わっていました。最新の状態に更新しました。';
    }
    if (error.status === 404) {
      return '注文が見つかりませんでした。最新の状態に更新しました。';
    }
    if (error.status >= 500) {
      return 'サーバーでエラーが起きました。少し待ってから、もう一度お試しください。';
    }
    return fallback;
  }
  return '通信に失敗しました。通信状況を確認して、もう一度お試しください。';
}

/** 提供済みを取り消して、提供待ちに戻す（待ち人数も戻る） */
export function unserveBoothOrder(token: string, orderId: number | string, signal?: AbortSignal) {
  return request(`/v1/booth/accounting/orders/${encodeURIComponent(String(orderId))}/unserve`, {
    method: 'PATCH',
    token,
    signal,
  }).then((payload) => toBoothOrder(payload, '未提供に戻せませんでした。'));
}

/** 提供前の注文（提供待ち・呼び出し中）をキャンセルする。待ち人数は1人分減り、売上から外れる */
export function cancelBoothOrder(token: string, orderId: number | string, signal?: AbortSignal) {
  return request(`/v1/booth/accounting/orders/${encodeURIComponent(String(orderId))}/cancel`, {
    method: 'PATCH',
    token,
    signal,
  }).then((payload) => toBoothOrder(payload, 'キャンセルできませんでした。'));
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
  /** 整理券の枚数（1〜この番号までを使い回す。既定50） */
  ticket_limit?: number;
  /** 非表示（紛失など）にした整理券の番号。発番時に飛ばされる */
  disabled_ticket_numbers?: number[];
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
    current_wait_min?: number;
    is_open: boolean;
    type?: BoothKind;
    /** 整理券の枚数（1〜999）。増やすと整理券の追加になる */
    ticket_limit?: number;
    /** 非表示（紛失など）にする整理券の番号 */
    disabled_ticket_numbers?: number[];
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
