import { bookKey } from './book-key.ts';

let data: Promise<typeof import('../data/book.ts')> | null = null;

/** Tên khai cuộc nếu thế cờ nằm trong sách (lichess-org/chess-openings), ngược lại null. Lần đầu tải dữ liệu sách (~80 KB gzip). */
export async function bookName(fen: string): Promise<string | null> {
  data ??= import('../data/book.ts');
  const { KEYS, NAMES } = await data;
  const i = KEYS[bookKey(fen)];
  return i == null ? null : NAMES[i];
}
