import { useState } from 'react';
import type { Boss } from '../bosses.ts';
import type { Color } from '../lib/saved-game.ts';

interface Props {
  boss: Boss;
  /** câu cảnh báo khi đang có ván dở; null = không có */
  warning: string | null;
  initial?: Color;
  onStart: (color: Color) => void;
  onClose: () => void;
}

/** Hộp thoại bắt đầu ván: chọn màu quân (Ngẫu nhiên được bốc ngay khi bấm Bắt đầu). */
export function NewGameSheet({ boss, warning, initial = 'w', onStart, onClose }: Props) {
  const [pick, setPick] = useState<Color | 'random'>(initial);
  const start = () => onStart(pick === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : pick);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="new-title">
        <div className="sheet-body">
          <div className="sheet-head">
            <div className="avatar sm"><img src={`pieces/${boss.piece}.svg`} alt="" /></div>
            <div>
              <h2 id="new-title">Đấu với {boss.name}</h2>
              <p className="muted">khoảng {boss.elo.toLocaleString('vi')} Elo. {boss.style}</p>
              {warning && <p className="sheet-warn">{warning}</p>}
            </div>
          </div>
          <fieldset className="field">
            <legend>Bạn cầm quân</legend>
            <div className="segmented" role="group" aria-label="Màu quân">
              {([['w', 'Trắng'], ['b', 'Đen'], ['random', 'Ngẫu nhiên']] as const).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={pick === v} onClick={() => setPick(v)}>{l}</button>
              ))}
            </div>
          </fieldset>
          <div className="sheet-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Để sau</button>
            <button type="button" className="btn primary" onClick={start}>Bắt đầu ván</button>
          </div>
        </div>
      </div>
    </div>
  );
}
