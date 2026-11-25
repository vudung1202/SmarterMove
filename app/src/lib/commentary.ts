import { Chess, type Square } from 'chess.js';
import { PIECE_VI, type PieceType } from './coach.ts';

// Lời coach theo mẫu (kiểu Chess.com Coach): mô tả một nước bằng các sự thật đọc được từ bàn cờ,
// không cần engine. Phần "tốt/xấu" vẫn do engine chấm (coach.ts).
const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const CENTER = ['d4', 'e4', 'd5', 'e5'];

/** Quân (trừ vua) của `side` đang bị đe dọa: bị tấn công mà không ai bảo vệ, hoặc bị một quân rẻ hơn tấn công. Quân đắt trước. */
export function threatened(c: Chess, side: 'w' | 'b'): { square: Square; type: PieceType }[] {
  const enemy = side === 'w' ? 'b' : 'w';
  const out: { square: Square; type: PieceType }[] = [];
  for (const row of c.board()) {
    for (const x of row) {
      if (!x || x.color !== side || x.type === 'k') continue;
      const atk = c.attackers(x.square, enemy);
      if (!atk.length) continue;
      const cheapest = Math.min(...atk.map((s) => VALUE[c.get(s)!.type as PieceType]));
      if (!c.attackers(x.square, side).length || cheapest < VALUE[x.type as PieceType]) out.push({ square: x.square, type: x.type as PieceType });
    }
  }
  return out.sort((a, b) => VALUE[b.type] - VALUE[a.type]);
}

/** Các ý mô tả nước `san` đi từ thế cờ `fenBefore`, ví dụ ['ra quân mã', 'tấn công tốt ở e5']. */
export function describeMove(fenBefore: string, san: string): string[] {
  const c = new Chess(fenBefore);
  const m = c.move(san);
  const facts: string[] = [];
  const backRank = m.color === 'w' ? '1' : '8';
  if (m.flags.includes('k') || m.flags.includes('q')) facts.push('nhập thành, đưa vua vào chỗ an toàn');
  else if (m.promotion) facts.push(`phong ${PIECE_VI[m.promotion as PieceType]}`);
  else if (m.captured) facts.push(`bắt ${PIECE_VI[m.captured as PieceType]}`);
  else if ((m.piece === 'n' || m.piece === 'b') && m.from[1] === backRank) facts.push(`ra quân ${PIECE_VI[m.piece]}`);
  else if (m.piece === 'p' && CENTER.includes(m.to)) facts.push('chiếm trung tâm');
  if (c.inCheck()) facts.push('chiếu vua');
  // quân đối thủ bị chính quân vừa đi đe dọa
  const enemy = m.color === 'w' ? 'b' : 'w';
  const targets = threatened(c, enemy).filter((t) => c.attackers(t.square, m.color).includes(m.to as Square));
  if (targets.length >= 2) facts.push(`chĩa đôi ${PIECE_VI[targets[0].type]} và ${PIECE_VI[targets[1].type]}`);
  else if (targets.length === 1) facts.push(`tấn công ${PIECE_VI[targets[0].type]} ở ${targets[0].square}`);
  return facts;
}

/** Viết hoa chữ đầu. */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- nhận xét sâu hơn: cấu trúc tốt, an toàn vua, nguyên tắc khai cuộc, kế hoạch ----------
const FILES = 'abcdefgh';
type Side = 'w' | 'b';

/** Các tốt của `side`: [cột 0..7, hàng 1..8]. */
function pawns(c: Chess, side: Side): [number, number][] {
  const out: [number, number][] = [];
  for (const row of c.board()) for (const x of row) if (x && x.color === side && x.type === 'p') out.push([FILES.indexOf(x.square[0]), Number(x.square[1])]);
  return out;
}
const doubledFiles = (ps: [number, number][]) => new Set(ps.map(([f]) => f).filter((f, i, a) => a.indexOf(f) !== i));
const isolatedFiles = (ps: [number, number][]) => {
  const has = new Set(ps.map(([f]) => f));
  return new Set([...has].filter((f) => !has.has(f - 1) && !has.has(f + 1)));
};
/** Tốt thông: không có tốt đối phương nào phía trước trên cùng cột hoặc cột kề. */
const passedFiles = (c: Chess, side: Side) => {
  const enemy = pawns(c, side === 'w' ? 'b' : 'w');
  return new Set(pawns(c, side).filter(([f, r]) => !enemy.some(([ef, er]) => Math.abs(ef - f) <= 1 && (side === 'w' ? er > r : er < r))).map(([f]) => f));
};
/** Mã/tượng còn ở ô xuất phát. */
export function undeveloped(c: Chess, side: Side): string[] {
  const r = side === 'w' ? '1' : '8';
  return [['b', 'n'], ['g', 'n'], ['c', 'b'], ['f', 'b']]
    .filter(([f, t]) => { const p = c.get((f + r) as Square); return p && p.color === side && p.type === t; })
    .map(([f]) => f + r);
}
const newIn = (after: Set<number>, before: Set<number>) => [...after].filter((f) => !before.has(f)).map((f) => FILES[f]);

/**
 * Nhận xét vị trí của nước `san` (đi từ `fenBefore`, `ply` = chỉ số nửa nước):
 * `good` là điểm cộng, `bad` là điểm trừ theo nguyên tắc (tốt chồng/cô lập, hàng tốt che vua, ra hậu sớm, mất nhập thành, mã biên…).
 */
export function positionalNotes(fenBefore: string, san: string, ply: number): { good: string[]; bad: string[] } {
  const before = new Chess(fenBefore);
  const c = new Chess(fenBefore);
  const m = c.move(san);
  const me = m.color as Side, good: string[] = [], bad: string[] = [];
  const pb = pawns(before, me), pa = pawns(c, me);
  for (const f of newIn(doubledFiles(pa), doubledFiles(pb))) bad.push(`tạo tốt chồng ở cột ${f}`);
  for (const f of newIn(isolatedFiles(pa), isolatedFiles(pb))) bad.push(`để tốt cột ${f} bị cô lập`);
  for (const f of newIn(passedFiles(c, me), passedFiles(before, me))) good.push(`có tốt thông ở cột ${f}`);
  // hàng tốt che vua đã nhập thành
  const king = before.findPiece({ type: 'k', color: me })[0] ?? '';
  const home = me === 'w' ? '2' : '7';
  const shield = king[0] === 'g' ? 'fgh' : king[0] === 'c' ? 'abc' : '';
  if (king[1] === (me === 'w' ? '1' : '8') && shield && m.piece === 'p' && shield.includes(m.from[0]) && m.from[1] === home) bad.push('làm yếu hàng tốt che vua');
  if (ply < 20) {
    const lazy = undeveloped(before, me).length;
    if (m.piece === 'q' && lazy >= 2) bad.push('đưa hậu ra sớm khi mã, tượng chưa ra');
    const rights = before.getCastlingRights(me);
    if (m.piece === 'k' && !m.flags.includes('k') && !m.flags.includes('q') && (rights.k || rights.q)) bad.push('đi vua làm mất quyền nhập thành');
    if (m.piece === 'n' && (m.to[0] === 'a' || m.to[0] === 'h')) bad.push('đưa mã ra biên, mã ở biên kiểm soát ít ô');
    if ((m.piece === 'n' || m.piece === 'b') && m.from[1] !== (me === 'w' ? '1' : '8') && !m.captured && lazy >= 2) bad.push('đi lại quân đã ra trong khi mã, tượng khác còn ở nhà');
  }
  return { good, bad };
}

/** Gợi ý kế hoạch cho lượt của `side` (khi không có gì gấp hơn): nhập thành, hoặc ra nốt quân nhẹ. */
export function planTip(fen: string, side: Side, ply: number): string | null {
  const c = new Chess(fen);
  if (c.inCheck()) return null;
  const rights = c.getCastlingRights(side);
  const king = c.findPiece({ type: 'k', color: side })[0] ?? '';
  const castled = king[1] === (side === 'w' ? '1' : '8') && (king[0] === 'g' || king[0] === 'c');
  const lazy = undeveloped(c, side);
  if (!castled && (rights.k || rights.q) && ply >= 8 && lazy.length <= 2) return 'Kế hoạch: nhập thành để vua an toàn.';
  if (ply >= 6 && lazy.length >= 2) return `Kế hoạch: ra nốt quân nhẹ còn ở ${lazy.join(', ')}.`;
  return null;
}
