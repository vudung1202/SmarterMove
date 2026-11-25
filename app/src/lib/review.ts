import { Chess } from 'chess.js';
import { ANALYSIS, type Engine } from '../engine/engine.ts';
import type { Score } from '../engine/uci.ts';
import { bookName } from './book.ts';
import { consequence, gradeClass, sanOf, toPawns, viSan, wc, type MoveClass } from './coach.ts';
import type { GameRecord } from './progress.ts';
import type { Color, Grade } from './saved-game.ts';

/** Phân tích bổ sung cho màn Xem lại: tối đa 300 ms mỗi thế cờ (ván 40 nước ≈ 25 giây trên iPhone). */
export const REVIEW_GO = 'depth 12 movetime 300';
export const BAD: MoveClass[] = ['inaccuracy', 'mistake', 'blunder'];

/** Nửa nước `ply` có phải của người chơi cầm `color` không. */
export const isMine = (ply: number, color: Color) => (ply % 2 === 0) === (color === 'w');

/** fens[i + 1] = thế cờ sau nửa nước i; fens[0] = thế cờ ban đầu. */
export function fensOf(sans: string[]) {
  const c = new Chess();
  return [c.fen(), ...sans.map((s) => (c.move(s), c.fen()))];
}

/** Điểm của thế cờ kết thúc theo luật (góc người chơi), hoặc null nếu ván chưa kết thúc ở đó. */
function terminal(fen: string, color: Color) {
  const g = new Chess(fen);
  if (!g.isGameOver()) return null;
  return g.isCheckmate() ? (g.turn() === color ? -10 : 10) : 0;
}

/** Các thế cờ (chỉ số −1..n−1) còn thiếu dữ liệu cần engine. Rỗng = mở màn Xem lại ngay được. */
export function missingPositions(rec: GameRecord): number[] {
  const fens = fensOf(rec.sans), out: number[] = [];
  for (let i = -1; i < rec.sans.length; i++) {
    if (terminal(fens[i + 1], rec.color) != null) continue;
    const needEval = rec.evals?.[i] == null;
    const needBest = i + 1 < rec.sans.length && isMine(i + 1, rec.color) && !rec.grades[i + 1]?.best;
    const needReply = isMine(i, rec.color) && rec.grades[i]?.before == null; // để viết lời coach cho nước kém
    if (needEval || needBest || needReply) out.push(i);
  }
  return out;
}

/** Phân tích các thế cờ còn thiếu rồi điền điểm, nước máy chọn và đánh giá cho mọi nước của người chơi. */
export async function backfill(rec: GameRecord, engine: Engine, bossName: string, onProgress: (done: number, total: number) => void): Promise<GameRecord> {
  const fens = fensOf(rec.sans), todo = missingPositions(rec);
  const evals = { ...rec.evals }, grades: Record<number, Grade> = { ...rec.grades };
  const found: Record<number, { best: string; score: Score }> = {};
  for (let i = -1; i < rec.sans.length; i++) {
    const t = terminal(fens[i + 1], rec.color);
    if (t != null) evals[i] = t;
  }
  for (const [k, i] of todo.entries()) {
    onProgress(k, todo.length);
    const fen = fens[i + 1];
    const r = await engine.search(fen, ANALYSIS, REVIEW_GO);
    if (!r.best || r.best === '(none)' || !r.info?.score) continue;
    const pawns = toPawns(r.info.score);
    if (evals[i] == null) evals[i] = new Chess(fen).turn() === rec.color ? pawns : -pawns;
    found[i] = { best: r.best, score: r.info.score };
  }
  onProgress(todo.length, todo.length);
  for (let k = 0; k < rec.sans.length; k++) {
    if (!isMine(k, rec.color)) continue;
    const old = grades[k], before = evals[k - 1], after = evals[k];
    if (before == null || after == null || old?.before != null) continue; // nước chấm lúc chơi đã đủ số liệu
    const best = old?.best ?? found[k - 1]?.best;
    const played = new Chess(fens[k]).move(rec.sans[k]).lan;
    const cls = old?.cls ?? gradeClass({ before, after, isBest: best === played, isBook: !!(await bookName(fens[k + 1])), sacrifice: false });
    let text = old?.text ?? null;
    if (!old && BAD.includes(cls) && found[k] && best) text = `${consequence(fens[k + 1], found[k].best, found[k].score, bossName)} Nước tốt hơn: ${viSan(sanOf(fens[k], best))}.`;
    grades[k] = { cls, text, before, after, best };
  }
  return { ...rec, evals, grades };
}

/** Ba khoảnh khắc đáng học: các nước kém của người chơi tụt nhiều winning chances nhất, xếp lại theo thứ tự trong ván. */
export function keyMoments(rec: GameRecord): number[] {
  return Object.entries(rec.grades)
    .map(([k, g]) => ({ ply: Number(k), g }))
    .filter(({ ply, g }) => isMine(ply, rec.color) && BAD.includes(g.cls) && g.before != null && g.after != null)
    .map(({ ply, g }) => ({ ply, drop: wc(g.before!) - wc(g.after!) }))
    .sort((a, b) => b.drop - a.drop)
    .slice(0, 3)
    .map((m) => m.ply)
    .sort((a, b) => a - b);
}
