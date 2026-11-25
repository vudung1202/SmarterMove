// Sinh dữ liệu mẫu THẬT cho prototype: 2 ván do Stockfish 19 lite tự chơi + phân tích từng nước.
// Chạy: node tools/make-sample.mjs  →  ghi prototype/data.js
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Chess } from './vendor/chess.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const ENGINE = here('./vendor/stockfish-19-lite-single.js');

class Engine {
  constructor(options = {}) {
    this.p = spawn('node', [ENGINE]);
    this.buf = '';
    this.listeners = [];
    this.p.stdout.on('data', (d) => {
      this.buf += d;
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        this.listeners.forEach((f) => f(line));
      }
    });
    this.send('uci');
    for (const [k, v] of Object.entries(options)) this.send(`setoption name ${k} value ${v}`);
  }
  send(c) { this.p.stdin.write(c + '\n'); }
  until(test) {
    return new Promise((res) => {
      const f = (l) => { if (test(l)) { this.listeners = this.listeners.filter((x) => x !== f); res(l); } };
      this.listeners.push(f);
    });
  }
  async ready() { this.send('isready'); await this.until((l) => l === 'readyok'); }
  // Trả về { cp | mate } theo góc nhìn bên đang đi, bestmove, pv (uci)
  async go(fen, limit) {
    await this.ready();
    let last = null;
    const f = (l) => { if (l.startsWith('info') && l.includes(' pv ') && !l.includes('multipv 2')) last = l; };
    this.listeners.push(f);
    this.send(`position fen ${fen}`);
    this.send(`go ${limit}`);
    const done = await this.until((l) => l.startsWith('bestmove'));
    this.listeners = this.listeners.filter((x) => x !== f);
    const best = done.split(' ')[1];
    if (!last) return { best, pv: [best], cp: 0 };
    const m = last.match(/score (cp|mate) (-?\d+)/);
    const pv = last.split(' pv ')[1].split(' ');
    return { best, pv, [m[1]]: Number(m[2]) };
  }
  quit() { this.send('quit'); }
}

const uciMove = (u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
const sanOf = (fen, u) => new Chess(fen).move(uciMove(u)).san;
const sanLine = (fen, pv, n) => { const c = new Chess(fen); return pv.slice(0, n).map((u) => c.move(uciMove(u)).san); };
// Đổi điểm engine (góc bên đi) sang pawn góc Trắng; chiếu hết kẹp ±10, giữ số nước chiếu hết riêng
const toWhite = (r, whiteToMove) => {
  const s = whiteToMove ? 1 : -1;
  if (r.mate != null) return { pawns: s * Math.sign(r.mate || -1) * 10, mate: s * r.mate };
  return { pawns: Math.max(-10, Math.min(10, (s * r.cp) / 100)), mate: null };
};
// Công thức winning chances của Lichess, thang −1..1
const wc = (pawns) => 2 / (1 + Math.exp(-0.368208 * pawns)) - 1;
const judge = (drop) => (drop >= 0.3 ? 'loi-lon' : drop >= 0.2 ? 'sai-lam' : drop >= 0.1 ? 'chua-chinh-xac' : null);
const PIECE = { p: 'tốt', n: 'mã', b: 'tượng', r: 'xe', q: 'hậu', k: 'vua' };

async function playGame(white, black, maxPlies, stopAt) {
  const c = new Chess();
  while (!c.isGameOver() && c.history().length < maxPlies) {
    if (stopAt && c.history().length === stopAt) break;
    const e = c.turn() === 'w' ? white : black;
    const r = await e.go(c.fen(), 'movetime 60');
    c.move(uciMove(r.best));
  }
  return c;
}

async function analyseGame(an, sans) {
  const c = new Chess();
  const plies = [];
  let before = await an.go(c.fen(), 'depth 14');
  let evalBefore = toWhite(before, true);
  const start = evalBefore;
  for (const san of sans) {
    const fenBefore = c.fen();
    const whiteMoved = c.turn() === 'w';
    const mv = c.move(san);
    const over = c.isCheckmate() ? { pawns: whiteMoved ? 10 : -10, mate: 0 } : c.isDraw() ? { pawns: 0, mate: null } : null;
    const after = over ? null : await an.go(c.fen(), 'depth 14');
    const evalAfter = over || toWhite(after, !whiteMoved);
    const s = whiteMoved ? 1 : -1;
    const drop = Math.max(0, s * (wc(evalBefore.pawns) - wc(evalAfter.pawns)));
    plies.push({
      san, uci: mv.from + mv.to + (mv.promotion || ''), fenBefore, fenAfter: c.fen(),
      evalAfter: +evalAfter.pawns.toFixed(2), mateAfter: evalAfter.mate,
      bestUci: before.best, bestSan: sanOf(fenBefore, before.best),
      bestLine: sanLine(fenBefore, before.pv, 4),
      replyLine: after ? sanLine(c.fen(), after.pv, 3) : [],
      drop: +drop.toFixed(3), judgement: mv.san === sanOf(fenBefore, before.best) ? null : judge(drop),
      captured: mv.captured || null,
    });
    before = after;
    evalBefore = evalAfter;
  }
  return { startEval: +start.pawns.toFixed(2), plies };
}

// Mọi nước hợp lệ ở một thế cờ: eval sau nước (góc bên đi) + nước đáp tốt nhất của đối thủ
async function allMoves(an, fen) {
  const c = new Chess(fen);
  const mover = c.turn();
  const out = [];
  for (const m of c.moves({ verbose: true })) {
    const d = new Chess(fen); d.move(m);
    let pawns, mate = null, reply = null, replySan = null, replyCaptures = null;
    if (d.isCheckmate()) { pawns = 10; mate = 0; }
    else if (d.isDraw()) pawns = 0;
    else {
      const r = await an.go(d.fen(), 'depth 11');
      const w = toWhite(r, d.turn() === 'w');
      pawns = mover === 'w' ? w.pawns : -w.pawns;
      mate = w.mate == null ? null : (mover === 'w' ? w.mate : -w.mate);
      reply = r.best;
      const rm = new Chess(d.fen()).move(uciMove(r.best));
      replySan = rm.san; replyCaptures = rm.captured || null;
    }
    out.push({ san: m.san, from: m.from, to: m.to, promotion: m.promotion || null, eval: +pawns.toFixed(2), mate, reply, replySan, replyCaptures });
  }
  out.sort((a, b) => b.eval - a.eval);
  const best = out[0].eval;
  for (const m of out) m.judgement = m === out[0] ? null : judge(wc(best) - wc(m.eval));
  return out;
}

const analysis = new Engine({ Hash: 32 });
const player = () => new Engine({ 'Skill Level': 0 });

// Ván A: người chơi (Trắng, Skill 0) thua Tượng Gỗ (UCI_Elo 1400). Lấy ván đầu tiên Đen thắng, 25–45 nước.
let gameA;
for (let i = 0; i < 30 && !gameA; i++) {
  const w = player(), b = new Engine({ UCI_LimitStrength: 'true', UCI_Elo: 1400 });
  const c = await playGame(w, b, 110);
  w.quit(); b.quit();
  const n = Math.ceil(c.history().length / 2);
  console.log(`thử ván A #${i + 1}: ${c.isCheckmate() ? 'chiếu hết' : 'khác'} ${c.turn() === 'w' ? '0-1' : '1-0'} ${n} nước`);
  if (c.isCheckmate() && c.turn() === 'w' && n >= 22 && n <= 50) gameA = c.history();
}
if (!gameA) throw new Error('Không sinh được ván A phù hợp');
const reviewA = await analyseGame(analysis, gameA);
// 3 khoảnh khắc: 3 nước của Trắng mất nhiều winning chances nhất
const moments = reviewA.plies
  .map((p, i) => ({ ...p, ply: i }))
  .filter((p) => p.ply % 2 === 0 && p.judgement)
  .sort((a, b) => b.drop - a.drop).slice(0, 3)
  .sort((a, b) => a.ply - b.ply);
for (const m of moments) m.moves = await allMoves(analysis, m.fenBefore);

// Ván B: đang dở với Mã Non (Skill 3), dừng ở lượt Trắng nước 14.
// Chọn thế cờ còn cân bằng (|eval| ≤ 1) và có ≥ 3 nước hợp lệ là lỗi lớn, để demo được nhắc lỗi.
let positionB, evalB;
for (let i = 0; i < 20 && !positionB; i++) {
  const w = new Engine({ 'Skill Level': 4 }), b = new Engine({ 'Skill Level': 3 });
  const c = await playGame(w, b, 200, 26);
  w.quit(); b.quit();
  if (c.isGameOver()) continue;
  const e = toWhite(await analysis.go(c.fen(), 'depth 14'), true);
  console.log(`thử ván B #${i + 1}: eval ${e.pawns}`);
  if (Math.abs(e.pawns) > 1) continue;
  const moves = await allMoves(analysis, c.fen());
  if (moves.filter((m) => m.judgement === 'loi-lon').length < 3) continue;
  positionB = { sans: c.history(), fen: c.fen(), moves };
  evalB = e;
}
if (!positionB) throw new Error('Không sinh được ván B phù hợp');
const gameB = positionB.sans;
analysis.quit();

const data = {
  generated: 'Stockfish 19 lite (WASM, đơn luồng), depth 14 cho phân tích ván, depth 11 cho từng nước hợp lệ',
  gameA: { sans: gameA, ...reviewA, moments: moments.map((m) => m.ply), momentMoves: Object.fromEntries(moments.map((m) => [m.ply, m.moves])) },
  gameB: { ...positionB, eval: evalB },
};
writeFileSync(here('../prototype/data.js'), `// Sinh bởi tools/make-sample.mjs — không sửa tay\nwindow.ENGINE_DATA = ${JSON.stringify(data)};\n`);
console.log('A:', gameA.length, 'ply; khoảnh khắc:', moments.map((m) => `${m.ply} ${m.san} (${m.judgement}, best ${m.bestSan})`).join(' | '));
console.log('B:', gameB.join(' '), '| eval', evalB, '| best', positionB.moves[0].san, positionB.moves.length, 'nước hợp lệ');
console.log('B blunders:', positionB.moves.filter((m) => m.judgement === 'loi-lon').length);
