import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Minus, ShoppingCart, Info, CheckCircle2, ArrowLeft } from 'lucide-react';
import { issueOrder, useFestival } from '../lib/festivalStore';
import { fetchRestaurants, type BackendStore } from '../lib/api';
import { Skeleton, SkeletonText } from './Skeleton';

interface MenuItem {
  id: string;
  storeId: string;
  name: string;
  desc: string;
  price: number | null;
}
interface Store {
  id: string;
  name: string;
  description: string;
  isOpen: boolean;
  waitMin: number;
  items: MenuItem[];
}

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
const priceLabel = (price: number) => yen(price);

function toStore(store: BackendStore): Store {
  return {
    id: store.id,
    name: store.name,
    description: store.description ?? '店舗説明は未設定です',
    isOpen: store.is_open,
    waitMin: Number(store.current_wait_min) || 0,
    items: (store.items ?? []).map((it) => ({
      id: String(it.id),
      storeId: store.id,
      name: it.name,
      desc: it.description ?? '',
      price: it.price,
    })),
  };
}

function StoreCardSkeleton() {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-4 py-3">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonText className="w-1/2" />
          <SkeletonText className="w-4/5" />
          <SkeletonText className="w-1/3" />
        </div>
        <Skeleton className="h-6 w-14 shrink-0 rounded-md" />
      </div>
      <div className="px-4 py-5">
        <SkeletonText className="w-3/5" />
        <SkeletonText className="mt-2 w-full" />
        <SkeletonText className="mt-2 w-2/3" />
      </div>
    </section>
  );
}

export default function Restaurants() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedStoreId = searchParams.get('store');
  const mode = pathname.endsWith('/cart')
    ? 'cart'
    : pathname.endsWith('/status')
      ? 'status'
      : 'order';

  // カート状態は同一コンポーネント内に保持され、サブパス遷移でも維持される
  const [stores, setStores] = useState<Store[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const confirmedOrder = useFestival((s) =>
    orderNumber ? s.orders.find((order) => order.number === orderNumber) ?? null : null,
  );

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetchRestaurants(controller.signal)
      .then((backendStores) => {
        setStores(backendStores.map(toStore));
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('バックエンドから店舗情報を取得できませんでした。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const itemIndex = useMemo(() => {
    const index = new Map<string, { item: MenuItem; store: Store }>();
    for (const store of stores) {
      for (const item of store.items) index.set(item.id, { item, store });
    }
    return index;
  }, [stores]);

  const orderedStores = useMemo(() => {
    if (!selectedStoreId) return stores;
    return [...stores].sort((a, b) => {
      if (a.id === selectedStoreId) return -1;
      if (b.id === selectedStoreId) return 1;
      return 0;
    });
  }, [stores, selectedStoreId]);

  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const ref = itemIndex.get(id);
      if (!ref || ref.item.price === null) return c;
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  const cartEntries = Object.entries(cart);
  const count = cartEntries.reduce((a, [, q]) => a + q, 0);
  const total = cartEntries.reduce((a, [id, q]) => a + (itemIndex.get(id)?.item.price ?? 0) * q, 0);

  const confirmOrder = () => {
    const items = cartEntries.flatMap(([id, q]) => {
      const ref = itemIndex.get(id);
      return ref && ref.item.price !== null ? [{ name: ref.item.name, qty: q, store: ref.store.name }] : [];
    });
    if (items.length === 0) return;
    const number = issueOrder(items, total);
    setOrderNumber(number);
    setCart({});
    navigate('/restaurants/status');
  };

  /* ---------- 共通ヘッダー ---------- */
  const header = (
    <div className="space-y-3">
      <h1 className="font-display text-2xl font-bold text-foreground">モバイルオーダー</h1>
      <nav className="flex gap-1 rounded-xl bg-muted p-1 text-sm">
        {[
          { to: '/restaurants', label: '選ぶ', active: mode === 'order' },
          { to: '/restaurants/cart', label: '確認', active: mode === 'cart' },
          { to: '/restaurants/status', label: '番号', active: mode === 'status' },
        ].map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="flex-1 rounded-lg py-1.5 text-center font-medium transition-colors"
            style={{
              backgroundColor: t.active ? 'var(--card)' : 'transparent',
              color: t.active ? 'var(--primary)' : 'var(--muted-foreground)',
              boxShadow: t.active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );

  /* ---------- 注文画面 ---------- */
  if (mode === 'order') {
    return (
      <div className="space-y-5 p-4">
        {header}

        {error && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {error}
          </div>
        )}

        <div
          className="flex gap-2 rounded-xl p-3 text-sm"
          style={{ backgroundColor: 'var(--info-soft)', color: 'var(--info)' }}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>商品が登録されている店舗だけ注文できます。未登録の店舗は準備中として表示されます。</p>
        </div>

        {loading && !error && (
          <div className="space-y-3" aria-label="店舗情報を読み込み中">
            {Array.from({ length: 3 }).map((_, index) => (
              <StoreCardSkeleton key={index} />
            ))}
          </div>
        )}

        {!loading && !error && stores.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            注文可能な店舗がありません。
          </div>
        )}

        {!loading && !error && orderedStores.map((s) => {
          const hasOrderableItems = s.items.some((item) => item.price !== null);
          const canOrder = s.isOpen && hasOrderableItems;

          return (
          <section
            key={s.id}
            className="overflow-hidden rounded-2xl border border-border bg-card"
            style={{
              boxShadow: selectedStoreId === s.id ? '0 0 0 2px var(--accent)' : 'none',
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate font-bold text-foreground">{s.name}</h2>
                <p className="text-xs text-muted-foreground">{s.description}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">待ち時間目安: {s.waitMin}分</p>
              </div>
              <span
                className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: canOrder ? 'var(--ok-soft)' : 'var(--busy-soft)',
                  color: canOrder ? 'var(--ok)' : 'var(--busy)',
                }}
              >
                {canOrder ? '注文可能' : s.isOpen ? '準備中' : '受付停止'}
              </span>
            </div>

            {s.items.length === 0 ? (
              <div className="px-4 py-5 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">この店舗は現在モバイル注文準備中です。</p>
                <p className="mt-1">商品が登録されるまで、アプリからの注文はできません。店頭で案内をご確認ください。</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
              {s.items.map((it) => {
                const qty = cart[it.id] ?? 0;
                const itemCanOrder = canOrder && it.price !== null;
                return (
                  <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{it.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{it.desc}</p>
                      <p className="mt-0.5 text-sm font-bold text-foreground">
                        {it.price === null ? '価格未設定' : priceLabel(it.price)}
                      </p>
                    </div>
                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => setQty(it.id, 1)}
                        disabled={!itemCanOrder}
                        className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold text-white"
                        style={{ backgroundColor: 'var(--primary)', opacity: itemCanOrder ? 1 : 0.4 }}
                      >
                        追加
                      </button>
                    ) : (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQty(it.id, qty - 1)}
                          aria-label="数量を減らす"
                          className="grid h-8 w-8 place-items-center rounded-full border border-border text-foreground"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-5 text-center font-bold text-foreground">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(it.id, qty + 1)}
                          aria-label="数量を増やす"
                          className="grid h-8 w-8 place-items-center rounded-full text-white"
                          style={{ backgroundColor: 'var(--primary)' }}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
              </ul>
            )}
          </section>
          );
        })}

        <div
          className="flex gap-2 rounded-xl p-3 text-sm"
          style={{ backgroundColor: 'var(--info-soft)', color: 'var(--info)' }}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>受け取りは各屋台のカウンターで。番号が呼ばれたら受付番号を見せてください。</p>
        </div>

        {/* カートサマリー（固定バー） */}
        {count > 0 && (
          <div className="fixed inset-x-0 bottom-[68px] z-20 mx-auto max-w-md px-4">
            <button
              type="button"
              onClick={() => navigate('/restaurants/cart')}
              className="flex w-full items-center justify-between rounded-2xl px-5 py-3 text-white shadow-lg"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <span className="flex items-center gap-2 font-bold">
                <ShoppingCart className="h-5 w-5" />
                カートの中を確認
              </span>
              <span className="text-sm font-medium">
                {count}点・{yen(total)}
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ---------- カート確認 ---------- */
  if (mode === 'cart') {
    return (
      <div className="space-y-5 p-4">
        {header}
        <h2 className="font-display text-lg font-bold text-foreground">カートの中を確認</h2>

        {cartEntries.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">カートは空です。</p>
            <Link
              to="/restaurants"
              className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              注文画面に戻る
            </Link>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {cartEntries.map(([id, q]) => {
                const ref = itemIndex.get(id)!;
                return (
                  <li
                    key={id}
                    className="rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-foreground">{ref.item.name}</p>
                        <p className="text-xs text-muted-foreground">{ref.store.name}</p>
                      </div>
                      <p className="shrink-0 font-bold text-foreground">
                        {ref.item.price === null ? '価格未設定' : yen(ref.item.price * q)}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQty(id, q - 1)}
                          aria-label="数量を減らす"
                          className="grid h-8 w-8 place-items-center rounded-full border border-border text-foreground"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-5 text-center font-bold text-foreground">{q}</span>
                        <button
                          type="button"
                          onClick={() => setQty(id, q + 1)}
                          aria-label="数量を増やす"
                          className="grid h-8 w-8 place-items-center rounded-full text-white"
                          style={{ backgroundColor: 'var(--primary)' }}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQty(id, 0)}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                      >
                        削除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
              <span className="font-bold text-foreground">合計</span>
              <span className="font-display text-xl font-bold text-foreground">{yen(total)}</span>
            </div>

            <div className="flex gap-3">
              <Link
                to="/restaurants"
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-border py-3 font-bold text-foreground hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
                戻る
              </Link>
              <button
                type="button"
                onClick={confirmOrder}
                className="flex-1 rounded-xl py-3 font-bold text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                注文を決定
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ---------- 注文番号 ---------- */
  return (
    <div className="space-y-5 p-4">
      {header}
      {orderNumber ? (
        <div className="rounded-3xl border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10" style={{ color: 'var(--primary)' }} />
          <p className="mt-3 text-sm text-muted-foreground">あなたのモバイルオーダー番号</p>
          <p
            className="my-2 font-display text-6xl font-bold"
            style={{ color: 'var(--primary)' }}
          >
            {orderNumber}
          </p>
          <p className="text-sm text-muted-foreground">
            番号が呼ばれたら、受け取り場所でこの画面を見せてください。
          </p>
          {confirmedOrder && (
            <div className="mt-5 space-y-3 rounded-2xl bg-muted p-4 text-left text-sm">
              <div>
                <p className="font-bold text-foreground">受け取り場所</p>
                <p className="text-muted-foreground">
                  {Array.from(new Set(confirmedOrder.items.map((item) => item.store))).join('、')}
                  のカウンター
                </p>
              </div>
              <div>
                <p className="font-bold text-foreground">支払い方法</p>
                <p className="text-muted-foreground">支払いは店頭で行ってください。</p>
              </div>
              <div>
                <p className="font-bold text-foreground">呼び出し状況</p>
                <p className="text-muted-foreground">
                  {confirmedOrder.status === 'called'
                    ? '呼び出し済みです。受け取りカウンターへ向かってください。'
                    : confirmedOrder.status === 'served'
                      ? '受け渡し済みです。'
                      : 'まだ呼び出し前です。番号が表示・呼び出しされるまでお待ちください。'}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">まだ注文がありません。</p>
          <Link
            to="/restaurants"
            className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-bold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            注文画面へ
          </Link>
        </div>
      )}
    </div>
  );
}
