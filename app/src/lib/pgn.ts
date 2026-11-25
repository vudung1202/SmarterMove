import { Chess } from 'chess.js';
import type { Boss } from '../bosses.ts';
import type { GameRecord } from './progress.ts';

/** Kết quả PGN theo bên Trắng/Đen. */
function pgnResult(g: GameRecord) {
  if (g.result === 'draw') return '1/2-1/2';
  const whiteWon = (g.result === 'win') === (g.color === 'w');
  return whiteWon ? '1-0' : '0-1';
}

/** Một ván ra PGN chuẩn (mở được trong Lichess/Chess.com để phân tích tiếp). */
export function toPgn(g: GameRecord, boss: Boss): string {
  const c = new Chess();
  for (const san of g.sans) c.move(san);
  const d = new Date(g.endedAt);
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const bot = `${boss.name} (Nước Hay, ~${boss.elo})`;
  c.setHeader('Event', 'Nước Hay');
  c.setHeader('Site', 'Nước Hay');
  c.setHeader('Date', date);
  c.setHeader('White', g.color === 'w' ? 'Bạn' : bot);
  c.setHeader('Black', g.color === 'b' ? 'Bạn' : bot);
  c.setHeader('Result', pgnResult(g));
  c.setHeader('Termination', g.reason);
  // chess.js chỉ ghi kết quả cuối khi ván kết thúc theo luật; bỏ ván / hòa thỏa thuận thì thêm tay
  const body = c.pgn();
  return body.trimEnd().endsWith(pgnResult(g)) ? body : `${body} ${pgnResult(g)}`;
}

/** Nhiều ván, cách nhau một dòng trống. */
export const gamesToPgn = (games: GameRecord[], bossOf: (id: string) => Boss) => games.map((g) => toPgn(g, bossOf(g.bossId))).join('\n\n') + '\n';
