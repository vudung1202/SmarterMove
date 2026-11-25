// Âm thanh tự tổng hợp bằng Web Audio (không cần file, không vướng giấy phép).
// iOS chỉ cho phát sau khi người dùng chạm: gọi unlockAudio() trong một sự kiện bấm (Bắt đầu ván, chạm bàn cờ).
const KEY = 'nuoc-hay:sound';
let ctx: AudioContext | null = null;

export const soundOn = () => localStorage.getItem(KEY) !== '0';
export const setSoundOn = (on: boolean) => localStorage.setItem(KEY, on ? '1' : '0');

/** Tạo/đánh thức AudioContext; phải gọi trong lúc xử lý một cú chạm. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null; // trình duyệt không hỗ trợ: im lặng
  }
}

/** Một nốt: tần số (Hz), bắt đầu sau `at` giây, dài `dur` giây, âm lượng tắt dần. */
function note(freq: number, at: number, dur: number, type: OscillatorType = 'triangle', vol = 0.16) {
  if (!ctx || ctx.state === 'closed') return; // 'suspended' vẫn xếp lịch: nốt sẽ vang khi resume() xong
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const play = (notes: [number, number, number][]) => { if (soundOn()) notes.forEach(([f, at, d]) => note(f, at, d)); };

// Tần số: C5 523, E5 659, G5 784, C6 1047, A4 440, F4 349, D4 294
export const sounds = {
  start: () => play([[523, 0, 0.18], [784, 0.1, 0.28]]),
  win: () => play([[523, 0, 0.16], [659, 0.11, 0.16], [784, 0.22, 0.16], [1047, 0.33, 0.5]]),
  lose: () => play([[440, 0, 0.22], [349, 0.16, 0.22], [294, 0.32, 0.5]]),
  draw: () => play([[523, 0, 0.22], [523, 0.2, 0.4]]),
};
