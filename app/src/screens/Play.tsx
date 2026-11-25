import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Boss } from '../bosses.ts';
import { Badge } from '../components/Badge.tsx';
import { Board, type Arrow } from '../components/Board.tsx';
import { EvalBar } from '../components/EvalBar.tsx';
import { NewGameSheet } from '../components/NewGameSheet.tsx';
import { ANALYSIS, Engine, HINT_GO } from '../engine/engine.ts';
import { bookName } from '../lib/book.ts';
import { consequence, gradeClass, isSacrifice, MOVE_CLASS, PIECE_VI, sanOf, toPawns, viSan, winPercent, type MoveClass, type PieceType } from '../lib/coach.ts';
import { putGame } from '../lib/history.ts';
import type { Result } from '../lib/progress.ts';
import { loadGame, saveGame, startGame, type Color, type Grade } from '../lib/saved-game.ts';

type Phase = 'loading' | 'error' | 'you' | 'thinking' | 'over';
/** Phân tích thế cờ hiện tại (lượt người chơi). pawns theo góc người chơi; pv bắt đầu bằng nước máy chọn. */
interface Analysis { fen: string; best: string; bestSan: string; replySan: string | null; pawns: number; pv: string[] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uciMove = (u: string) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
const GRADE_GO = 'movetime 400';
const BAD: MoveClass[] = ['inaccuracy', 'mistake', 'blunder'];
const PROMO: PieceSymbol[] = ['q', 'r', 'b', 'n'];

function material(fen: string) {
  const v: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let d = 0;
  for (const row of new Chess(fen).board()) for (const x of row) if (x) d += x.color === 'w' ? v[x.type] : -v[x.type];
  return d;
}

/** Kết quả theo phía người chơi khi ván kết thúc theo luật (chiếu hết / hòa). */
const outcome = (g: Chess, me: Color): Result => (g.isCheckmate() ? (g.turn() === me ? 'loss' : 'win') : 'draw');

function overText(g: Chess, bossName: string, me: Color) {
  if (g.isCheckmate()) return g.turn() === me ? `${bossName} chiếu hết. Bạn thua ván này.` : `Bạn chiếu hết ${bossName}!`;
  if (g.isStalemate()) return 'Hòa: bên đi không còn nước hợp lệ.';
  if (g.isThreefoldRepetition()) return 'Hòa do lặp lại thế cờ ba lần.';
  if (g.isInsufficientMaterial()) return 'Hòa: không đủ quân để chiếu hết.';
  return 'Hòa theo luật 50 nước.';
}

export function Play({ boss }: { boss: Boss }) {
  // Ván đã lưu (nếu có) chỉ đọc một lần khi mở màn
  const [init] = useState(() => loadGame());
  const [game] = useState(() => init?.game ?? new Chess()); // đối tượng chess.js sống suốt màn, chỉ đổi qua game.move/undo/reset
  const engine = useRef<Engine | null>(null);
  const gen = useRef(0); // tăng mỗi khi thế cờ đổi; kết quả async của thế cờ cũ bị bỏ
  const analysisJob = useRef<Promise<Analysis | null> | null>(null);
  const meRef = useRef<Color>(init?.color ?? 'w');

  const [gameId, setGameId] = useState(() => init?.id ?? startGame(boss.id, 'w').id);
  const [color, setColor] = useState<Color>(init?.color ?? 'w');
  const [result, setResult] = useState<Result | undefined>(init?.result);
  const [fen, setFen] = useState(() => game.fen());
  const [history, setHistory] = useState<Move[]>(() => game.history({ verbose: true }));
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [hint, setHint] = useState<0 | 1 | 2>(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [grades, setGrades] = useState<Record<number, Grade>>(init?.grades ?? {}); // khóa = chỉ số nửa nước
  const [evalPawns, setEvalPawns] = useState<number | null>(null); // theo góc người chơi
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [over, setOver] = useState(init?.over ?? '');

  // Lưu sau mỗi thay đổi của ván; ván kết thúc thì ghi thêm vào lịch sử (ghi đè theo id nên gọi lại không sao)
  useEffect(() => {
    const sans = history.map((m) => m.san);
    saveGame({ v: 1, id: gameId, bossId: boss.id, color, sans, grades, over, result });
    if (over && result) void putGame({ id: gameId, bossId: boss.id, color, sans, grades, result, reason: over, endedAt: new Date().toISOString() });
  }, [gameId, boss.id, color, history, grades, over, result]);

  /** Đẩy thế cờ hiện tại của game ra state để vẽ lại */
  const sync = () => {
    setFen(game.fen());
    setHistory(game.history({ verbose: true }));
  };

  const finish = (text: string, res: Result) => {
    gen.current++;
    setOver(text);
    setResult(res);
    setPhase('over');
  };

  const analyse = () => {
    const f = game.fen();
    const my = gen.current;
    setAnalysis(null);
    analysisJob.current = engine.current!.search(f, ANALYSIS, HINT_GO).then((r) => {
      if (!r.best || r.best === '(none)' || !r.info?.score) return null;
      const after = new Chess(f);
      after.move(uciMove(r.best));
      const pv = r.info.pv[0] === r.best ? r.info.pv : [r.best];
      const a: Analysis = { fen: f, best: r.best, bestSan: sanOf(f, r.best), replySan: pv[1] ? sanOf(after.fen(), pv[1]) : null, pawns: toPawns(r.info.score), pv };
      if (gen.current === my) { setAnalysis(a); setEvalPawns(a.pawns); }
      return a;
    });
  };

  const bossTurn = async (my: number, t0 = performance.now()) => {
    setPhase('thinking');
    // boss yếu đôi khi đi nước ngẫu nhiên (xem bosses.ts, đã hiệu chỉnh bằng tools/calibrate.mjs)
    const random = Math.random() < (boss.blunder ?? 0);
    const legal = game.moves({ verbose: true });
    const pick = legal[Math.floor(Math.random() * legal.length)];
    const best = random ? pick.lan : (await engine.current!.search(game.fen(), boss.options, boss.go)).best;
    const wait = boss.minDelayMs - (performance.now() - t0);
    if (wait > 0) await sleep(wait);
    if (gen.current !== my || !best || best === '(none)') return;
    game.move(uciMove(best));
    sync();
    if (game.isGameOver()) return finish(overText(game, boss.name, meRef.current), outcome(game, meRef.current));
    setPhase('you');
    analyse();
  };

  /** Tiếp tục ván hiện tại: tới lượt người chơi thì phân tích, không thì boss đi. */
  const begin = () => {
    const my = ++gen.current;
    if (game.turn() === meRef.current) { setPhase('you'); analyse(); } else void bossTurn(my);
  };

  const startEngine = async () => {
    try {
      const { engine: e } = await Engine.create();
      engine.current = e;
      e.newGame();
      void bookName(game.fen()); // tải trước dữ liệu sách khai cuộc
      if (init?.over) setPhase('over');
      else if (game.isGameOver()) finish(overText(game, boss.name, meRef.current), outcome(game, meRef.current));
      else begin();
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  };

  useEffect(() => {
    void startEngine();
    return () => engine.current?.terminate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- chỉ chạy một lần khi mở màn

  /** Đi nước ngay (không chặn), chấm nước đó, rồi cho boss đáp. Engine chạy tuần tự: chấm (≤ 400 ms) rồi mới tới boss. */
  const playMove = async (from: string, to: string, promotion: PieceSymbol = 'q') => {
    const e = engine.current!, me = meRef.current;
    const before = game.fen();
    let move: Move;
    try {
      move = new Chess(before).move({ from, to, promotion });
    } catch {
      setSel(null);
      return;
    }
    e.stop(); // lấy ngay kết quả phân tích gợi ý đang có làm mốc "trước nước"
    const ply = game.history().length;
    game.move(move.san);
    const my = ++gen.current;
    const t0 = performance.now();
    sync(); setSel(null); setPromo(null); setHint(0); setAnalysis(null);
    if (game.isGameOver()) {
      if (game.isCheckmate()) { setGrades((gr) => ({ ...gr, [ply]: { cls: 'best', text: null } })); setEvalPawns(10); }
      return finish(overText(game, boss.name, me), outcome(game, me));
    }
    setPhase('thinking');

    const [a, opening] = await Promise.all([analysisJob.current, bookName(game.fen())]);
    if (gen.current !== my) return;
    if (a) {
      const isBest = a.best === move.lan;
      let after = a.pawns, pv = a.pv, why: string | null = null;
      if (!isBest && !opening) {
        const r = await e.search(game.fen(), ANALYSIS, GRADE_GO);
        if (gen.current !== my) return;
        if (r.info?.score) {
          after = -toPawns(r.info.score);
          pv = [move.lan, ...r.info.pv];
          if (r.best && r.best !== '(none)') why = `${consequence(game.fen(), r.best, r.info.score, boss.name)} Nước tốt hơn: ${viSan(a.bestSan)}.`;
        }
      }
      const cls = gradeClass({ before: a.pawns, after, isBest, isBook: !!opening, sacrifice: !opening && isSacrifice(before, pv) });
      const text = cls === 'book' ? `${opening}.` : cls === 'brilliant' ? 'Thí quân mà thế cờ vẫn tốt cho bạn.' : BAD.includes(cls) ? why : null;
      setGrades((gr) => ({ ...gr, [ply]: { cls, text } }));
      setEvalPawns(after);
    }
    await bossTurn(my, t0);
  };

  const onSquare = (sq: string) => {
    if (phase !== 'you') return;
    setPromo(null);
    const p = game.get(sq as Square);
    if (p && p.color === game.turn()) return setSel(sel === sq ? null : sq);
    if (!sel) return;
    const legal = new Chess(fen).moves({ square: sel as Square, verbose: true }).filter((m) => m.to === sq);
    if (!legal.length) return setSel(null);
    if (legal.some((m) => m.promotion)) return setPromo({ from: sel, to: sq });
    void playMove(sel, sq);
  };

  const askHint = () => setHint((h) => (h === 0 ? 1 : 2));

  const undo = () => {
    gen.current++;
    engine.current!.stop();
    game.undo();
    if (game.turn() !== meRef.current) game.undo(); // về lượt người chơi
    const n = game.history().length;
    setGrades((gr) => Object.fromEntries(Object.entries(gr).filter(([k]) => Number(k) < n)));
    sync(); setHint(0); setSel(null); setPromo(null); setOver(''); setResult(undefined);
    begin(); // cầm Đen mà lùi về đầu ván thì boss đi lại nước đầu
  };

  const newGame = (me: Color) => {
    setGameId(startGame(boss.id, me).id);
    gen.current++;
    engine.current!.stop();
    engine.current!.newGame();
    game.reset();
    meRef.current = me;
    setColor(me);
    sync(); setHint(0); setSel(null); setPromo(null); setOver(''); setResult(undefined); setGrades({}); setEvalPawns(null); setMenu(false); setSheet(false);
    begin();
  };

  // ---------- hiển thị ----------
  const last = history.at(-1);
  // nước gần nhất của người chơi; huy hiệu ẩn nếu boss đã ăn quân ở ô đó
  const mine = (i: number) => (i % 2 === 0) === (color === 'w');
  const myPly = mine(history.length - 1) ? history.length - 1 : history.length - 2;
  const myGrade = myPly >= 0 ? grades[myPly] : undefined;
  const badgeHidden = myPly < history.length - 1 && last?.to === history[myPly]?.to;
  const marks: Record<string, string[]> = {};
  const add = (sq: string, c: string) => (marks[sq] = [...(marks[sq] ?? []), c]);
  if (last) { add(last.from, 'last'); add(last.to, 'last'); }
  if (sel && phase === 'you') {
    add(sel, 'sel');
    for (const m of new Chess(fen).moves({ square: sel as Square, verbose: true })) add(m.to, m.captured ? 'cap' : 'dot');
  }
  const arrows: Arrow[] = [];
  if (phase === 'you' && analysis && hint >= 1) add(analysis.best.slice(0, 2), 'hint');
  if (phase === 'you' && analysis && hint === 2) arrows.push({ from: analysis.best.slice(0, 2), to: analysis.best.slice(2, 4), kind: 'coach' });

  const gradeText: ReactNode = myGrade ? <><Badge cls={myGrade.cls} inline />{MOVE_CLASS[myGrade.cls].label}{myGrade.text ? `: ${myGrade.text}` : '.'}</> : null;
  const turnLine = last && !mine(history.length - 1) ? `${boss.name} vừa đi ${viSan(last.san)}. Lượt bạn.` : 'Lượt bạn.';
  let text: ReactNode, sub: ReactNode = null, tone = 'plain', actions: ReactNode = null;
  if (phase === 'loading') { text = 'Đang tải engine (1,8 MB)…'; tone = 'wait'; }
  else if (phase === 'error') {
    text = `Không tải được engine: ${error}`; tone = 'error';
    actions = <button type="button" className="btn secondary" onClick={() => { setPhase('loading'); void startEngine(); }}>Tải lại engine</button>;
  } else if (phase === 'over') {
    text = over; sub = gradeText;
    actions = <button type="button" className="btn primary" onClick={() => setSheet(true)}>Ván mới</button>;
  } else if (phase === 'thinking') {
    text = gradeText ?? (history.length && mine(history.length - 1) ? 'Coach đang xem nước của bạn…' : `${boss.name} đi trước.`);
    sub = `${boss.name} đang nghĩ…`;
  } else if (hint > 0 && !analysis) { text = 'Đang tìm gợi ý…'; tone = 'wait'; }
  else if (hint === 1 && analysis) {
    const p = new Chess(fen).get(analysis.best.slice(0, 2) as Square);
    text = `Gợi ý: tìm nước cho ${p ? PIECE_VI[p.type as PieceType] : 'quân'} ở ${analysis.best.slice(0, 2)}.`; tone = 'coach';
  } else if (hint === 2 && analysis) {
    text = `Nước máy chọn: ${viSan(analysis.bestSan)}.${analysis.replySan ? ` ${boss.name} có thể đáp ${viSan(analysis.replySan)}.` : ''}`; tone = 'coach';
  } else if (gradeText) { text = gradeText; sub = turnLine; }
  else text = history.length ? turnLine : `Lượt bạn. Bạn cầm ${color === 'w' ? 'Trắng, đi trước' : 'Đen'}.`;

  const keep = history.length - 1 - ((history.length - 1) % 2) - 4;
  const diff = color === 'w' ? material(fen) : -material(fen); // theo phía người chơi
  const canUndo = (phase === 'you' || phase === 'over') && history.some((_, i) => mine(i));
  const inProgress = phase !== 'over' && history.length > 0;

  return (
    <div className="play" data-phase={phase}>
      <div className="play-main">
        <div className="player opp">
          <span className="avatar xs"><img src={`pieces/${boss.piece.replace(/^./, color === 'w' ? 'b' : 'w')}.svg`} alt="" /></span>
          <span className="pname">{boss.name}</span>
          {diff < 0 && <span className="mat num">+{-diff}</span>}
          {phase === 'thinking' && <span className="thinking">đang nghĩ…</span>}
        </div>
        <div className="board-wrap">
          <EvalBar pawns={evalPawns} me={color} />
          <Board fen={fen} marks={marks} arrows={arrows} onSquare={onSquare} orientation={color} label={`Bàn cờ, ván với ${boss.name}`}
            badge={myGrade && !badgeHidden ? { square: history[myPly].to, cls: myGrade.cls } : null} />
          {promo && (
            <div className="promo" role="dialog" aria-label="Chọn quân phong cấp">
              {PROMO.map((t) => (
                <button key={t} type="button" aria-label={PIECE_VI[t as PieceType]} onClick={() => void playMove(promo.from, promo.to, t)}>
                  <img src={`pieces/${color}${t.toUpperCase()}.svg`} alt="" />
                </button>
              ))}
              <button type="button" className="promo-cancel" onClick={() => { setPromo(null); setSel(null); }}>Hủy</button>
            </div>
          )}
        </div>
        <div className="player you">
          <span className="avatar xs"><img src={`pieces/${color}K.svg`} alt="" /></span>
          <span className="pname">Bạn, cầm {color === 'w' ? 'Trắng' : 'Đen'}</span>
          {diff > 0 && <span className="mat num">+{diff}</span>}
          {evalPawns != null && <span className="winpct num">Cơ hội thắng {winPercent(evalPawns)}%</span>}
        </div>
      </div>
      <div className="play-side">
        <header className="play-bar">
          <a className="icon-btn" href="#/" aria-label="Về chọn đối thủ">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </a>
          <div className="play-title"><h1>{boss.name}</h1><p className="muted">khoảng {boss.elo.toLocaleString('vi')} Elo</p></div>
          <div className="menu-wrap">
            <button type="button" className="icon-btn" aria-expanded={menu} aria-label="Tùy chọn ván" onClick={() => setMenu(!menu)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
            </button>
            {menu && (
              <div className="menu" role="menu">
                <button type="button" className="menu-item" onClick={() => { setMenu(false); setSheet(true); }}>Ván mới</button>
                <button type="button" className="menu-item danger" disabled={phase === 'over'}
                  onClick={() => { if (confirm(`Bỏ ván với ${boss.name}? Ván sẽ tính là thua.`)) { setMenu(false); finish('Bạn đã bỏ ván.', 'loss'); } }}>Bỏ ván này</button>
                <a className="menu-item" href="#/bench">Đo engine trên máy này</a>
              </div>
            )}
          </div>
        </header>
        <section className={`coach tone-${tone}`} aria-live="polite">
          <p className="coach-text">{text}</p>
          {sub && <p className="coach-sub muted">{sub}</p>}
          {actions && <div className="coach-actions">{actions}</div>}
        </section>
        <section className="moves-panel" aria-label="Các nước đã đi">
          <ol className="moves">
            {history.map((m, i) => [
              i % 2 === 0 && <li key={`n${i}`} className={`mn num${i < keep ? ' old' : ''}`}>{i / 2 + 1}.</li>,
              <li key={i} className={`mv${i === history.length - 1 ? ' cur' : ''}${i < keep ? ' old' : ''}`}>
                {viSan(m.san)}
                {grades[i] && (BAD.includes(grades[i].cls) || grades[i].cls === 'brilliant') && <span className={`mglyph c-${grades[i].cls}`}>{MOVE_CLASS[grades[i].cls].glyph}</span>}
              </li>,
            ])}
          </ol>
        </section>
        <div className="actions">
          <button type="button" className="btn secondary big" disabled={phase !== 'you' || hint === 2} onClick={askHint}>
            {hint === 0 ? 'Gợi ý' : hint === 1 ? 'Xem nước gợi ý' : 'Đã hiện gợi ý'}
          </button>
          <button type="button" className="btn secondary big" disabled={!canUndo} onClick={undo}>Đi lại</button>
        </div>
      </div>

      {sheet && (
        <NewGameSheet boss={boss} initial={color} onStart={newGame} onClose={() => setSheet(false)}
          warning={inProgress ? 'Ván đang chơi sẽ bị xóa, không tính thắng thua.' : null} />
      )}
    </div>
  );
}
