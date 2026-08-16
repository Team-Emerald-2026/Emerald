import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Receipt } from 'lucide-react';
import StoreShell from './StoreShell';
import { issueOrder, adjustWaiting, useFestival } from '../../lib/festivalStore';
import { fetchMenuItems, type MenuItem } from '../../lib/api';

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

export default function StorePos() {
  const session = useFestival((s) => s.session);
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [issued, setIssued] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');

    fetchMenuItems(session.token, controller.signal)
      .then((items) => {
        setProducts(items.filter((item) => item.is_available));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : '商品の取得に失敗しました。');
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
  const total = entries.reduce(
    (a, [id, q]) => a + (products.find((p) => p.id === id)?.price ?? 0) * q,
    0,
  );

  const checkout = () => {
    if (entries.length === 0) return;
    const items = entries.map(([id, q]) => ({
      name: products.find((p) => p.id === id)!.name,
      qty: q,
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

        {error && (
          <p
            className="rounded-xl border border-border bg-card p-4 text-sm"
            style={{ color: 'var(--busy)' }}
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
            読み込み中...
          </p>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-muted-foreground">販売中の商品がありません</p>
            <Link
              to="/store/menu"
              className="mt-3 inline-block text-sm font-bold"
              style={{ color: 'var(--primary)' }}
            >
              商品管理で登録する
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setQty(p.id, qty + 1)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setQty(p.id, qty + 1);
                    }
                  }}
                  aria-label={`${p.name}を追加`}
                  className="relative min-h-28 cursor-pointer rounded-2xl border border-border bg-card p-3 pr-12 transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <p className="font-bold text-foreground">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{yen(p.price)}</p>
                  {qty > 0 ? (
                    <p className="mt-6 text-sm font-bold text-foreground">×{qty}</p>
                  ) : (
                    <p className="mt-6 text-sm text-muted-foreground">カードをタップで追加</p>
                  )}
                  {qty > 0 && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setQty(p.id, qty - 1);
                      }}
                      aria-label={`${p.name}を減らす`}
                      className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full border border-border bg-background text-foreground shadow-sm"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground">合計</span>
            <span className="font-display text-2xl font-bold text-foreground">{yen(total)}</span>
          </div>
          <button
            type="button"
            onClick={checkout}
            disabled={entries.length === 0}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Receipt className="h-5 w-5" />
            会計して受付番号を発行
          </button>
        </div>
      </div>
    </StoreShell>
  );
}