import { Chess } from 'chess.js';
import type { CSSProperties } from 'react';
import { PIECE_VI, type MoveClass } from '../lib/coach.ts';
import { Badge } from './Badge.tsx';

const FILES = 'abcdefgh';
export type Arrow = { from: string; to: string; kind: 'coach' | 'bad' };

interface Props {
  fen: string;
  /** lớp CSS thêm cho từng ô: last, sel, hint, dot, cap */
  marks?: Record<string, string[]>;
  arrows?: Arrow[];
  onSquare?: (sq: string) => void;
  /** huy hiệu đánh giá nước, ở góc trên phải ô đích */
  badge?: { square: string; cls: MoveClass } | null;
  /** phía ở dưới bàn cờ */
  orientation?: 'w' | 'b';
  coords?: boolean;
  /** quân vừa đi trượt từ `from` tới `to` (nhập thành có 2 cặp); `slideKey` đổi thì chạy lại hiệu ứng */
  slides?: { from: string; to: string }[];
  slideKey?: string | number;
  label: string;
}

function ArrowShape({ from, to, kind, flip }: Arrow & { flip: boolean }) {
  const xy = (sq: string) => flip ? [7 - FILES.indexOf(sq[0]) + 0.5, Number(sq[1]) - 1 + 0.5] : [FILES.indexOf(sq[0]) + 0.5, 8 - Number(sq[1]) + 0.5];
  const [x1, y1] = xy(from), [x2, y2] = xy(to);
  const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const hx = x2 - ux * 0.42, hy = y2 - uy * 0.42;
  const head = `${x2 - ux * 0.08},${y2 - uy * 0.08} ${hx - uy * 0.24},${hy + ux * 0.24} ${hx + uy * 0.24},${hy - ux * 0.24}`;
  return (
    <g className={`arrow arrow-${kind}`}>
      <line x1={x1 + ux * 0.2} y1={y1 + uy * 0.2} x2={hx} y2={hy} strokeWidth={0.17} strokeLinecap="round" />
      <polygon points={head} />
    </g>
  );
}

export function Board({ fen, marks = {}, arrows = [], onSquare, badge, orientation = 'w', coords = true, slides = [], slideKey, label }: Props) {
  const flip = orientation === 'b';
  // vị trí ô trên màn hình (cột, hàng), đã tính chiều lật bàn cờ
  const pos = (sq: string) => { const f = FILES.indexOf(sq[0]), r = 8 - Number(sq[1]); return flip ? [7 - f, 7 - r] : [f, r]; };
  const c = new Chess(fen);
  const grid = c.board();
  const check = c.inCheck() ? c.findPiece({ type: 'k', color: c.turn() })[0] : null;
  const cells = [];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const r = flip ? 7 - i : i, f = flip ? 7 - j : j; // i, j: hàng/cột trên màn hình
      const sq = FILES[f] + (8 - r);
      const p = grid[r][f];
      const cls = ['sq', (r + f) % 2 ? 'dark' : 'light', ...(marks[sq] ?? []), sq === check ? 'check' : ''].join(' ');
      const inner = (
        <>
          {coords && i === 7 && <span className="coord file">{FILES[f]}</span>}
          {coords && j === 0 && <span className="coord rank">{8 - r}</span>}
          {p && (() => {
            const s = slides.find((x) => x.to === sq);
            const img = <img src={`pieces/${p.color}${p.type.toUpperCase()}.svg`} alt="" draggable={false} />;
            if (!s) return <span className="piece">{img}</span>;
            const [fx, fy] = pos(s.from), [tx, ty] = pos(s.to);
            return <span key={slideKey} className="piece slide" style={{ '--dx': fx - tx, '--dy': fy - ty } as CSSProperties}>{img}</span>;
          })()}
          {badge?.square === sq && <Badge cls={badge.cls} />}
        </>
      );
      cells.push(onSquare ? (
        <button key={sq} type="button" className={cls} onClick={() => onSquare(sq)}
          aria-label={p ? `${sq}, ${PIECE_VI[p.type]} ${p.color === 'w' ? 'trắng' : 'đen'}` : sq}>{inner}</button>
      ) : <div key={sq} className={cls}>{inner}</div>);
    }
  }
  return (
    <div className="board" role={onSquare ? 'grid' : 'img'} aria-label={label}>
      {cells}
      <svg className="arrows" viewBox="0 0 8 8" aria-hidden="true">
        {arrows.map((a) => <ArrowShape key={a.from + a.to + a.kind} {...a} flip={flip} />)}
      </svg>
    </div>
  );
}
