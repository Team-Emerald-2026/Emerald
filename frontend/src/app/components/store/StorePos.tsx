import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Receipt } from 'lucide-react';
import StoreShell from './StoreShell';
import { issueOrder, adjustWaiting, useFestival } from '../../lib/festivalStore';
import { fetchBoothMenuItems } from '../../lib/api';

interface Product {
  id: string;
  name: string;
  price: number;
}

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

export default function StorePos() {
  const session = useFestival((s) => s.session);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [issued, setIssued] = useState<string | null>(null);

  // ログイン中の店舗が「店舗情報」で登録したメニューを読み込む
  useEffect(() => {
    if (!session?.token) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    fetchBoothMenuItems(session.token, controller.signal)
      .then((items) => {
        setProducts(
          items
            .filter((item) => item.is_available !== false)
            .map((item) => ({ id: String(item.id), name: item.name, price: Number(item.price) })),
        );
        setCart({});
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof Error ? err.message : 'メニューを取得できませんでした。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [session?.token]);

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

  const checkout = () => {
    if (lineItems.length === 0) return;
    const items = lineItems.map((item) => ({
      name: item.name,
      qty: item.qty,
      store: 'レジ会計',
    }));
    const number = issueOrder(items, total);
    adjustWaiting(1);
    setIssued(number);
    setCart({});
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
                  className="flex min-h-36 flex-col rounded-2xl border border-border bg-card p-3"
                >
                  <p className="font-bold text-foreground">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{yen(p.price)}</p>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => setQty(p.id, qty - 1)}
                      disabled={qty === 0}
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
                      aria-label={`${p.name}を1追加`}
                      className="grid h-11 w-11 place-items-center rounded-xl text-white"
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
              onClick={checkout}
              disabled={lineItems.length === 0}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <Receipt className="h-5 w-5" />
              会計して受付番号を発行
            </button>
          </aside>
        </div>
      </div>
    </StoreShell>
  );
}
