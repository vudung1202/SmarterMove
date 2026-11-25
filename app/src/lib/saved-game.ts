import { Chess } from 'chess.js';
import type { MoveClass } from './coach.ts';
import type { Result } from './progress.ts';

export type Color = 'w' | 'b';
/** Đánh giá một nước của người chơi; text = hậu quả + nước tốt hơn (chỉ với nước kém) */
export interface Grade { cls: MoveClass; text: string | null }

/** Ván đang chơi, lưu sau mỗi nước. grades: khóa = chỉ số nửa nước. over: câu kết thúc ('' = chưa xong). */
export interface SavedGame { v: 1; id: string; bossId: string; color: Color; sans: string[]; grades: Record<number, Grade>; over: string; result?: Result }

const KEY = 'nuoc-hay:game';

/** Đọc ván đã lưu; dựng lại bằng chess.js nên dữ liệu hỏng hoặc nước sai sẽ bị bỏ (trả null). */
export function parseSaved(raw: string | null): (SavedGame & { game: Chess }) | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<SavedGame>;
    if (s.v !== 1 || typeof s.bossId !== 'string' || (s.color !== 'w' && s.color !== 'b') || !Array.isArray(s.sans)) return null;
    const game = new Chess();
    for (const san of s.sans) game.move(san); // ném lỗi nếu nước không hợp lệ
    // ván lưu từ Mốc 2 chưa có id
    return { v: 1, id: s.id ?? newId(), bossId: s.bossId, color: s.color, sans: s.sans, grades: s.grades ?? {}, over: s.over ?? '', result: s.result, game };
  } catch {
    return null;
  }
}

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Ván đang chơi (với bất kỳ boss nào), hoặc null. */
export const loadGame = () => parseSaved(localStorage.getItem(KEY));

/** Bắt đầu ván mới (thay ván đang lưu). */
export function startGame(bossId: string, color: Color): SavedGame {
  const s: SavedGame = { v: 1, id: newId(), bossId, color, sans: [], grades: {}, over: '' };
  saveGame(s);
  return s;
}

export function saveGame(s: SavedGame) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Safari riêng tư hoặc hết dung lượng: vẫn chơi được, chỉ không lưu
  }
}
