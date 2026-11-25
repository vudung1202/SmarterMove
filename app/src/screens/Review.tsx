import { Chess, type Move, type Square } from 'chess.js';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { bossById } from '../bosses.ts';
import { Badge } from '../components/Badge.tsx';
import { Board, type Arrow } from '../components/Board.tsx';
import { EvalChart } from '../components/EvalChart.tsx';
import { ANALYSIS, Engine } from '../engine/engine.ts';
import { classify, consequence, MOVE_CLASS, signed, toPawns, viSan, type MoveClass } from '../lib/coach.ts';
import { getGame, putGame } from '../lib/history.ts';
import type { GameRecord } from '../lib/progress.ts';
import { BAD, backfill, fensOf, isMine, keyMoments, missingPositions } from '../lib/review.ts';

type Sel = { kind: 'moment'; ply: number } | { kind: 'ply'; ply: number }; // ply −1 = thế cờ ban đầu
interface Retry { ply: number; sel: string | null; tried: Move | null; busy: boolean; msg: string; ok: boolean; showBest: boolean }

const ORDER: MoveClass[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder'];
const uciArrow = (u: string, kind: Arrow['kind']): Arrow => ({ from: u.slice(0, 2), to: u.slice(2, 4), kind });
const dateText = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };

export function Review({ id }: { id: string }) {
  const [rec, setRec] = useState<GameRecord | null | undefined>(undefined); // undefined = đang tải, null = không có ván
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  const [retry, setRetry] = useState<Retry | null>(null);
  const engine = useRef<Engine | null>(null);
  const getEngine = async () => (engine.current ??= (await Engine.create()).engine);

  // Mở ván; ván thiếu số liệu (chơi trước Mốc 4) thì phân tích bổ sung một lần rồi lưu lại
  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await getGame(id);
      if (!r) { if (alive) setRec(null); return; }
      if (!missingPositions(r).length) { if (alive) setRec(r); return; }
      setProgress([0, missingPositions(r).length]);
      const full = await backfill(r, await getEngine(), bossById(r.bossId).name, (d, t) => alive && setProgress([d, t]));
      await putGame(full);
      if (alive) { setProgress(null); setRec(full); }
    })();
    return () => { alive = false; engine.current?.terminate(); engine.current = null; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (rec === undefined || progress) {
    return (
      <div className="page review">
        <header className="title-row"><div><h1>Xem lại ván</h1>
          <p className="sub">{progress ? `Đang phân tích ván lần đầu: ${progress[0]}/${progress[1]} thế cờ. Lần sau mở sẽ không phải chờ.` : 'Đang mở ván…'}</p>
        </div></header>
        {progress && <div className="track review-progress"><span style={{ width: `${(progress[0] / Math.max(1, progress[1])) * 100}%` }} /></div>}
      </div>
    );
  }
  if (rec === null) {
    return <div className="page review"><header className="title-row"><div><h1>Không tìm thấy ván</h1><p className="sub"><a className="card-link" href="#/">Về chọn đối thủ</a></p></div></header></div>;
  }

  const boss = bossById(rec.bossId);
  const fens = fensOf(rec.sans);
  const moves = new Chess();
  const history = rec.sans.map((s) => moves.move(s));
  const moments = keyMoments(rec);
  const evals = rec.evals ?? {};
  const worst = moments.reduce<number | null>((w, p) => (w == null || (rec.grades[p].before! - rec.grades[p].after!) > (rec.grades[w].before! - rec.grades[w].after!) ? p : w), null);
  const cur: Sel = sel ?? (worst != null ? { kind: 'moment', ply: worst } : { kind: 'ply', ply: rec.sans.length - 1 });
  const n = (ply: number) => Math.floor(ply / 2) + 1;
  const resultText = rec.result === 'win' ? 'Bạn thắng' : rec.result === 'loss' ? 'Bạn thua' : 'Hòa';
  const finding = `${resultText} sau ${Math.ceil(rec.sans.length / 2)} nước (${rec.reason.replace(/\.$/, '').toLowerCase()}). ` + (worst != null
    ? `Lỗi đắt nhất: nước ${n(worst)}, ${viSan(rec.sans[worst])}, thế cờ từ ${signed(rec.grades[worst].before!)} xuống ${signed(rec.grades[worst].after!)}.`
    : 'Không có nước sai đáng kể.');

  // ---------- bàn cờ ----------
  let fen: string, arrows: Arrow[] = [], badge: { square: string; cls: MoveClass } | null = null, onSquare: ((sq: string) => void) | undefined;
  const marks: Record<string, string[]> = {};
  const add = (sq: string, c: string) => (marks[sq] = [...(marks[sq] ?? []), c]);
  if (retry) {
    const g = rec.grades[retry.ply];
    fen = retry.tried ? retry.tried.after : fens[retry.ply];
    if (retry.tried) { add(retry.tried.from, 'last'); add(retry.tried.to, 'last'); arrows.push(uciArrow(retry.tried.lan, retry.ok ? 'coach' : 'bad')); }
    if (retry.showBest && g.best) arrows.push(uciArrow(g.best, 'coach'));
    if (retry.sel) {
      add(retry.sel, 'sel');
      for (const m of new Chess(fen).moves({ square: retry.sel as Square, verbose: true })) add(m.to, m.captured ? 'cap' : 'dot');
    }
    if (!retry.tried && !retry.busy) onSquare = (sq) => tryRetry(sq);
  } else if (cur.kind === 'moment') {
    fen = fens[cur.ply];
    const prev = history[cur.ply - 1];
    if (prev) { add(prev.from, 'last'); add(prev.to, 'last'); }
    arrows = [uciArrow(history[cur.ply].lan, 'bad')];
    if (rec.grades[cur.ply].best) arrows.push(uciArrow(rec.grades[cur.ply].best!, 'coach'));
  } else {
    fen = fens[cur.ply + 1];
    const m = history[cur.ply];
    if (m) { add(m.from, 'last'); add(m.to, 'last'); if (rec.grades[cur.ply]) badge = { square: m.to, cls: rec.grades[cur.ply].cls }; }
  }

  // ---------- thử lại từ khoảnh khắc ----------
  function tryRetry(sq: string) {
    if (!retry) return;
    const g = new Chess(fens[retry.ply]);
    const p = g.get(sq as Square);
    if (p && p.color === g.turn()) return setRetry({ ...retry, sel: retry.sel === sq ? null : sq });
    if (!retry.sel) return;
    let mv: Move;
    try { mv = g.move({ from: retry.sel, to: sq, promotion: 'q' }); } catch { return setRetry({ ...retry, sel: null }); } // shortcut: luôn phong hậu
    const base = { ...retry, sel: null, tried: mv, busy: true, msg: 'Coach đang xem nước của bạn…', ok: false };
    setRetry(base);
    void (async () => {
      const grade = rec!.grades[base.ply];
      const r = await (await getEngine()).search(mv.after, ANALYSIS, 'movetime 800');
      const after = r.info?.score ? -toPawns(r.info.score) : grade.before!;
      const isBest = mv.lan === grade.best;
      const cls = new Chess(mv.after).isCheckmate() ? 'best' : classify(grade.before!, after, isBest);
      const ok = !BAD.includes(cls);
      const msg = isBest || cls === 'best' ? `Đúng nước máy chọn: ${viSan(mv.san)}!`
        : ok ? `Đúng hướng: ${viSan(mv.san)} (${MOVE_CLASS[cls].label.toLowerCase()}).`
          : `${viSan(mv.san)} vẫn chưa ổn. ${r.best && r.best !== '(none)' && r.info?.score ? consequence(mv.after, r.best, r.info.score, boss.name) : ''}`;
      setRetry((cur) => (cur && cur.tried === mv ? { ...cur, busy: false, msg, ok } : cur));
    })();
  }

  // ---------- nội dung bên phải ----------
  const counts = ORDER.map((c) => [c, Object.entries(rec.grades).filter(([k, g]) => isMine(Number(k), rec.color) && g.cls === c).length] as const).filter(([, v]) => v > 0);
  const viewPly = retry ? retry.ply : cur.kind === 'moment' ? cur.ply - 1 : cur.ply; // vạch trên đồ thị
  const step = (d: number) => { setRetry(null); setSel({ kind: 'ply', ply: Math.max(-1, Math.min(rec.sans.length - 1, (cur.kind === 'ply' ? cur.ply : cur.ply - 1) + d)) }); };
  let detail: ReactNode = null;
  if (retry) {
    const g = rec.grades[retry.ply];
    detail = <>
      <p className="mline"><b>Thử lại nước {n(retry.ply)}.</b> {retry.tried ? '' : `Trong ván bạn đã đi ${viSan(rec.sans[retry.ply])}; tìm nước tốt hơn.`}</p>
      {retry.tried && <p className={`mline retry-msg ${retry.busy ? 'wait' : retry.ok ? 'ok' : 'bad'}`}>{retry.msg}</p>}
      <div className="mactions">
        {retry.tried && !retry.busy && <button type="button" className="btn primary" onClick={() => setRetry({ ...retry, tried: null, msg: '', ok: false, showBest: false })}>Thử lại</button>}
        {g.best && <button type="button" className="btn secondary" onClick={() => setRetry({ ...retry, showBest: true })}>Xem nước máy chọn</button>}
        <button type="button" className="btn ghost" onClick={() => setRetry(null)}>Thoát</button>
      </div>
    </>;
  } else if (cur.kind === 'moment') {
    const g = rec.grades[cur.ply];
    detail = <>
      <div className="mrow"><span className="mclass"><Badge cls={g.cls} inline />{MOVE_CLASS[g.cls].label}</span>
        <span className="swing num">{signed(g.before!)} <span className="muted">→</span> <b>{signed(g.after!)}</b></span></div>
      <p className="mline"><span className="key key-bad">Bạn đi</span> <b>{viSan(rec.sans[cur.ply])}</b>. {g.text}</p>
      <div className="mactions"><button type="button" className="btn primary" onClick={() => setRetry({ ply: cur.ply, sel: null, tried: null, busy: false, msg: '', ok: false, showBest: false })}>Thử lại nước {n(cur.ply)}</button></div>
    </>;
  } else if (cur.ply >= 0) {
    const g = rec.grades[cur.ply];
    detail = <p className="mline">{isMine(cur.ply, rec.color) ? 'Bạn' : boss.name} đi <b>{viSan(rec.sans[cur.ply])}</b>{g ? <> · <Badge cls={g.cls} inline />{MOVE_CLASS[g.cls].label}{g.text ? `: ${g.text}` : '.'}</> : '.'}
      {evals[cur.ply] != null && <span className="muted"> Thế cờ: {signed(evals[cur.ply])}.</span>}</p>;
  }

  return (
    <div className="page review">
      <header className="title-row review-head">
        <a className="icon-btn" href="#/" aria-label="Về chọn đối thủ">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </a>
        <div><h1>Ván với {boss.name}, {dateText(rec.endedAt)}</h1><p className="sub">{finding}</p></div>
      </header>
      <div className="review-top">
        <section className="review-board" aria-label="Bàn cờ xem lại">
          <Board fen={fen} marks={marks} arrows={arrows} badge={badge} orientation={rec.color} onSquare={onSquare} label="Bàn cờ xem lại" />
          <div className="ply-nav">
            <button type="button" className="icon-btn" aria-label="Nước trước" onClick={() => step(-1)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg></button>
            <span className="num">{retry ? `Thử lại nước ${n(retry.ply)}` : cur.kind === 'moment' ? `Trước nước ${n(cur.ply)}` : cur.ply < 0 ? 'Thế cờ ban đầu' : `Sau ${n(cur.ply)}${cur.ply % 2 ? '…' : '.'} ${viSan(rec.sans[cur.ply])}`}</span>
            <button type="button" className="icon-btn" aria-label="Nước sau" onClick={() => step(1)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg></button>
          </div>
        </section>
        <div className="review-side">
          <section className="panel moments" aria-labelledby="mom-h">
            <header><h2 id="mom-h">{moments.length ? `${moments.length === 3 ? 'Ba' : moments.length === 2 ? 'Hai' : 'Một'} khoảnh khắc đáng học` : 'Không có nước sai đáng kể'}</h2></header>
            {moments.length > 0 && (
              <div className="moment-tabs" role="tablist" style={{ gridTemplateColumns: `repeat(${moments.length}, minmax(0, 1fr))` }}>
                {moments.map((p) => (
                  <button key={p} type="button" role="tab" aria-selected={!retry && cur.kind === 'moment' && cur.ply === p} onClick={() => { setRetry(null); setSel({ kind: 'moment', ply: p }); }}>
                    <span className="num">Nước {n(p)}</span><span>{viSan(rec.sans[p])}</span>
                  </button>
                ))}
              </div>
            )}
            {detail}
          </section>
          <section className="panel chart-panel">
            <div className="chart-head"><h2>Thế cờ qua từng nước</h2><span className="meta">phía trên là bạn hơn</span></div>
            <EvalChart evals={evals} plies={rec.sans.length} marks={moments} current={viewPly} onPick={(p) => { setRetry(null); setSel({ kind: 'ply', ply: p }); }} />
          </section>
        </div>
      </div>
      <div className="grid lower">
        <section className="panel tally-panel">
          <header><h2>Nước của bạn</h2></header>
          <ul className="tally-list">
            {counts.map(([c, v]) => <li key={c}><Badge cls={c} inline />{MOVE_CLASS[c].label}<b className="num">{v}</b></li>)}
          </ul>
        </section>
        <section className="panel movelist-panel">
          <header><h2>Các nước</h2><span className="meta num">{rec.sans.length} nửa nước</span></header>
          <ol className="movelist">
            {/* mỗi <li> là một cặp nước (số thứ tự + Trắng + Đen) để không bao giờ rớt dòng giữa cặp */}
            {rec.sans.map((_, i) => i).filter((i) => i % 2 === 0).map((i) => (
              <li key={i}>
                <span className="mn num">{n(i)}.</span>
                {[i, i + 1].filter((k) => k < rec.sans.length).map((k) => (
                  <button key={k} type="button" aria-current={!retry && cur.kind === 'ply' && cur.ply === k ? true : undefined}
                    onClick={() => { setRetry(null); setSel({ kind: 'ply', ply: k }); }}>
                    {viSan(rec.sans[k])}{rec.grades[k] && <Badge cls={rec.grades[k].cls} mini />}
                  </button>
                ))}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
