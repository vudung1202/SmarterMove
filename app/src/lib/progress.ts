import type { Boss } from '../bosses.ts';
import type { Color, Grade } from './saved-game.ts';

export type Result = 'win' | 'draw' | 'loss';
/** Một ván đã kết thúc, lưu trong lịch sử (IndexedDB). */
export interface GameRecord {
  id: string;
  bossId: string;
  color: Color;
  sans: string[];
  grades: Record<number, Grade>;
  result: Result;
  reason: string;
  endedAt: string; // ISO
}

/** Luật lên cấp: thắng ít nhất WINS trong WINDOW ván gần nhất với boss đó. */
export const PROMOTE = { wins: 3, window: 5 };

/** `games` xếp mới nhất trước. */
export function record(games: GameRecord[], bossId: string) {
  const g = games.filter((x) => x.bossId === bossId);
  return { games: g.length, win: g.filter((x) => x.result === 'win').length, draw: g.filter((x) => x.result === 'draw').length, loss: g.filter((x) => x.result === 'loss').length };
}

export const recent = (games: GameRecord[], bossId: string) => games.filter((x) => x.bossId === bossId).slice(0, PROMOTE.window);
export const recentWins = (games: GameRecord[], bossId: string) => recent(games, bossId).filter((x) => x.result === 'win').length;
export const passed = (games: GameRecord[], bossId: string) => recentWins(games, bossId) >= PROMOTE.wins;

/** Boss đề xuất: boss thấp nhất chưa đạt luật lên cấp (đạt hết thì boss cao nhất). */
export const recommended = (games: GameRecord[], bosses: Boss[]) => bosses.find((b) => !passed(games, b.id)) ?? bosses[bosses.length - 1];
