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
