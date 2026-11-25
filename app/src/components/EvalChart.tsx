import type { PointerEvent } from 'react';

interface Props {
  /** điểm sau mỗi nửa nước, góc người chơi; khóa −1 = thế cờ ban đầu */
  evals: Record<number, number>;
  plies: number;
  /** nửa nước của 3 khoảnh khắc (đánh dấu vạch dọc) */
  marks: number[];
  /** nửa nước đang xem (vạch mảnh) */
  current: number | null;
  onPick: (ply: number) => void;
}

const W = 600, H = 150, PAD = 6;

/** Đồ thị thế cờ cả ván: một đường màu coach, vạch 0 = cân bằng, trục cố định −10..+10. Chạm để nhảy tới nước đó. */
export function EvalChart({ evals, plies, marks, current, onPick }: Props) {
  const n = plies + 1; // số điểm: thế cờ ban đầu + sau mỗi nửa nước
  const x = (i: number) => PAD + ((i + 1) / Math.max(1, n - 1)) * (W - 2 * PAD); // i = −1..plies−1
  const y = (v: number) => H / 2 - (Math.max(-10, Math.min(10, v)) / 10) * (H / 2 - PAD);
  let d = '', last = 0;
  for (let i = -1; i < plies; i++) {
    const v = evals[i] ?? last; // điểm thiếu thì giữ mức trước, không bịa đường mới
    last = v;
    d += `${d ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
  }
  const area = `${d}L${x(plies - 1).toFixed(1)} ${H / 2}L${x(-1).toFixed(1)} ${H / 2}Z`;
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round((((e.clientX - r.left) / r.width) * W - PAD) / ((W - 2 * PAD) / Math.max(1, n - 1))) - 1;
    onPick(Math.max(-1, Math.min(plies - 1, i)));
  };
  return (
    <svg className="evalchart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onPointerUp={pick} role="img"
      aria-label="Đồ thị thế cờ qua từng nước, phía trên là bạn hơn">
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} className="ec-zero" />
      <line x1={0} x2={W} y1={y(5)} y2={y(5)} className="ec-grid" />
      <line x1={0} x2={W} y1={y(-5)} y2={y(-5)} className="ec-grid" />
      <path d={area} className="ec-area" />
      <path d={d} className="ec-line" />
      {marks.map((m) => <line key={m} x1={x(m)} x2={x(m)} y1={0} y2={H} className="ec-mark" />)}
      {current != null && <line x1={x(current)} x2={x(current)} y1={0} y2={H} className="ec-cur" />}
    </svg>
  );
}
