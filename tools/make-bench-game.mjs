// Sinh ván mẫu 80 nửa nước (Stockfish tự chơi, Skill 8) cho trang đo review. Chạy: node tools/make-bench-game.mjs
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Chess } from './vendor/chess.mjs';

const p = spawn('node', [new URL('./vendor/stockfish-19-lite-single.js', import.meta.url).pathname]);
let buf = '', waiter = null;
p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (waiter && l.startsWith('bestmove')) { const w = waiter; waiter = null; w(l.split(' ')[1]); } } });
const send = (c) => p.stdin.write(c + '\n');
send('uci'); send('setoption name Skill Level value 8');
const c = new Chess();
while (c.history().length < 80) {
  send(`position fen ${c.fen()}`); send('go movetime 80');
  const best = await new Promise((r) => (waiter = r));
  c.move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] });
  if (c.isGameOver()) { console.log('hết ván sớm, chạy lại'); process.exit(1); }
}
send('quit');
writeFileSync(new URL('../app/src/bench/sample-game.ts', import.meta.url), `// Sinh bởi tools/make-bench-game.mjs — 80 nửa nước, dùng để đo tốc độ review\nexport const SAMPLE_GAME: string[] = ${JSON.stringify(c.history())};\n`);
console.log(c.history().join(' '));
