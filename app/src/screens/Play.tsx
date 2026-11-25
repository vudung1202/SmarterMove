import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Boss } from '../bosses.ts';
import { Badge } from '../components/Badge.tsx';
import { Board, type Arrow } from '../components/Board.tsx';
import { EvalBar } from '../components/EvalBar.tsx';
import { NewGameSheet } from '../components/NewGameSheet.tsx';
import { ANALYSIS, Engine, HINT_GO } from '../engine/engine.ts';
import { bookName } from '../lib/book.ts';
import { cap, describeMove, planTip, positionalNotes, threatened } from '../lib/commentary.ts';
import { consequence, gradeClass, isSacrifice, MOVE_CLASS, PIECE_VI, sanOf, toPawns, viSan, wc, winPercent, type MoveClass, type PieceType } from '../lib/coach.ts';
import { putGame } from '../lib/history.ts';
import type { Result } from '../lib/progress.ts';
import { loadGame, saveGame, startGame, type Color, type Grade } from '../lib/saved-game.ts';
import { setSoundOn, soundOn, sounds, unlockAudio } from '../lib/sound.ts';

type Phase = 'loading' | 'error' | 'you' | 'thinking' | 'over';
/** Phân tích thế cờ hiện tại (lượt người chơi). pawns theo góc người chơi; pv bắt đầu bằng nước máy chọn. */
interface Analysis { fen: string; best: string; bestSan: string; replySan: string | null; pawns: number; pv: string[] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uciMove = (u: string) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
const GRADE_GO = 'movetime 400';
const BAD: MoveClass[] = ['inaccuracy', 'mistake', 'blunder'];
const PROMO: PieceSymbol[] = ['q', 'r', 'b', 'n'];
// Pháo giấy khi thắng: 28 mảnh, hướng/độ xoay/màu cố định theo chỉ số (không ngẫu nhiên để mỗi lần trông như nhau)
const CONFETTI_COLORS = ['#1d5fbf', '#f7de3a', '#2e7d32', '#141414', '#c4242a'];
const CONFETTI = Array.from({ length: 28 }, (_, i) => {
  const a = (i / 28) * Math.PI * 2, spread = 90 + (i % 5) * 22;
  return {
    '--x': `${Math.round(Math.cos(a) * spread)}px`, '--up': `${-60 - (i % 4) * 18}px`, '--y': `${170 + (i % 6) * 22}px`,
    '--r': `${(i % 2 ? 1 : -1) * (360 + i * 25)}deg`, '--d': `${0.6 + (i % 7) * 0.03}s`, '--c': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  } as CSSProperties;
});

function material(fen: string) {
  const v: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let d = 0;
  for (const row of new Chess(fen).board()) for (const x of row) if (x) d += x.color === 'w' ? v[x.type] : -v[x.type];
  return d;
}

/** Kết quả theo phía người chơi khi ván kết thúc theo luật (chiếu hết / hòa). */
/** Các quân phải trượt khi vẽ nước `m`: quân đi, và thêm xe khi nhập thành. */
function slidesOf(m: Move) {
  const rank = m.color === 'w' ? '1' : '8';
  const out: { from: string; to: string }[] = [{ from: m.from, to: m.to }];
  if (m.flags.includes('k')) out.push({ from: 'h' + rank, to: 'f' + rank });
  if (m.flags.includes('q')) out.push({ from: 'a' + rank, to: 'd' + rank });
  return out;
}

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
  // điểm sau mỗi nửa nước (góc người chơi), khóa −1 = thế cờ ban đầu — vẽ đồ thị ở màn Xem lại
  const [evals, setEvals] = useState<Record<number, number>>(init?.evals ?? {});
  const putEval = (ply: number, v: number) => setEvals((e) => ({ ...e, [ply]: v }));
  const [evalPawns, setEvalPawns] = useState<number | null>(null); // theo góc người chơi
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [over, setOver] = useState(init?.over ?? '');
  // Xem lại thế cờ cũ trong lúc chơi: chỉ số nửa nước (−1 = thế cờ ban đầu); null = thế cờ hiện tại
  const [view, setView] = useState<number | null>(null);
  const [openingName, setOpeningName] = useState('');
  const movesRef = useRef<HTMLOListElement>(null);
  // Hiệu ứng: quân rơi vào bàn khi ván mới bắt đầu; thẻ kết quả khi ván vừa kết thúc (không hiện lại khi mở ván đã xong)
  const [intro, setIntro] = useState(() => !!init && !init.sans.length && !init.over);
  const [endCard, setEndCard] = useState(false);
  const [sound, setSound] = useState(soundOn);
  useEffect(() => {
    if (!intro) return;
    sounds.start();
    const t = setTimeout(() => setIntro(false), 1800);
    return () => clearTimeout(t);
  }, [intro]);

  // Lưu sau mỗi thay đổi của ván; ván kết thúc thì ghi thêm vào lịch sử (ghi đè theo id nên gọi lại không sao)
  useEffect(() => {
    const sans = history.map((m) => m.san);
    saveGame({ v: 1, id: gameId, bossId: boss.id, color, sans, grades, evals, over, result });
    if (over && result) void putGame({ id: gameId, bossId: boss.id, color, sans, grades, evals, result, reason: over, endedAt: new Date().toISOString() });
  }, [gameId, boss.id, color, history, grades, evals, over, result]);

  // Số nửa nước đã vẽ; tăng đúng 1 thì cho quân vừa đi trượt tới ô mới (đi lại, ván mới thì không)
  const drawnLen = useRef(game.history().length);
  const [slide, setSlide] = useState<{ key: number; moves: { from: string; to: string }[] } | null>(null);

  /** Đẩy thế cờ hiện tại của game ra state để vẽ lại */
  const sync = () => {
    const h = game.history({ verbose: true });
    const m = h.at(-1);
    setSlide(m && h.length === drawnLen.current + 1 ? { key: h.length, moves: slidesOf(m) } : null);
    drawnLen.current = h.length;
    setView(null);
    setFen(game.fen());
    setHistory(h);
  };

  /** Kết thúc ván. `live` = vừa xảy ra trong lúc chơi (có âm thanh, thẻ kết quả); false khi mở lại ván đã xong. */
  const finish = (text: string, res: Result, live = true) => {
    gen.current++;
    setOver(text);
    setResult(res);
    setPhase('over');
    if (!live) return;
    setIntro(false);
    setEndCard(true);
    sounds[res === 'win' ? 'win' : res === 'loss' ? 'lose' : 'draw']();
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
      if (gen.current === my) { setAnalysis(a); setEvalPawns(a.pawns); putEval(game.history().length - 1, a.pawns); }
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
    if (game.isGameOver()) {
      putEval(game.history().length - 1, game.isCheckmate() ? -10 : 0);
      return finish(overText(game, boss.name, meRef.current), outcome(game, meRef.current));
    }
    setPhase('you');
    analyse();
  };

  /** Tiếp tục ván hiện tại: tới lượt người chơi thì phân tích, không thì boss đi. */
  const begin = () => {
    const my = ++gen.current;
    if (game.turn() === meRef.current) { setPhase('you'); analyse(); } else void bossTurn(my);
  };

  /** Engine sẵn sàng: tiếp tục ván (hoặc hiện ván đã xong). */
  const onEngine = (e: Engine) => {
    engine.current = e;
    e.newGame();
    void bookName(game.fen()); // tải trước dữ liệu sách khai cuộc
    if (init?.over) setPhase('over');
    else if (game.isGameOver()) finish(overText(game, boss.name, meRef.current), outcome(game, meRef.current), false);
    else begin();
  };
  const onEngineError = (err: unknown) => {
    setError((err as Error).message);
    setPhase('error');
  };
  const startEngine = () => Engine.create().then(({ engine: e }) => onEngine(e), onEngineError);

  // Tải engine một lần khi mở màn; mọi setState nằm trong callback của promise (không chạy đồng bộ trong effect).
  // `alive` chặn engine thừa khi React StrictMode chạy effect hai lần.
  useEffect(() => {
    let alive = true;
    Engine.create().then(({ engine: e }) => (alive ? onEngine(e) : e.terminate()), (err) => alive && onEngineError(err));
    return () => { alive = false; engine.current?.terminate(); engine.current = null; };
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
      putEval(ply, game.isCheckmate() ? 10 : 0);
      return finish(overText(game, boss.name, me), outcome(game, me));
    }
    setPhase('thinking');

    const [a, opening] = await Promise.all([analysisJob.current, bookName(game.fen())]);
    if (gen.current !== my) return;
    if (a) {
      const isBest = a.best === move.lan;
      let after = a.pawns, pv = a.pv, cons: string | null = null, onlyMove = false;
      if (!isBest) { // nước sách cũng chấm: biến bẫy trong sách (như Fool's Mate) vẫn là lỗi
        const r = await e.search(game.fen(), ANALYSIS, GRADE_GO);
        if (gen.current !== my) return;
        if (r.info?.score) {
          after = -toPawns(r.info.score);
          pv = [move.lan, ...r.info.pv];
          if (r.best && r.best !== '(none)') cons = consequence(game.fen(), r.best, r.info.score, boss.name);
        }
      } else if (!opening) {
        // "Nước hay": nước tốt thứ hai (tìm trong mọi nước trừ nước vừa đi) tụt hẳn so với nước tốt nhất
        const others = new Chess(before).moves({ verbose: true }).filter((x) => x.lan !== move.lan).map((x) => x.lan);
        if (others.length && a.pawns > -3) {
          const r2 = await e.search(before, ANALYSIS, `movetime 300 searchmoves ${others.join(' ')}`);
          if (gen.current !== my) return;
          if (r2.info?.score) onlyMove = wc(a.pawns) - wc(toPawns(r2.info.score)) >= 0.25;
        }
      }
      const cls = gradeClass({ before: a.pawns, after, isBest, isBook: !!opening, sacrifice: !opening && isSacrifice(before, pv), onlyMove });
      const facts = describeMove(before, move.san);
      const notes = positionalNotes(before, move.san, ply);
      const bestFacts = describeMove(before, a.bestSan);
      const better = `Nước tốt hơn: ${viSan(a.bestSan)}${bestFacts.length ? ` (${bestFacts.join(', ')})` : ''}.`;
      const plus = [...facts, ...notes.good];
      const text = cls === 'book' ? `${opening}.${plus.length ? ` ${cap(plus.join(', '))}.` : ''}`
        : cls === 'brilliant' ? 'Thí quân mà thế cờ vẫn tốt cho bạn.'
          : cls === 'great' ? `Nước duy nhất giữ được thế cờ${plus.length ? `: ${plus.join(', ')}` : ''}.`
            : cls === 'inaccuracy' ? [notes.bad.length ? `${cap(notes.bad.join(', '))}.` : cons, better].filter(Boolean).join(' ')
              : BAD.includes(cls) ? [cons, notes.bad.length ? `${cap(notes.bad.join(', '))}.` : '', better].filter(Boolean).join(' ')
                : plus.length ? `${plus.join(', ')}.` : null;
      setGrades((gr) => ({ ...gr, [ply]: { cls, text, before: a.pawns, after, best: a.best } }));
      setEvalPawns(after);
      putEval(ply, after);
    }
    await bossTurn(my, t0);
  };

  const onSquare = (sq: string) => {
    unlockAudio();
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

  // Tên khai cuộc gần nhất (như dòng "Caro-Kann Defense" trên Chess.com): lùi từ thế cờ hiện tại tới thế cờ có tên
  useEffect(() => {
    let alive = true;
    void (async () => {
      for (let i = history.length - 1; i >= Math.max(0, history.length - 40); i--) {
        const name = await bookName(history[i].after);
        if (name) { if (alive) setOpeningName(name); return; }
      }
      if (alive) setOpeningName('');
    })();
    return () => { alive = false; };
  }, [history]);

  // Giữ nước đang xem (hoặc nước mới nhất) trong tầm nhìn của danh sách nước
  useEffect(() => {
    movesRef.current?.querySelector('.cur')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [history, view]);

  const undo = () => {
    gen.current++;
    engine.current!.stop();
    game.undo();
    if (game.turn() !== meRef.current) game.undo(); // về lượt người chơi
    const n = game.history().length;
    setGrades((gr) => Object.fromEntries(Object.entries(gr).filter(([k]) => Number(k) < n)));
    setEvals((ev) => Object.fromEntries(Object.entries(ev).filter(([k]) => Number(k) < n)));
    sync(); setHint(0); setSel(null); setPromo(null); setOver(''); setResult(undefined); setEndCard(false);
    begin(); // cầm Đen mà lùi về đầu ván thì boss đi lại nước đầu
  };

  const newGame = (me: Color) => {
    unlockAudio();
    setGameId(startGame(boss.id, me).id);
    gen.current++;
    engine.current!.stop();
    engine.current!.newGame();
    game.reset();
    meRef.current = me;
    setColor(me);
    sync(); setHint(0); setSel(null); setPromo(null); setOver(''); setResult(undefined); setGrades({}); setEvals({}); setEvalPawns(null); setMenu(false); setSheet(false);
    setEndCard(false); setIntro(true);
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
  const viewing = view !== null;
  const shown = viewing ? (view >= 0 ? history[view] : undefined) : last; // nước tô vàng
  if (shown) { add(shown.from, 'last'); add(shown.to, 'last'); }
  if (sel && phase === 'you' && !viewing) {
    add(sel, 'sel');
    for (const m of new Chess(fen).moves({ square: sel as Square, verbose: true })) add(m.to, m.captured ? 'cap' : 'dot');
  }
  const arrows: Arrow[] = [];
  if (phase === 'you' && analysis && hint >= 1 && !viewing) add(analysis.best.slice(0, 2), 'hint');
  if (phase === 'you' && analysis && hint === 2 && !viewing) arrows.push({ from: analysis.best.slice(0, 2), to: analysis.best.slice(2, 4), kind: 'coach' });

  const gradeText: ReactNode = myGrade ? <><Badge cls={myGrade.cls} inline />{MOVE_CLASS[myGrade.cls].label}{myGrade.text ? `: ${myGrade.text}` : '.'}</> : null;
  // Lời coach cho nước của boss: boss vừa làm gì, và quân nào của bạn đang bị đe dọa
  const bossFacts = last && !mine(history.length - 1) ? describeMove(last.before, last.san) : [];
  const danger = phase === 'you' ? threatened(new Chess(fen), color)[0] : undefined;
  const turnLine = [
    last && !mine(history.length - 1) ? `${boss.name} vừa đi ${viSan(last.san)}${bossFacts.length ? `: ${bossFacts.join(', ')}` : ''}.` : '',
    danger ? `Chú ý: ${PIECE_VI[danger.type]} ở ${danger.square} của bạn đang bị đe dọa.` : '',
    'Lượt bạn.',
    !danger && phase === 'you' ? planTip(fen, color, history.length) ?? '' : '',
  ].filter(Boolean).join(' ');
  const badMove = myGrade && (myGrade.cls === 'mistake' || myGrade.cls === 'blunder');
  let text: ReactNode, sub: ReactNode = null, tone = 'plain', actions: ReactNode = null;
  if (viewing) {
    const m = view >= 0 ? history[view] : null;
    text = m ? `Đang xem nước ${Math.floor(view / 2) + 1}${view % 2 ? '…' : '.'} ${viSan(m.san)} (${mine(view) ? 'bạn' : boss.name})` : 'Đang xem thế cờ ban đầu';
    const g = m ? grades[view] : undefined;
    sub = g ? <><Badge cls={g.cls} inline />{MOVE_CLASS[g.cls].label}{g.text ? `: ${g.text}` : '.'}</> : null;
    actions = <button type="button" className="btn primary" onClick={() => setView(null)}>Về thế cờ hiện tại</button>;
  } else if (phase === 'loading') { text = 'Đang tải engine (1,8 MB)…'; tone = 'wait'; }
  else if (phase === 'error') {
    text = `Không tải được engine: ${error}`; tone = 'error';
    actions = <button type="button" className="btn secondary" onClick={() => { setPhase('loading'); void startEngine(); }}>Tải lại engine</button>;
  } else if (phase === 'over') {
    text = over; sub = gradeText;
    actions = <>
      {result && <a className="btn primary" href={`#/review/${encodeURIComponent(gameId)}`}>Xem lại ván</a>}
      <button type="button" className="btn secondary" onClick={() => setSheet(true)}>Ván mới</button>
    </>;
  } else if (phase === 'thinking') {
    text = gradeText ?? (history.length && mine(history.length - 1) ? 'Coach đang xem nước của bạn…' : `${boss.name} đi trước.`);
    sub = `${boss.name} đang nghĩ…`;
  } else if (hint > 0 && !analysis) { text = 'Đang tìm gợi ý…'; tone = 'wait'; }
  else if (hint === 1 && analysis) {
    const p = new Chess(fen).get(analysis.best.slice(0, 2) as Square);
    text = `Gợi ý: tìm nước cho ${p ? PIECE_VI[p.type as PieceType] : 'quân'} ở ${analysis.best.slice(0, 2)}.`; tone = 'coach';
  } else if (hint === 2 && analysis) {
    text = `Nước máy chọn: ${viSan(analysis.bestSan)}.${analysis.replySan ? ` ${boss.name} có thể đáp ${viSan(analysis.replySan)}.` : ''}`; tone = 'coach';
  } else if (gradeText) {
    text = gradeText; sub = turnLine;
    if (badMove && hint === 0) actions = <>
      <button type="button" className="btn primary" onClick={undo}>Đi lại</button>
      <button type="button" className="btn secondary" onClick={() => { undo(); setHint(2); }}>Xem nước tốt hơn</button>
    </>;
  }
  else text = history.length ? turnLine : `Lượt bạn. Bạn cầm ${color === 'w' ? 'Trắng, đi trước' : 'Đen'}.`;

  // Kết thúc ván: huy hiệu trên hai vua, ô vua bị chiếu hết nhấp nháy, thẻ kết quả
  const fenGame = new Chess(fen);
  const mate = fenGame.isCheckmate();
  const kingSq = (c: Color) => fenGame.findPiece({ type: 'k', color: c })[0];
  const opp: Color = color === 'w' ? 'b' : 'w';
  const kings: { square: string; kind: 'win' | 'lose' | 'draw' }[] = phase !== 'over' || !result ? []
    : result === 'draw' ? [{ square: kingSq('w'), kind: 'draw' }, { square: kingSq('b'), kind: 'draw' }]
      : [{ square: kingSq(color), kind: result === 'win' ? 'win' : 'lose' }, { square: kingSq(opp), kind: result === 'win' ? 'lose' : 'win' }];
  if (phase === 'over' && mate) add(kingSq(fenGame.turn()), 'mated');
  const n = Math.ceil(history.length / 2);
  const endTitle = result === 'win' ? 'Bạn thắng!' : result === 'loss' ? 'Bạn thua' : 'Hòa';
  const endSub = mate ? (result === 'win' ? `Chiếu hết sau ${n} nước` : `${boss.name} chiếu hết sau ${n} nước`)
    : result === 'loss' ? 'Bạn đã bỏ ván'
      : fenGame.isStalemate() ? 'Bên đi không còn nước hợp lệ' : game.isThreefoldRepetition() ? 'Lặp lại thế cờ ba lần'
        : fenGame.isInsufficientMaterial() ? 'Không đủ quân để chiếu hết' : 'Luật 50 nước';
  const score = result === 'win' ? '1 – 0' : result === 'loss' ? '0 – 1' : '½ – ½';
  const bossPiece = boss.piece.replace(/^./, color === 'w' ? 'b' : 'w');

  const diff = color === 'w' ? material(fen) : -material(fen); // theo phía người chơi
  const canUndo = (phase === 'you' || phase === 'over') && history.some((_, i) => mine(i));
  const inProgress = phase !== 'over' && history.length > 0;

  return (
    <div className="play" data-phase={phase}>
      <div className="play-main">
        <div className="player opp">
          <span className="avatar xs"><img src={`pieces/${bossPiece}.svg`} alt="" /></span>
          <span className="pname">{boss.name}</span>
          {diff < 0 && <span className="mat num">+{-diff}</span>}
          {phase === 'thinking' && <span className="thinking">đang nghĩ…</span>}
        </div>
        <div className="board-wrap">
          <EvalBar pawns={evalPawns} me={color} />
          <Board key={gameId} fen={viewing ? (view >= 0 ? history[view].after : new Chess().fen()) : fen} marks={marks} arrows={viewing ? [] : arrows}
            onSquare={viewing ? undefined : onSquare} orientation={color} label={`Bàn cờ, ván với ${boss.name}`}
            slides={viewing ? [] : slide?.moves} slideKey={slide?.key} kings={viewing ? [] : kings} intro={intro}
            badge={viewing ? (view >= 0 && grades[view] ? { square: history[view].to, cls: grades[view].cls } : null)
              : myGrade && !badgeHidden ? { square: history[myPly].to, cls: myGrade.cls } : null} />
          {intro && <div className="intro-chip" role="status">Bắt đầu! Bạn cầm {color === 'w' ? 'Trắng, đi trước' : 'Đen'}</div>}
          {endCard && phase === 'over' && (
            <div className={`endcard end-${result ?? 'draw'}`} role="dialog" aria-label="Kết quả ván">
              {result === 'win' && <div className="confetti" aria-hidden="true">{CONFETTI.map((c, i) => <i key={i} style={c} />)}</div>}
              <p className="end-title">{endTitle}</p>
              <p className="end-sub">{endSub}</p>
              <div className="end-players">
                <span className="end-p"><img src={`pieces/${color}K.svg`} alt="" />Bạn</span>
                <b className="num end-score">{score}</b>
                <span className="end-p"><img src={`pieces/${bossPiece}.svg`} alt="" />{boss.name}</span>
              </div>
              <div className="end-actions">
                <a className="btn primary" href={`#/review/${encodeURIComponent(gameId)}`}>Xem lại ván</a>
                <button type="button" className="btn secondary" onClick={() => setSheet(true)}>Ván mới</button>
                <button type="button" className="btn ghost end-close" onClick={() => setEndCard(false)}>Xem bàn cờ</button>
              </div>
            </div>
          )}
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
                <label className="menu-item"><span>Âm thanh</span>
                  <input type="checkbox" className="switch" checked={sound}
                    onChange={(e) => { setSound(e.target.checked); setSoundOn(e.target.checked); if (e.target.checked) { unlockAudio(); sounds.start(); } }} /></label>
                <button type="button" className="menu-item danger" disabled={phase === 'over'}
                  onClick={() => { if (confirm(`Bỏ ván với ${boss.name}? Ván sẽ tính là thua.`)) { setMenu(false); finish('Bạn đã bỏ ván.', 'loss'); } }}>Bỏ ván này</button>
                <a className="menu-item" href="#/bench">Đo engine trên máy này</a>
              </div>
            )}
          </div>
        </header>
        <section className={`coach tone-${tone}`} aria-live="polite">
          <img className="coach-avatar" src="icons/icon.svg" alt="Coach" width="36" height="36" />
          <div className="coach-bubble">
            <p className="coach-text">{text}</p>
            {sub && <p className="coach-sub muted">{sub}</p>}
            {actions && <div className="coach-actions">{actions}</div>}
          </div>
        </section>
        <section className="moves-panel" aria-label="Các nước đã đi">
          <header className="moves-head">
            <span className="opening">{openingName || (history.length ? 'Ngoài sách khai cuộc' : 'Thế cờ ban đầu')}</span>
            <span className="moves-nav">
              <button type="button" className="icon-btn sm" aria-label="Nước trước" disabled={(view ?? history.length - 1) < 0}
                onClick={() => setView((view ?? history.length - 1) - 1)}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
              </button>
              <button type="button" className="icon-btn sm" aria-label="Nước sau" disabled={!viewing}
                onClick={() => setView(view! + 1 >= history.length - 1 ? null : view! + 1)}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
              </button>
            </span>
          </header>
          <ol className="moves" ref={movesRef}>
            {history.map((m, i) => [
              i % 2 === 0 && <li key={`n${i}`} className="mn num">{i / 2 + 1}.</li>,
              <li key={i} className={`mv${(viewing ? view === i : i === history.length - 1) ? ' cur' : ''}`}>
                <button type="button" onClick={() => setView(i === history.length - 1 ? null : i)}>
                  {viSan(m.san)}
                  {grades[i] && <Badge cls={grades[i].cls} mini />}
                </button>
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
