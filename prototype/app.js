import { Chess } from './vendor/chess.js';

const E = window.ENGINE_DATA;
const A = window.APP_DATA;
const canvas = document.getElementById('canvas');
const MINUS = '\u2212';
const nf1 = new Intl.NumberFormat('vi', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('vi');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- định dạng ----------
// Ký hiệu nước theo tiếng Việt: V(ua) H(ậu) X(e) T(ượng) M(ã); tốt không có chữ.
const vi = (san) => san.replace(/[KQRBN]/g, (c) => ({ K: 'V', Q: 'H', R: 'X', B: 'T', N: 'M' })[c]);
const PIECE = { p: 'tốt', n: 'mã', b: 'tượng', r: 'xe', q: 'hậu', k: 'vua' };
const signed = (p) => (p > 0.05 ? '+' : p < -0.05 ? MINUS : '') + nf1.format(Math.abs(p));
const fmtEval = (p, mate) => (mate != null && mate !== 0 ? `${mate > 0 ? '+' : MINUS}M${Math.abs(mate)}` : signed(p));
const moveNo = (ply) => Math.floor(ply / 2) + 1;
const bossOf = (id) => A.bosses.find((b) => b.id === id);
const eloText = (b) => `khoảng ${nf0.format(b.elo)} Elo`;
const dayText = (iso) => {
  const d = (Date.parse(A.today) - Date.parse(iso)) / 864e5;
  return d === 0 ? 'Hôm nay' : d === 1 ? 'Hôm qua' : `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};
const JUDGE = { 'loi-lon': ['Lỗi lớn', '??'], 'sai-lam': ['Sai lầm', '?'], 'chua-chinh-xac': ['Chưa chính xác', '?!'] };

// ---------- dữ liệu suy ra (không gõ tay tổng) ----------
const params = () => new URLSearchParams(location.hash.split('?')[1] || '');
const demo = () => params().get('demo');
const history = () => (demo() === 'empty' ? [] : A.history);
function record(bossId) {
  const g = history().filter((h) => h.boss === bossId);
  return { games: g.length, win: g.filter((h) => h.result === 'win').length, draw: g.filter((h) => h.result === 'draw').length, loss: g.filter((h) => h.result === 'loss').length };
}
const recent = (bossId) => history().filter((h) => h.boss === bossId).slice(0, A.promote.window);
const recentWins = (bossId) => recent(bossId).filter((h) => h.result === 'win').length;
const passed = (bossId) => recentWins(bossId) >= A.promote.wins;
const recommended = () => A.bosses.find((b) => !passed(b.id)) || A.bosses.at(-1);
console.assert(A.bosses.reduce((n, b) => n + record(b.id).games, 0) === A.history.length, 'thành tích phải cộng đủ số ván');
console.assert(A.history.find((h) => h.id === 'a').moves === Math.ceil(E.gameA.sans.length / 2), 'số nước ván A khớp dữ liệu engine');

// ---------- bàn cờ ----------
const FILES = 'abcdefgh';
function boardHTML(fen, o = {}) {
  const c = new Chess(fen);
  const grid = c.board();
  const marks = o.marks || {};
  const inCheck = c.inCheck() ? c.findPiece({ type: 'k', color: c.turn() })[0] : null;
  let cells = '';
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const sq = FILES[f] + (8 - r);
    const p = grid[r][f];
    const cls = ['sq', (r + f) % 2 ? 'dark' : 'light', ...(marks[sq] || [])];
    if (sq === inCheck) cls.push('check');
    const label = p ? `${sq}, ${PIECE[p.type]} ${p.color === 'w' ? 'trắng' : 'đen'}` : sq;
    const coords = o.coords === false ? '' : (r === 7 ? `<span class="coord file">${FILES[f]}</span>` : '') + (f === 0 ? `<span class="coord rank">${8 - r}</span>` : '');
    const piece = p ? `<img src="pieces/${p.color}${p.type.toUpperCase()}.svg" alt="">` : '';
    cells += o.interactive
      ? `<button type="button" class="${cls.join(' ')}" data-sq="${sq}" aria-label="${label}">${coords}${piece}</button>`
      : `<div class="${cls.join(' ')}">${coords}${piece}</div>`;
  }
  const arrows = (o.arrows || []).map(arrowSVG).join('');
  return `<div class="board${o.small ? ' small' : ''}" role="${o.interactive ? 'grid' : 'img'}" aria-label="${esc(o.label || 'Bàn cờ')}">${cells}<svg class="arrows" viewBox="0 0 8 8" aria-hidden="true">${arrows}</svg></div>`;
}
function arrowSVG({ from, to, kind }) {
  const xy = (sq) => [FILES.indexOf(sq[0]) + 0.5, 8 - Number(sq[1]) + 0.5];
  const [x1, y1] = xy(from), [x2, y2] = xy(to);
  const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const hx = x2 - ux * 0.42, hy = y2 - uy * 0.42; // gốc đầu mũi tên
  const head = `${x2 - ux * 0.08},${y2 - uy * 0.08} ${hx - uy * 0.24},${hy + ux * 0.24} ${hx + uy * 0.24},${hy - ux * 0.24}`;
  return `<g class="arrow ${kind}"><line x1="${x1 + ux * 0.2}" y1="${y1 + uy * 0.2}" x2="${hx}" y2="${hy}" stroke-width="0.17" stroke-linecap="round"/><polygon points="${head}"/></g>`;
}

// ---------- điều hướng ----------
function route() {
  const path = location.hash.replace(/^#/, '').split('?')[0] || '/';
  const name = path.startsWith('/play') ? 'play' : path.startsWith('/review') ? 'review' : 'home';
  document.body.dataset.route = name;
  document.querySelectorAll('.rail .nav').forEach((a) => a.toggleAttribute('aria-current', a.dataset.route === (name === 'play' ? 'home' : name)));
  document.querySelectorAll('.rail .nav[aria-current]').forEach((a) => a.setAttribute('aria-current', 'page'));
  ({ home, play, review })[name]();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

// ---------- màn 1: chọn boss ----------
function home() {
  const rec = recommended();
  const idx = A.bosses.indexOf(rec);
  const prev = A.bosses[idx - 1];
  const need = A.promote.wins - recentWins(rec.id);
  const finding = !history().length
    ? `Chưa có ván nào. Bắt đầu với ${rec.name}, đối thủ dễ nhất.`
    : `${prev ? `Bạn thắng ${prev.name} ${recentWins(prev.id)}/${recent(prev.id).length} ván gần nhất. ` : ''}Với ${rec.name}, thắng thêm ${need} ván nữa là lên cấp.`;
  const un = demo() === 'empty' ? null : A.unfinished;
  const unBoss = un && bossOf(un.boss);
  const B = E.gameB;

  const bossCard = (b) => {
    const r = record(b.id), isRec = b === rec;
    const n = (v, w) => `<span class="${v ? '' : 'zero'}"><b class="num">${v}</b> ${w}</span>`;
    return `<article class="boss${isRec ? ' is-rec' : ''}">
      <div class="boss-top"><div class="avatar"><img src="pieces/${b.piece}.svg" alt=""></div>${isRec ? '<span class="pill">Nên đấu</span>' : passed(b.id) ? '<span class="pill">Đã qua</span>' : ''}</div>
      <h3>${b.name}</h3>
      <p class="elo num">${eloText(b)}</p>
      <p class="style">${b.style}</p>
      <p class="tally">${r.games ? `${n(r.win, 'thắng')}${n(r.draw, 'hòa')}${n(r.loss, 'thua')}` : '<span class="zero">Chưa đấu ván nào</span>'}</p>
      <button type="button" class="btn ${isRec ? 'primary' : 'secondary'}" data-start="${b.id}">${isRec ? `Đấu với ${b.name}` : 'Đấu'}</button>
    </article>`;
  };

  const rows = history().slice(0, 5).map((h) => {
    const b = bossOf(h.boss);
    const res = { win: ['Thắng', 'win'], draw: ['Hòa', 'draw'], loss: ['Thua', 'loss'] }[h.result];
    return `<tr>
      <td>${dayText(h.date)}</td>
      <td><span class="who"><span class="avatar xs"><img src="pieces/${b.piece}.svg" alt=""></span>${b.name}</span></td>
      <td class="hide-sm">${h.color === 'w' ? 'Trắng' : 'Đen'}</td>
      <td class="res ${res[1]}">${res[0]}</td>
      <td class="n num">${h.moves}</td>
      <td class="act"><a class="card-link" href="#/review">Xem lại</a></td>
    </tr>`;
  }).join('');

  const ladder = A.bosses.map((b) => {
    const r = recent(b.id), w = recentWins(b.id);
    const pct = Math.min(1, w / A.promote.wins) * 100;
    const right = !r.length ? '<span class="zero">—</span>' : passed(b.id) ? `<span class="num">${w}/${r.length}</span> đã qua` : `<span class="num">${w}/${A.promote.wins}</span> ván thắng`;
    return `<li class="ladder-row"><div class="ladder-line"><span>${b.name}</span><span class="ladder-val">${right}</span></div>
      <div class="track" role="img" aria-label="${b.name}: thắng ${w} trong ${r.length} ván gần nhất"><span style="width:${pct}%"></span></div></li>`;
  }).join('');

  canvas.innerHTML = `<div class="page home">
    <header class="title-row"><div><h1>Chọn đối thủ</h1><p class="sub">${finding}</p></div></header>
    ${un ? `<section class="panel resume" aria-labelledby="resume-h">
      ${boardHTML(B.fen, { small: true, coords: false, label: `Thế cờ ván đang dở với ${unBoss.name}` })}
      <div class="resume-text"><h2 id="resume-h">Ván đang dở với ${unBoss.name}</h2>
        <p class="muted">Nước ${moveNo(B.sans.length)}, lượt bạn, bạn cầm ${un.color === 'w' ? 'Trắng' : 'Đen'}. Lưu ${dayText(un.savedAt.slice(0, 10)).toLowerCase()} lúc ${un.savedAt.slice(11)}.</p></div>
      <a class="btn secondary" href="#/play">Tiếp tục ván</a>
    </section>` : ''}
    <section class="bosses-sec" aria-labelledby="bosses-h">
      <h2 id="bosses-h" class="sec-h">Bốn boss, từ dễ đến khó</h2>
      <div class="bosses">${A.bosses.map(bossCard).join('')}</div>
    </section>
    <div class="grid lower">
      <section class="panel recent${history().length ? '' : ' full'}">
        <header><h2>Ván gần đây</h2>${history().length ? `<span class="meta num">${history().length} ván</span>` : ''}</header>
        ${history().length ? `<div class="table-wrap"><table>
          <thead><tr><th>Ngày</th><th>Đối thủ</th><th class="hide-sm">Quân</th><th>Kết quả</th><th class="n">Số nước</th><th><span class="sr">Hành động</span></th></tr></thead>
          <tbody>${rows}</tbody></table></div>` : `<p class="empty">Chưa có ván nào. Thắng ${A.promote.wins} trong ${A.promote.window} ván với một boss để mở boss tiếp theo.</p>`}
      </section>
      ${history().length ? `<section class="panel ladder">
        <header><h2>Tiến độ lên cấp</h2></header>
        <p class="muted ladder-rule">Thắng ${A.promote.wins} trong ${A.promote.window} ván gần nhất để mở boss tiếp theo.</p>
        <ol class="ladder-list">${ladder}</ol>
        <p class="ladder-total">Đã mở <b class="num">${A.bosses.indexOf(rec) + 1}/${A.bosses.length}</b> boss</p>
      </section>` : ''}
    </div>
    <p class="credit">Quân cờ: bộ cburnett của Colin M.L. Burnett, CC BY-SA 3.0. Phân tích: Stockfish 19, GPLv3.</p>
  </div>`;
  canvas.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => openStart(bossOf(b.dataset.start))));
}

const dlg = document.getElementById('start');
function openStart(b) {
  dlg.querySelector('#start-title').textContent = `Đấu với ${b.name}`;
  dlg.querySelector('[data-slot="piece"]').src = `pieces/${b.piece}.svg`;
  dlg.querySelector('[data-slot="style"]').textContent = `${eloText(b)}. ${b.style}`;
  dlg.showModal();
}
dlg.querySelectorAll('.segmented button').forEach((btn) => btn.addEventListener('click', () => {
  dlg.querySelectorAll('.segmented button').forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
}));
dlg.addEventListener('close', () => {
  // shortcut: prototype chỉ có một thế cờ mẫu nên mọi boss đều mở ván B; app thật tạo ván mới theo boss + màu đã chọn.
  if (dlg.returnValue === 'start') location.hash = `#/play?alert=${dlg.querySelector('[name=alert]').checked ? 1 : 0}`;
});

// ---------- màn 2: đấu (ván đang dở) và thử lại (từ review) ----------
let S = null;
function play() {
  const p = params();
  const retry = p.has('retry') ? Number(p.get('retry')) : null;
  if (retry != null) {
    const ply = E.gameA.plies[retry];
    S = { mode: 'retry', ply: retry, boss: bossOf('tuong-go'), fen: ply.fenBefore, start: ply.fenBefore, moves: E.gameA.momentMoves[retry],
      past: E.gameA.sans.slice(0, retry), original: ply.san, alert: false };
  } else {
    S = { mode: 'game', boss: bossOf('ma-non'), fen: E.gameB.fen, start: E.gameB.fen, moves: E.gameB.moves, past: E.gameB.sans, alert: p.get('alert') !== '0' };
  }
  Object.assign(S, { played: [], sel: null, hint: 0, hintsUsed: 0, phase: demo() === 'loading' ? 'loading' : demo() === 'error' ? 'error' : 'you', pending: null, last: null, result: null, menu: false });
  if (S.mode === 'game' && !S.last) { const h = new Chess(); E.gameB.sans.forEach((s) => h.move(s)); const lm = h.history({ verbose: true }).at(-1); S.last = { from: lm.from, to: lm.to }; }
  if (S.mode === 'retry') { const lm = E.gameA.plies[retry - 1]; S.last = { from: lm.uci.slice(0, 2), to: lm.uci.slice(2, 4) }; }
  S.startLast = S.last;
  drawPlay();
}

const best = () => S.moves[0];
function material(fen) {
  const v = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let w = 0, b = 0;
  for (const row of new Chess(fen).board()) for (const x of row) if (x) (x.color === 'w' ? (w += v[x.type]) : (b += v[x.type]));
  return w - b;
}
function consequence(entry, opp = S.boss.name) {
  if (entry.mate != null && entry.mate < 0) return `${opp} có đòn chiếu hết sau ${-entry.mate} nước, mở đầu bằng ${vi(entry.replySan)}.`;
  if (entry.replyCaptures) return `${opp} đáp ${vi(entry.replySan)} và bắt ${PIECE[entry.replyCaptures]} của bạn.`;
  return `${opp} đáp ${vi(entry.replySan)}, thế cờ còn ${fmtEval(entry.eval, entry.mate)} cho bạn.`;
}

function coachHTML() {
  const pieceAt = (sq) => { const x = new Chess(S.fen).get(sq); return x ? PIECE[x.type] : ''; };
  const b = best();
  switch (S.phase) {
    case 'loading': return { text: '<span class="skeleton line"></span><span class="muted">Đang tải engine (1,8 MB). Lần sau mở app sẽ không phải tải lại.</span>', tone: 'wait' };
    case 'error': return { text: 'Không tải được engine. Bàn cờ vẫn lưu nguyên, bạn chưa mất nước nào.', tone: 'error', actions: '<button type="button" class="btn secondary" data-act="reload">Tải lại engine</button>' };
    case 'thinking': return { text: `${S.boss.name} đang nghĩ…`, tone: 'wait' };
    case 'alert': return {
      text: `Khoan đã: ${vi(S.pending.entry.san)} là lỗi lớn. ${consequence(S.pending.entry)}`, tone: 'error',
      actions: '<button type="button" class="btn primary" data-act="cancel-move">Chọn nước khác</button><button type="button" class="btn ghost" data-act="force-move">Vẫn đi</button>',
    };
    case 'done': {
      const e = S.result;
      return { text: `Bạn đi ${vi(e.san)}. ${S.boss.name} đáp ${vi(e.replySan)}.`, sub: 'Đoạn mẫu dừng ở đây: prototype chỉ tính trước một nước cho mỗi lựa chọn.' };
    }
    case 'retry-result': {
      const e = S.result, orig = S.moves.find((m) => m.san === S.original);
      if (!e.judgement) return {
        text: e === b ? `Đúng nước máy chọn: ${vi(e.san)}.` : `Đúng hướng: ${vi(e.san)} gần bằng nước máy chọn (${vi(b.san)}).`, tone: 'ok',
        sub: `Máy dự kiến: ${E.gameA.plies[S.ply].bestLine.map(vi).join(' ')}, thế cờ quanh ${signed(S.ply ? E.gameA.plies[S.ply - 1].evalAfter : E.gameA.startEval)} cho bạn. Trong ván, sau ${vi(S.original)}: ${consequence(orig)}`,
        actions: `<a class="btn primary" href="#/review?m=${S.ply}">Về xem lại ván</a><button type="button" class="btn ghost" data-act="reset">Thử nước khác</button>`,
      };
      return { text: `${vi(e.san)} vẫn chưa ổn. ${consequence(e)}`, tone: 'error', actions: '<button type="button" class="btn primary" data-act="reset">Thử lại</button><button type="button" class="btn ghost" data-act="show-best">Xem nước máy chọn</button>' };
    }
  }
  if (S.hint === 1) return { text: `Gợi ý: tìm nước cho ${pieceAt(b.from)} ở ${b.from}.`, tone: 'coach' };
  if (S.hint === 2) return { text: `Nước máy chọn: ${vi(b.san)}. ${S.boss.name} có thể đáp ${vi(b.replySan)}.`, tone: 'coach' };
  if (S.mode === 'retry') return { text: `Thử lại nước ${moveNo(S.ply)}. Trong ván bạn đã đi ${vi(S.original)}; tìm nước tốt hơn.` };
  const lm = S.past.at(-1);
  return { text: `Lượt bạn. ${S.boss.name} vừa đi ${vi(lm)}.` };
}

function drawPlay() {
  const marks = {};
  const add = (sq, c) => (marks[sq] = [...(marks[sq] || []), c]);
  if (S.last) { add(S.last.from, 'last'); add(S.last.to, 'last'); }
  const arrows = [];
  const live = S.phase === 'you';
  if (S.sel && live) {
    add(S.sel, 'sel');
    for (const m of new Chess(S.fen).moves({ square: S.sel, verbose: true })) add(m.to, m.captured ? 'cap' : 'dot');
  }
  if (S.hint >= 1 && (live || S.phase === 'retry-result')) add(best().from, 'hint');
  if (S.hint === 2 && (live || S.phase === 'retry-result')) arrows.push({ from: best().from, to: best().to, kind: 'coach' });
  if (S.phase === 'alert') arrows.push({ from: S.pending.entry.from, to: S.pending.entry.to, kind: 'bad' });

  const c = coachHTML();
  const all = [...S.past, ...S.played];
  const keep = all.length - 1 - ((all.length - 1) % 2) - 4; // phone: chỉ hiện 3 cặp nước cuối
  const movesHTML = all.map((san, i) => `${i % 2 ? '' : `<li class="mn num${i < keep ? ' old' : ''}">${moveNo(i)}.</li>`}<li class="mv${i === all.length - 1 ? ' cur' : ''}${i >= S.past.length ? ' new' : ''}${i < keep ? ' old' : ''}">${vi(san)}</li>`).join('');
  const diff = material(S.fen);
  const matText = (side) => { const d = side === 'w' ? diff : -diff; return d > 0 ? `<span class="mat num">+${d}</span>` : ''; };
  const title = S.mode === 'retry' ? `Thử lại nước ${moveNo(S.ply)}` : S.boss.name;
  const titleSub = S.mode === 'retry' ? `Ván với ${S.boss.name}, 25/11` : eloText(S.boss);
  const canHint = live && S.hint < 2;
  const canUndo = S.mode === 'game' && (S.phase === 'done' || (S.played.length && live));

  canvas.innerHTML = `<div class="play${S.mode === 'retry' ? ' is-retry' : ''}" data-phase="${S.phase}">
    <div class="play-main">
      <div class="player opp"><span class="avatar xs"><img src="pieces/${S.boss.piece}.svg" alt=""></span><span class="pname">${S.boss.name}</span>${matText('b')}${S.phase === 'thinking' ? '<span class="thinking">đang nghĩ…</span>' : ''}</div>
      <div class="board-wrap">${boardHTML(S.fen, { interactive: true, marks, arrows, label: `Bàn cờ, ${title}` })}</div>
      <div class="player you"><span class="avatar xs you-av"><img src="pieces/wK.svg" alt=""></span><span class="pname">Bạn, cầm Trắng</span>${matText('w')}${S.hintsUsed ? `<span class="hints num">${S.hintsUsed} gợi ý đã dùng</span>` : ''}</div>
    </div>
    <div class="play-side">
      <header class="play-bar">
        <a class="icon-btn" href="${S.mode === 'retry' ? `#/review?m=${S.ply}` : '#/'}" aria-label="${S.mode === 'retry' ? 'Về xem lại ván' : 'Về chọn đối thủ'}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></a>
        <div class="play-title"><h1>${title}</h1><p class="muted">${titleSub}</p></div>
        ${S.mode === 'game' ? `<div class="menu-wrap"><button type="button" class="icon-btn" data-act="menu" aria-expanded="${S.menu}" aria-label="Tùy chọn ván"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg></button>
          ${S.menu ? `<div class="menu" role="menu">
            <label class="menu-item"><span>Nhắc khi sắp mắc lỗi lớn</span><input type="checkbox" class="switch" data-act="toggle-alert" ${S.alert ? 'checked' : ''}></label>
            <button type="button" class="menu-item danger" data-act="resign">Bỏ ván này</button></div>` : ''}</div>` : '<span></span>'}
      </header>
      <section class="coach tone-${c.tone || 'plain'}" aria-live="polite">
        <p class="coach-text">${c.text}</p>${c.sub ? `<p class="coach-sub muted">${c.sub}</p>` : ''}
        ${c.actions ? `<div class="coach-actions">${c.actions}</div>` : ''}
      </section>
      <section class="moves-panel" aria-label="Các nước đã đi"><ol class="moves">${movesHTML}</ol></section>
      <div class="actions">
        <button type="button" class="btn secondary big" data-act="hint" ${canHint ? '' : 'disabled'}>${S.hint === 0 ? 'Gợi ý' : S.hint === 1 ? 'Xem nước gợi ý' : 'Đã hiện gợi ý'}</button>
        <button type="button" class="btn secondary big" data-act="undo" ${canUndo ? '' : 'disabled'}>Đi lại</button>
      </div>
    </div>
  </div>`;
  const strip = canvas.querySelector('.moves-panel');
  strip.scrollLeft = strip.scrollWidth; strip.scrollTop = strip.scrollHeight;
}

canvas.addEventListener('click', (ev) => {
  if (document.body.dataset.route !== 'play' || !S) return;
  const sqEl = ev.target.closest('[data-sq]');
  const act = ev.target.closest('[data-act]')?.dataset.act;
  if (sqEl) return onSquare(sqEl.dataset.sq);
  if (!act) return;
  if (act === 'toggle-alert') { S.alert = ev.target.checked; return; }
  if (act === 'menu') S.menu = !S.menu;
  if (act === 'resign') { if (confirm(`Bỏ ván với ${S.boss.name}? Ván sẽ tính là thua.`)) location.hash = '#/'; return; }
  if (act === 'hint') { S.hint++; S.hintsUsed += S.hint === 1 ? 1 : 0; S.sel = null; }
  if (act === 'cancel-move') { S.phase = 'you'; S.pending = null; }
  if (act === 'force-move') { const p = S.pending; S.pending = null; commit(p.mv, p.entry); return; }
  if (act === 'undo' || act === 'reset') Object.assign(S, { fen: S.start, played: [], phase: 'you', result: null, sel: null, hint: 0, last: S.startLast });
  if (act === 'show-best') Object.assign(S, { fen: S.start, played: [], phase: 'you', result: null, hint: 2, last: S.startLast });
  if (act === 'reload') S.phase = 'you';
  drawPlay();
});

function onSquare(sq) {
  if (S.phase !== 'you') return;
  const c = new Chess(S.fen);
  const piece = c.get(sq);
  if (piece && piece.color === c.turn()) { S.sel = S.sel === sq ? null : sq; return drawPlay(); }
  if (!S.sel) return;
  let mv;
  // shortcut: phong cấp luôn thành hậu; app thật hiện bảng chọn quân.
  try { mv = c.move({ from: S.sel, to: sq, promotion: 'q' }); } catch { S.sel = null; return drawPlay(); }
  const entry = S.moves.find((m) => m.san === mv.san);
  S.sel = null;
  if (S.mode === 'game' && S.alert && entry.judgement === 'loi-lon') { S.pending = { mv, entry }; S.phase = 'alert'; return drawPlay(); }
  commit(mv, entry);
}

function commit(mv, entry) {
  const c = new Chess(S.fen);
  c.move(mv.san);
  Object.assign(S, { fen: c.fen(), played: [mv.san], last: { from: mv.from, to: mv.to }, phase: 'thinking', hint: S.mode === 'retry' ? S.hint : 0 });
  drawPlay();
  setTimeout(() => {
    if (entry.reply) { const r = c.move({ from: entry.reply.slice(0, 2), to: entry.reply.slice(2, 4), promotion: entry.reply[4] }); S.played.push(r.san); S.last = { from: r.from, to: r.to }; }
    Object.assign(S, { fen: c.fen(), result: entry, phase: S.mode === 'retry' ? 'retry-result' : 'done' });
    drawPlay();
  }, 900);
}

// ---------- màn 3: xem lại ----------
let R = null;
function review() {
  const G = E.gameA, boss = bossOf('tuong-go');
  const pov = 1; // người chơi cầm Trắng; app thật nhân −1 khi cầm Đen
  const evals = [G.startEval, ...G.plies.map((p) => p.evalAfter)].map((v) => v * pov);
  const m = Number(params().get('m'));
  R = { G, boss, evals, moment: G.moments.includes(m) ? m : G.moments.reduce((a, b) => (G.plies[b].drop > G.plies[a].drop ? b : a)), view: 'moment', ply: null };
  const worst = G.moments.reduce((a, b) => (G.plies[b].drop > G.plies[a].drop ? b : a));
  const last = G.plies.at(-1);
  const mine = (j) => G.plies.filter((p, i) => i % 2 === 0 && p.judgement === j).length;
  const theirs = (j) => G.plies.filter((p, i) => i % 2 === 1 && p.judgement === j).length;
  const finding = `Thua sau ${moveNo(G.plies.length - 1)} nước${last.san.endsWith('#') ? ', bị chiếu hết' : ''}. Lỗi đắt nhất: nước ${moveNo(worst)}, ${vi(G.plies[worst].san)}, thế cờ từ ${signed(evals[worst])} xuống ${signed(evals[worst + 1])}.`;

  canvas.innerHTML = `<div class="page review">
    <header class="title-row"><div><h1>Ván với ${boss.name}, 25/11</h1><p class="sub">${finding}</p></div></header>
    <div class="review-top">
      <section class="review-board" aria-label="Bàn cờ xem lại"><div id="rboard"></div>
        <div class="ply-nav"><button type="button" class="icon-btn" data-step="-1" aria-label="Nước trước"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><span id="plylabel" class="num"></span><button type="button" class="icon-btn" data-step="1" aria-label="Nước sau"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button></div>
      </section>
      <div class="review-side">
      <section class="panel moments" aria-labelledby="mom-h">
        <header><h2 id="mom-h">Ba khoảnh khắc đáng học</h2></header>
        <div class="moment-tabs" role="tablist">${G.moments.map((p) => `<button type="button" role="tab" data-moment="${p}"><span class="num">Nước ${moveNo(p)}</span><span>${vi(G.plies[p].san)}</span></button>`).join('')}</div>
        <div id="mdetail"></div>
      </section>
      <section class="panel chart-panel">
        <div class="chart-head"><h2>Thế cờ qua từng nước</h2><span class="meta">Điểm của bạn tính theo tốt; chiếu hết tính là ±10</span></div>
        <div class="chart" id="evalchart"></div>
      </section>
      </div>
    </div>
    <div class="grid lower">
      <section class="panel tally-panel">
        <header><h2>Lỗi trong ván</h2></header>
        <table><thead><tr><th></th><th class="n">Bạn</th><th class="n">${boss.name}</th></tr></thead><tbody>
          ${Object.entries(JUDGE).map(([k, [label, g]]) => `<tr><td>${label} <span class="glyph g-${k}">${g}</span></td><td class="n num${mine(k) ? '' : ' zero'}">${mine(k)}</td><td class="n num${theirs(k) ? '' : ' zero'}">${theirs(k)}</td></tr>`).join('')}
        </tbody></table>
      </section>
      <section class="panel movelist-panel">
        <header><h2>Các nước</h2><span class="meta num">${G.plies.length} nửa nước</span></header>
        <ol class="movelist">${G.plies.map((p, i) => `${i % 2 ? '' : `<li><span class="mn num">${moveNo(i)}.</span>`}<button type="button" data-ply="${i}" class="${p.judgement ? `j-${p.judgement}` : ''}">${vi(p.san)}${p.judgement ? `<span class="glyph">${JUDGE[p.judgement][1]}</span>` : ''}</button>${i % 2 || i === G.plies.length - 1 ? '</li>' : ''}`).join('')}</ol>
      </section>
    </div>
  </div>`;

  Charts.line(document.getElementById('evalchart'), {
    labels: evals.map((_, i) => String(i === 0 ? 0 : moveNo(i - 1))),
    series: [{ name: 'Điểm của bạn', values: evals }],
    format: Charts.fmt.signed(Charts.fmt.dec(1)),
    tickFormat: Charts.fmt.signed(),
    yTicks: [-10, -5, 0, 5, 10],
    height: 200,
    reference: { value: 0, label: 'Cân bằng' },
    annotations: G.moments.map((p) => ({ at: p + 1, label: `Nước ${moveNo(p)}: ${vi(G.plies[p].san)}`, short: String(moveNo(p)) })),
  });
  canvas.querySelectorAll('[data-moment]').forEach((b) => b.addEventListener('click', () => { R.moment = Number(b.dataset.moment); R.view = 'moment'; drawReview(); }));
  canvas.querySelectorAll('[data-ply]').forEach((b) => b.addEventListener('click', () => {
    R.view = 'ply'; R.ply = Number(b.dataset.ply); drawReview();
    const top = document.getElementById('rboard').getBoundingClientRect().top;
    if (top < 0) document.getElementById('rboard').scrollIntoView({ block: 'start' }); // phone: bàn cờ đã trôi khỏi màn
  }));
  canvas.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const cur = R.view === 'ply' ? R.ply : R.moment - 1;
    R.view = 'ply'; R.ply = Math.max(-1, Math.min(R.G.plies.length - 1, cur + Number(b.dataset.step))); drawReview();
  }));
  drawReview();
}

function drawReview() {
  const { G, evals } = R;
  const board = document.getElementById('rboard');
  const label = document.getElementById('plylabel');
  if (R.view === 'moment') {
    const p = G.plies[R.moment];
    const marks = {};
    board.innerHTML = boardHTML(p.fenBefore, { marks, arrows: [{ from: p.uci.slice(0, 2), to: p.uci.slice(2, 4), kind: 'bad' }, { from: p.bestUci.slice(0, 2), to: p.bestUci.slice(2, 4), kind: 'coach' }], label: `Thế cờ trước nước ${moveNo(R.moment)}` });
    label.textContent = `Trước nước ${moveNo(R.moment)}`;
  } else {
    const p = R.ply >= 0 ? G.plies[R.ply] : null;
    const fen = p ? p.fenAfter : new Chess().fen();
    const marks = p ? { [p.uci.slice(0, 2)]: ['last'], [p.uci.slice(2, 4)]: ['last'] } : {};
    board.innerHTML = boardHTML(fen, { marks, label: p ? `Thế cờ sau nước ${moveNo(R.ply)}` : 'Thế cờ ban đầu' });
    label.textContent = p ? `Sau ${moveNo(R.ply)}${R.ply % 2 ? '…' : '.'} ${vi(p.san)}  ·  ${signed(evals[R.ply + 1])}` : 'Thế cờ ban đầu';
  }
  canvas.querySelectorAll('[data-moment]').forEach((b) => b.setAttribute('aria-selected', String(R.view === 'moment' && Number(b.dataset.moment) === R.moment)));
  canvas.querySelectorAll('[data-ply]').forEach((b) => b.toggleAttribute('aria-current', R.view === 'ply' && Number(b.dataset.ply) === R.ply));

  const p = G.plies[R.moment];
  const played = G.momentMoves[R.moment].find((m) => m.san === p.san);
  const n = moveNo(R.moment);
  document.getElementById('mdetail').innerHTML = `
    <div class="mrow"><span class="pill neg">${JUDGE[p.judgement][0]}</span><span class="swing num">${signed(evals[R.moment])} <span class="muted">→</span> <b>${signed(evals[R.moment + 1])}</b></span></div>
    <p class="mline"><span class="key key-bad">Bạn đi</span> <b>${vi(p.san)}</b>. ${consequence(played, R.boss.name)}</p>
    <p class="mline"><span class="key key-coach">Nước tốt hơn</span> <b>${vi(p.bestSan)}</b>, giữ thế cờ quanh ${signed(evals[R.moment])}. Dự kiến: ${p.bestLine.map(vi).join(' ')}.</p>
    <div class="mactions"><a class="btn primary" href="#/play?retry=${R.moment}">Thử lại nước ${n}</a></div>`;
}

route();
