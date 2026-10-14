import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Receipt } from 'lucide-react';
import StoreShell from './StoreShell';
import { logoutStore, useFestival } from '../../lib/festivalStore';
import {
  ApiError,
  createBoothOrder,
  describeOrderError,
  fetchBoothMenuItems,
  setBoothMenuItemSoldOut,
} from '../../lib/api';

interface Product {
  id: string;
  name: string;
  price: number;
  soldOut: boolean;
}

/** 売り切れ・削除された商品をカートから外す */
const pruneCart = (cart: Record<string, number>, products: Product[]) =>
  Object.fromEntries(
    Object.entries(cart).filter(([id]) => products.some((p) => p.id === id && !p.soldOut)),
  );

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

export default function StorePos() {
  const session = useFestival((s) => s.session);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [issued, setIssued] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // 連打しても二重に送らないための目印（state は次の描画まで変わらないため ref も使う）
  const submittingRef = useRef(false);

  // ログイン中の店舗が「店舗情報」で登録したメニューを読み込む
  const loadProducts = useCallback(
    (token: string, signal?: AbortSignal) => {
      setLoading(true);
      setLoadError('');
      return fetchBoothMenuItems(token, signal)
        .then((items) => {
          const next = items
            .filter((item) => item.is_available !== false)
            .map((item) => ({
              id: String(item.id),
              name: item.name,
              price: Number(item.price),
              soldOut: item.is_sold_out === true,
            }));
          setProducts(next);
          setCart((c) => pruneCart(c, next));
        })
        .catch((err: unknown) => {
          if (signal?.aborted) return;
          setLoadError(err instanceof Error ? err.message : 'メニューを取得できませんでした。');
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [],
  );

  useEffect(() => {
    if (!session?.token) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    void loadProducts(session.token, controller.signal);
    return () => controller.abort();
  }, [session?.token, loadProducts]);

  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  const entries = Object.entries(cart);
  const lineItems = entries.flatMap(([id, qty]) => {
    const product = products.find((p) => p.id === id);
    return product ? [{ ...product, qty, subtotal: product.price * qty }] : [];
  });
  const total = lineItems.reduce((sum, item) => sum + item.subtotal, 0);

  // 会計と同時に、サーバーへ注文を登録（精算も同じ処理で行う）。成功してはじめて受付番号を出す。
  const checkout = async () => {
    if (!session?.token || lineItems.length === 0) return;
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    setIssued(null);

    try {
      const order = await createBoothOrder(session.token, {
        items: lineItems.map((item) => ({
          menu_item_id: Number(item.id),
          quantity: item.qty,
        })),
        settle: true,
      });
      setIssued(order.ticket_number);
      setCart({});
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logoutStore();
        return;
      }
      if (err instanceof ApiError && err.status === 422) {
        // 販売停止や削除でメニューが変わっていた場合は、読み込み直して選び直してもらう
        await loadProducts(session.token);
        setSubmitError(
          'メニューの内容が変わっていたため、最新のメニューに更新しました。注文内容を確認して、もう一度会計してください。',
        );
        return;
      }
      if (err instanceof ApiError && err.code === 'SOLD_OUT') {
        // 別の端末で売り切れにされていた場合は、最新のメニューを読み込んでカートから外す
        await loadProducts(session.token);
        setSubmitError(describeOrderError(err, '売り切れの商品が含まれています。'));
        return;
      }
      if (err instanceof ApiError) {
        setSubmitError(describeOrderError(err, '会計を登録できませんでした。もう一度お試しください。'));
      } else {
        // 通信が途中で切れた場合は、サーバー側で登録済みの可能性がある（二重登録を避けたい）
        setSubmitError(
          '通信に失敗しました。注文が登録されたかもしれません。「受付番号の呼び出し」で確認してから、必要ならもう一度会計してください。',
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const toggleSoldOut = async (product: Product) => {
    if (!session?.token || togglingId) return;

    setTogglingId(product.id);
    setSubmitError('');
    try {
      const updated = await setBoothMenuItemSoldOut(session.token, product.id, !product.soldOut);
      const next = products.map((p) =>
        p.id === product.id ? { ...p, soldOut: updated.is_sold_out === true } : p,
      );
      setProducts(next);
      setCart((c) => pruneCart(c, next));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logoutStore();
        return;
      }
      setSubmitError(err instanceof Error ? err.message : '売り切れの設定を変更できませんでした。');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <StoreShell title="レジ（会計）">
      <div className="space-y-5">
        {issued && (
          <div
            className="rounded-2xl p-4 text-center"
            style={{ backgroundColor: 'var(--ok-soft)', color: 'var(--ok)' }}
          >
            <p className="text-sm">受付番号を発行しました</p>
            <p className="font-display text-4xl font-bold">{issued}</p>
          </div>
        )}
        {submitError && (
          <p
            role="alert"
            className="rounded-2xl border border-border bg-card p-4 text-sm text-red-500"
          >
            {submitError}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          {loading ? (
            <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              メニューを読み込み中...
            </p>
          ) : loadError ? (
            <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-red-500">
              {loadError}
            </p>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <p className="font-bold text-foreground">メニューがまだ登録されていません</p>
              <p className="mt-1 text-sm text-muted-foreground">
                「店舗情報」でメニューを登録すると、ここに表示されます。
              </p>
              <Link
                to="/store/profile"
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2 text-sm font-bold text-white"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                店舗情報でメニューを登録する
              </Link>
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className={`flex min-h-36 flex-col rounded-2xl border border-border p-3 ${
                    p.soldOut ? 'bg-muted' : 'bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`font-bold ${
                        p.soldOut ? 'text-muted-foreground line-through' : 'text-foreground'
                      }`}
                    >
                      {p.name}
                    </p>
                    {p.soldOut && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{ backgroundColor: 'var(--busy-soft)', color: 'var(--busy)' }}
                      >
                        売り切れ
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{yen(p.price)}</p>
                  <button
                    type="button"
                    onClick={() => void toggleSoldOut(p)}
                    disabled={togglingId !== null}
                    className="mt-2 min-h-9 rounded-lg border border-border bg-background px-2 text-xs font-bold text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {togglingId === p.id ? '変更中...' : p.soldOut ? '販売を再開する' : '売り切れにする'}
                  </button>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setQty(p.id, qty - 1)}
                      disabled={qty === 0 || p.soldOut}
                      aria-label={`${p.name}を1減らす`}
                      className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-background text-foreground disabled:opacity-40"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="min-w-8 text-center font-display text-xl font-bold text-foreground">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(p.id, qty + 1)}
                      disabled={p.soldOut}
                      aria-label={`${p.name}を1追加`}
                      className="grid h-11 w-11 place-items-center rounded-xl text-white disabled:opacity-40"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          )}

          <aside className="rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-32">
            <h2 className="font-display text-base font-bold text-foreground">注文内容</h2>
            {lineItems.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                商品の − / 数量 / ＋ で追加してください。
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {lineItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {item.name}×{item.qty}
                    </span>
                    <span className="text-muted-foreground">{yen(item.subtotal)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="font-bold text-foreground">合計</span>
              <span className="font-display text-2xl font-bold text-foreground">{yen(total)}</span>
            </div>
            <button
              type="button"
              onClick={() => void checkout()}
              disabled={lineItems.length === 0 || submitting}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <Receipt className="h-5 w-5" />
              {submitting ? '送信中...' : '会計して受付番号を発行'}
            </button>
          </aside>
        </div>
      </div>
    </StoreShell>
  );
}
