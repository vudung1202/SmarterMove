import { MOVE_CLASS, type MoveClass } from '../lib/coach.ts';

/** Huy hiệu đánh giá nước: trên ô cờ (góc trên phải) hoặc nằm trong dòng chữ (`inline`). */
export function Badge({ cls, inline = false }: { cls: MoveClass; inline?: boolean }) {
  return (
    <span className={`badge${inline ? ' inline' : ''} badge-${cls}`} title={MOVE_CLASS[cls].label} aria-hidden={inline}>
      {cls === 'book' ? (
        <svg viewBox="0 0 16 16" width="62%" height="62%" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M2 3.5c1.8-.5 4-.3 6 1 2-1.3 4.2-1.5 6-1v9c-1.8-.5-4-.3-6 1-2-1.3-4.2-1.5-6-1z" /><path d="M8 4.5v9" />
        </svg>
      ) : MOVE_CLASS[cls].glyph}
    </span>
  );
}
