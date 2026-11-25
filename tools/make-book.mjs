// Sinh app/src/data/book.ts từ lichess-org/chess-openings (CC0): mọi thế cờ nằm trong các biến khai cuộc có tên.
// Chạy: node tools/make-book.mjs   (cần mạng tới raw.githubusercontent.com)
import { writeFileSync } from 'node:fs';
import { Chess } from '../app/node_modules/chess.js/dist/esm/chess.js';
import { bookKey } from '../app/src/lib/book-key.ts';

const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/';
const lines = [];
for (const f of 'abcde') {
  const tsv = await (await fetch(BASE + f + '.tsv')).text();
  for (const row of tsv.trim().split('\n').slice(1)) {
    const [, name, pgn] = row.split('\t');
    lines.push({ name, sans: pgn.replace(/\d+\.\s*/g, '').trim().split(/\s+/) });
  }
}
// Thế cờ cuối của mỗi biến mang tên biến đó; thế cờ giữa chừng lấy tên biến ngắn nhất đi qua nó.
const book = new Map();
lines.sort((a, b) => a.sans.length - b.sans.length);
for (const { name, sans } of lines) {
  const c = new Chess();
  sans.forEach((san, i) => {
    c.move(san);
    const k = bookKey(c.fen());
    if (i === sans.length - 1) book.set(k, name);
    else if (!book.has(k)) book.set(k, name);
  });
}
const names = [...new Set(book.values())];
const index = Object.fromEntries([...book].map(([k, n]) => [k, names.indexOf(n)]));
const out = `// Sinh bởi tools/make-book.mjs từ lichess-org/chess-openings (CC0). ${lines.length} biến, ${book.size} thế cờ.\n// KEYS: bookKey(fen) → chỉ số trong NAMES (tên khai cuộc)\nexport const NAMES: string[] = ${JSON.stringify(names)};\nexport const KEYS: Record<string, number> = ${JSON.stringify(index)};\n`;
writeFileSync(new URL('../app/src/data/book.ts', import.meta.url), out);
console.log(lines.length, 'biến,', book.size, 'thế cờ,', Math.round(out.length / 1024), 'KB');
