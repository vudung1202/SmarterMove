import { Chess } from 'chess.js';
import { useState } from 'react';
import { SAMPLE_GAME } from '../bench/sample-game.ts';
import { BOSSES } from '../bosses.ts';
import { ANALYSIS, Engine, HINT_GO } from '../engine/engine.ts';
import { duration as secs } from '../lib/coach.ts';

type Status = 'wait' | 'run' | 'ok' | 'bad' | 'info';
interface Row { id: string; label: string; target: string; value: string; status: Status }

const nf = (d: number) => new Intl.NumberFormat('vi', { minimumFractionDigits: d, maximumFractionDigits: d });

// Mục tiêu Mốc 1 (đo trên iPhone 14 Pro Max)
const BOSS_MAX_MS = 1000;
const HINT_MIN_DEPTH = 12; // shortcut: ngưỡng tạm, chỉnh sau khi so chất lượng gợi ý
const REVIEW_MAX_MS = 30000;
const REVIEW_GO = 'depth 12 movetime 300'; // trần 300 ms/thế cờ để máy chậm vẫn xong trong ~25 giây

// Các thế cờ đo lấy từ ván mẫu: khai cuộc, trung cuộc, tàn cuộc
const positions = (() => {
  const c = new Chess();
  const out: string[] = [c.fen()];
  SAMPLE_GAME.forEach((san) => { c.move(san); out.push(c.fen()); });
  return out;
})();
const PROBES = [10, 40, 70].map((i) => positions[i]);

const initialRows = (): Row[] => [
  { id: 'load', label: 'Tải engine', target: 'Ghi lại', value: '', status: 'wait' },
  { id: 'nps', label: 'Tốc độ tính (2 giây)', target: 'Ghi lại', value: '', status: 'wait' },
  ...BOSSES.map((b) => ({ id: b.id, label: `${b.name} đi nước`, target: `≤ ${secs(BOSS_MAX_MS)}`, value: '', status: 'wait' as Status })),
  { id: 'hint', label: 'Gợi ý: độ sâu trong 1,5 giây', target: `≥ ${HINT_MIN_DEPTH}`, value: '', status: 'wait' },
  { id: 'review', label: 'Review 40 nước (tối đa 300 ms/thế cờ)', target: `≤ ${secs(REVIEW_MAX_MS)}`, value: '', status: 'wait' },
];

export function Bench() {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const set = (id: string, value: string, status: Status) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, value, status } : r)));

  const run = async () => {
    setRunning(true); setError(''); setRows(initialRows());
    let engine: Engine | null = null;
    try {
      set('load', 'đang đo…', 'run');
      const created = await Engine.create();
      engine = created.engine;
      set('load', secs(created.loadMs), 'info');

      set('nps', 'đang đo…', 'run');
      const n = await engine.search(PROBES[1], ANALYSIS, 'movetime 2000');
      set('nps', `${nf(0).format(Math.round((n.info?.nps ?? 0) / 1000))} nghìn thế cờ/giây, depth ${n.info?.depth ?? '—'}`, 'info');

      for (const b of BOSSES) {
        set(b.id, 'đang đo…', 'run');
        const ms: number[] = [];
        for (const f of PROBES) ms.push((await engine.search(f, b.options, b.go)).ms);
        const max = Math.max(...ms), avg = ms.reduce((a, x) => a + x, 0) / ms.length;
        set(b.id, `TB ${secs(avg)}, chậm nhất ${secs(max)}`, max <= BOSS_MAX_MS ? 'ok' : 'bad');
      }

      set('hint', 'đang đo…', 'run');
      const depths: number[] = [];
      for (const f of PROBES) depths.push((await engine.search(f, ANALYSIS, HINT_GO)).info?.depth ?? 0);
      const minD = Math.min(...depths);
      set('hint', `depth ${depths.join(' / ')}`, minD >= HINT_MIN_DEPTH ? 'ok' : 'bad');

      engine.newGame();
      const t0 = performance.now();
      let minDepth = Infinity;
      for (let i = 0; i < positions.length; i++) {
        set('review', `${i}/${positions.length} thế cờ…`, 'run');
        minDepth = Math.min(minDepth, (await engine.search(positions[i], ANALYSIS, REVIEW_GO)).info?.depth ?? 0);
      }
      const total = performance.now() - t0;
      set('review', `${secs(total)} cho ${positions.length} thế cờ, depth thấp nhất ${minDepth}`, total <= REVIEW_MAX_MS ? 'ok' : 'bad');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      engine?.terminate();
      setRunning(false);
    }
  };

  const done = rows.every((r) => r.status !== 'wait' && r.status !== 'run');
  const fails = rows.filter((r) => r.status === 'bad').length;

  return (
    <div className="page bench">
      <header className="title-row">
        <div>
          <h1>Đo engine trên máy này</h1>
          <p className="sub">
            {running ? 'Đang đo, giữ màn hình sáng khoảng 1 phút.'
              : done ? (fails ? `${fails} mục chưa đạt mục tiêu. Chụp màn hình gửi lại để chỉnh cấu hình.` : 'Mọi mục đều đạt mục tiêu Mốc 1.')
              : 'Stockfish 19 lite chạy ngay trong trình duyệt. Bấm Đo rồi chụp màn hình kết quả.'}
          </p>
        </div>
      </header>
      <div className="bench-actions">
        <button type="button" className="btn primary big" disabled={running} onClick={() => void run()}>{running ? 'Đang đo…' : done ? 'Đo lại' : 'Đo'}</button>
        <a className="btn secondary big" href="#/">Về bàn cờ</a>
      </div>
      <section className="panel">
        <table>
          <thead><tr><th>Phép đo</th><th>Kết quả</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`st-${r.status}`}>
                <td>{r.label}<span className="sub">Mục tiêu: {r.target}</span></td>
                <td className="num val">{r.value || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && <p className="bench-error">Lỗi: {error}</p>}
      </section>
      <p className="credit num">
        {navigator.userAgent.replace(/^Mozilla\/5\.0 /, '')} · {navigator.hardwareConcurrency ?? '—'} nhân
      </p>
    </div>
  );
}
