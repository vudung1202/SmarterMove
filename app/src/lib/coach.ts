import { Chess } from 'chess.js';
import type { Score } from '../engine/uci.ts';

export const PIECE_VI = { p: 'tốt', n: 'mã', b: 'tượng', r: 'xe', q: 'hậu', k: 'vua' } as const;
export type PieceType = keyof typeof PIECE_VI;

/** Ký hiệu nước tiếng Việt: V(ua) H(ậu) X(e) T(ượng) M(ã); tốt không có chữ. */
export const viSan = (san: string) => san.replace(/[KQRBN]/g, (c) => ({ K: 'V', Q: 'H', R: 'X', B: 'T', N: 'M' })[c]!);

/** Điểm engine (góc bên đang đi) → pawn, chiếu hết kẹp ±10. */
export function toPawns(score: Score): number {
  if ('mate' in score) return score.mate > 0 ? 10 : -10;
  return Math.max(-10, Math.min(10, score.cp / 100));
}

/** Winning chances của Lichess, thang −1..1. */
export const wc = (pawns: number) => 2 / (1 + Math.exp(-0.368208 * pawns)) - 1;

/** Cơ hội thắng 0..100% (thắng + nửa hòa) theo góc người chơi. */
export const winPercent = (pawns: number) => Math.round(((wc(pawns) + 1) / 2) * 100);

export type MoveClass = 'brilliant' | 'great' | 'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export const MOVE_CLASS: Record<MoveClass, { label: string; glyph: string }> = {
  brilliant: { label: 'Xuất sắc', glyph: '!!' },
  great: { label: 'Nước hay', glyph: '!' },
  book: { label: 'Nước sách', glyph: '' }, // icon quyển sách vẽ bằng SVG
  best: { label: 'Nước tốt nhất', glyph: '★' },
  excellent: { label: 'Rất tốt', glyph: '✓' },
  good: { label: 'Tốt', glyph: '✓' },
  inaccuracy: { label: 'Chưa chính xác', glyph: '?!' },
  mistake: { label: 'Sai lầm', glyph: '?' },
  blunder: { label: 'Lỗi lớn', glyph: '??' },
};

/**
 * Xếp loại nước theo mức tụt winning chances (thang −1..1, ngưỡng lỗi như Lichess).
 * `before`: điểm trước nước (= sau nước máy chọn), `after`: điểm sau nước; cùng góc người vừa đi.
 */
export function classify(before: number, after: number, isBest: boolean): Exclude<MoveClass, 'brilliant' | 'great' | 'book'> {
  if (isBest) return 'best';
  const drop = wc(before) - wc(after);
  if (drop >= 0.3) return 'blunder';
  if (drop >= 0.2) return 'mistake';
  if (drop >= 0.1) return 'inaccuracy';
  return drop < 0.04 ? 'excellent' : 'good'; // 0,04 ≈ mất 2% điểm kỳ vọng
}

const nf1 = new Intl.NumberFormat('vi', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Thời lượng: dưới 1 giây ghi ms, từ 1 giây ghi giây (1 chữ số thập phân). */
export const duration = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${nf1.format(ms / 1000)} giây`);
export const signed = (p: number) => (p > 0.05 ? '+' : p < -0.05 ? '\u2212' : '') + nf1.format(Math.abs(p));

const uciMove = (u: string) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });

/** Đổi nước UCI sang SAN ở thế cờ `fen`. */
export const sanOf = (fen: string, uci: string) => new Chess(fen).move(uciMove(uci)).san;

/**
 * Câu "hậu quả" sau một nước của người chơi.
 * `afterFen`: thế cờ sau nước đó; `reply`: nước đáp tốt nhất của đối thủ (UCI); `score`: điểm engine tại afterFen (góc đối thủ).
 */
export function consequence(afterFen: string, reply: string, score: Score, opp: string): string {
  const mv = new Chess(afterFen).move(uciMove(reply));
  if ('mate' in score && score.mate > 0) return `${opp} có đòn chiếu hết sau ${score.mate} nước, mở đầu bằng ${viSan(mv.san)}.`;
  if (mv.captured) return `${opp} đáp ${viSan(mv.san)} và bắt ${PIECE_VI[mv.captured as PieceType]} của bạn.`;
  return `${opp} đáp ${viSan(mv.san)}, thế cờ còn ${signed(-toPawns(score))} cho bạn.`;
}

const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
/** Chênh lệch quân (điểm) theo phía `me`. */
function balance(c: Chess, me: 'w' | 'b') {
  let d = 0;
  for (const row of c.board()) for (const x of row) if (x) d += (x.color === me ? 1 : -1) * VALUE[x.type];
  return d;
}

/**
 * Thí quân: đi theo biến chính `pv` (nước đầu là của người chơi) tới thế cờ "yên" đầu tiên sau khi đối thủ đáp
 * (nước không ăn quân, không chiếu, trong 6 nửa nước); khi đó người chơi thiếu ≥ 2 điểm quân so với trước nước.
 * Đổi quân ngang giá trở về 0 nên không tính; thí tốt (1 điểm) không tính.
 */
export function isSacrifice(fen: string, pv: string[]): boolean {
  const c = new Chess(fen);
  const me = c.turn();
  const start = balance(c, me);
  for (let k = 0; k < Math.min(pv.length, 6); k++) {
    let m;
    try { m = c.move(uciMove(pv[k])); } catch { return false; }
    if (k >= 1 && !m.captured && !c.inCheck()) return balance(c, me) <= start - 2;
  }
  return false;
}

/**
 * Loại cuối của một nước: sách khai cuộc (trừ khi là sai lầm/lỗi lớn) > xuất sắc > các mức theo độ tụt điểm.
 * Xuất sắc = nước tốt nhất/rất tốt + thí quân, khi trước đó chưa thắng áp đảo (< +4) và sau đó không bị bất lợi (≥ −0,5).
 * Nước hay = nước tốt nhất và là nước duy nhất giữ được thế cờ (`onlyMove`: nước tốt thứ hai tụt ≥ 0,25 winning chances).
 */
export function gradeClass(o: { before: number; after: number; isBest: boolean; isBook: boolean; sacrifice: boolean; onlyMove?: boolean }): MoveClass {
  const cls = classify(o.before, o.after, o.isBest);
  if (o.isBook) return cls === 'mistake' || cls === 'blunder' ? cls : 'book';
  if ((cls === 'best' || cls === 'excellent') && o.sacrifice && o.before < 4 && o.after >= -0.5) return 'brilliant';
  if (cls === 'best' && o.onlyMove) return 'great';
  return cls;
}
