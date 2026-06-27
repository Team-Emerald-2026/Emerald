import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <Compass className="h-12 w-12" style={{ color: 'var(--primary)' }} />
      <div>
        <p className="font-display text-3xl font-bold text-foreground">ページが見つかりません</p>
        <p className="mt-1 text-sm text-muted-foreground">
          お探しのページは移動または削除された可能性があります。
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          to="/"
          className="rounded-xl px-5 py-2.5 font-bold text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          ホームに戻る
        </Link>
        <Link
          to="/map"
          className="rounded-xl border border-border px-5 py-2.5 font-bold text-foreground hover:bg-muted"
        >
          マップを見る
        </Link>
      </div>
    </div>
  );
}
