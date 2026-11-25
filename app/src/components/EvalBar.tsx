import { winPercent } from '../lib/coach.ts';

/** Thanh cơ hội thắng bên trái bàn cờ: phần dưới là phía người chơi, tô màu quân của họ. `pawns` theo góc người chơi; null = chưa có. */
export function EvalBar({ pawns, me }: { pawns: number | null; me: 'w' | 'b' }) {
  const pct = pawns == null ? 50 : winPercent(pawns);
  return (
    <div className={`evalbar me-${me}`} role="img" aria-label={`Cơ hội thắng của bạn ${pct}%`}>
      <span style={{ height: `${pct}%` }} />
    </div>
  );
}
