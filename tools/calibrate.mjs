// Hiệu chỉnh độ khó: cho các boss liền kề tự đấu với nhau, đổi màu quân xen kẽ, dùng đúng cấu hình trong app/src/bosses.ts.
// Chạy: node tools/calibrate.mjs [số ván mỗi cặp, mặc định 20]  →  in bảng và ghi docs/calibration.md
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Chess } from '../app/node_modules/chess.js/dist/esm/chess.js';
import { BOSSES } from '../app/src/bosses.ts';

const N = Number(process.argv[2] ?? 20);
const ENGINE = new URL('./vendor/stockfish-19-lite-single.js', import.meta.url).pathname;
// Khai cuộc mở đầu xoay vòng để các ván khác nhau (4 nửa nước, đều phổ biến)
const OPENINGS = [[], ['e4', 'e5'], ['d4', 'd5'], ['e4', 'c5'], ['d4', 'Nf6', 'c4', 'e6'], ['e4', 'e6', 'd4', 'd5'], ['c4', 'e5'], ['Nf3', 'd5'], ['e4', 'c6'], ['d4', 'Nf6', 'c4', 'g6']];

class Uci {
  constructor(boss) {
    this.boss = boss;
    this.p = spawn('node', [ENGINE]);
    this.buf = '';
    this.wait = null;
    this.p.stdout.on('data', (d) => {
      this.buf += d;
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const l = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        if (this.wait && l.startsWith('bestmove')) { const w = this.wait; this.wait = null; w(l.split(' ')[1]); }
      }
    });
    this.send('uci');
    for (const [k, v] of Object.entries(boss.options)) this.send(`setoption name ${k} value ${v}`);
  }
  send(c) { this.p.stdin.write(c + '\n'); }
  move(fen) {
    // giống app: với xác suất `blunder` boss đi một nước hợp lệ ngẫu nhiên thay vì hỏi engine
    if (Math.random() < (this.boss.blunder ?? 0)) { const ms = new Chess(fen).moves({ verbose: true }); const m = ms[Math.floor(Math.random() * ms.length)]; return Promise.resolve(m.from + m.to + (m.promotion ?? '')); }
    return new Promise((r) => { this.wait = r; this.send(`position fen ${fen}`); this.send(`go ${this.boss.go}`); });
  }
  newGame() { this.send('ucinewgame'); }
  quit() { this.send('quit'); }
}

/** 1 = Trắng thắng, 0 = Đen thắng, 0.5 = hòa (kể cả quá 200 nửa nước). */
async function play(white, black, opening) {
  const c = new Chess();
  opening.forEach((s) => c.move(s));
  white.newGame(); black.newGame();
  while (!c.isGameOver() && c.history().length < 200) {
    const best = await (c.turn() === 'w' ? white : black).move(c.fen());
    c.move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] });
  }
  return c.isCheckmate() ? (c.turn() === 'w' ? 0 : 1) : 0.5;
}

async function match(weak, strong) {
  const a = new Uci(weak), b = new Uci(strong);
  let score = 0, w = 0, d = 0, l = 0; // theo boss mạnh hơn
  for (let i = 0; i < N; i++) {
    const opening = OPENINGS[Math.floor(i / 2) % OPENINGS.length];
    const strongWhite = i % 2 === 0;
    const r = strongWhite ? await play(b, a, opening) : 1 - (await play(a, b, opening));
    score += r; r === 1 ? w++ : r === 0 ? l++ : d++;
  }
  a.quit(); b.quit();
  const p = Math.min(Math.max(score / N, 0.5 / N), 1 - 0.5 / N);
  return { pair: `${strong.name} – ${weak.name}`, w, d, l, pct: Math.round((score / N) * 100), elo: Math.round(-400 * Math.log10(1 / p - 1)) };
}

const t0 = Date.now();
// PAIRS=1,2 chỉ đo các cặp có boss mạnh ở vị trí 1 và 2 (đánh số từ 0)
const only = process.env.PAIRS?.split(',').map(Number);
const rows = await Promise.all(BOSSES.slice(1).map((b, i) => [BOSSES[i], b, i + 1]).filter(([, , k]) => !only || only.includes(k)).map(([w, b]) => match(w, b)));
const table = ['| Cặp (mạnh – yếu) | Thắng | Hòa | Thua | Điểm của boss mạnh | Chênh Elo ước tính |', '|---|---:|---:|---:|---:|---:|',
  ...rows.map((r) => `| ${r.pair} | ${r.w} | ${r.d} | ${r.l} | ${r.pct}% | ${r.elo > 0 ? '+' : ''}${r.elo} |`)].join('\n');
console.log(table);
console.log(`(${N} ván mỗi cặp, ${Math.round((Date.now() - t0) / 1000)} giây)`);
const cfg = BOSSES.map((b) => `| ${b.name} | ${b.elo} | \`${Object.entries(b.options).map(([k, v]) => `${k}=${v}`).join(', ')}\` | \`go ${b.go}\` | ${Math.round((b.blunder ?? 0) * 100)}% |`).join('\n');
// Đo một phần (PAIRS) thì chỉ in ra, không ghi đè bảng đầy đủ trong docs — gộp tay vào docs/calibration.md
if (!only) writeFileSync(new URL('../docs/calibration.md', import.meta.url), `# Hiệu chỉnh độ khó boss

Sinh bởi \`node tools/calibrate.mjs ${N}\`. Các boss liền kề tự đấu ${N} ván mỗi cặp, đổi màu xen kẽ, khai cuộc xoay vòng ${OPENINGS.length} biến.
Mục tiêu: boss mạnh hơn được 80–95% điểm (chênh ≈ 250–500 Elo). Chạy trên Mac, nơi giới hạn depth đến trước giới hạn thời gian;
trên iPhone, Xe Sắt có thể chạm trần 900 ms trước khi tới depth 14, nên yếu hơn một chút.

${table}

Cấu hình đã đo:

| Boss | Elo mục tiêu | setoption | Lệnh go | Nước ngẫu nhiên |
|---|---:|---|---|---:|
${cfg}

Giới hạn: chỉ đo được độ chênh giữa các boss. Elo tuyệt đối vẫn là ước lượng, cần người thật chơi nhiều ván mới đo được.
`);
