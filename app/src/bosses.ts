import type { Options } from './engine/engine.ts';

export interface Boss {
  id: string;
  name: string;
  elo: number;
  piece: string;
  style: string;
  /** setoption gửi trước mỗi nước của boss */
  options: Options;
  /** phần sau lệnh UCI go */
  go: string;
  /** boss không bao giờ đáp nhanh hơn mức này, cho giống người */
  minDelayMs: number;
  /** xác suất đi một nước hợp lệ ngẫu nhiên thay vì hỏi engine (boss yếu dưới mức UCI_Elo 1320) */
  blunder?: number;
}

// Hậu Bạc/Vua Vàng nghĩ tới 3/5 giây: iPhone chỉ ~25 nghìn thế cờ/giây, nghĩ ngắn hơn thì yếu hơn nhãn Elo.
// shortcut: Elo là mục tiêu, chưa đo. Mốc 3 hiệu chỉnh bằng ván thử; Stockfish 19 lite không cho UCI_Elo dưới 1320,
// nên hai boss thấp dùng Skill Level.
export const BOSSES: Boss[] = [
  { id: 'tot-nho', name: 'Tốt Nhỏ', elo: 600, piece: 'bP', style: 'Hay để quân bị bắt, hiếm khi thấy đòn chiếu.',
    options: { UCI_LimitStrength: false, 'Skill Level': 0 }, go: 'depth 2 movetime 300', minDelayMs: 900, blunder: 0.32 },
  { id: 'ma-non', name: 'Mã Non', elo: 1000, piece: 'bN', style: 'Bắt được quân bị bỏ không, chưa tính xa.',
    options: { UCI_LimitStrength: false, 'Skill Level': 0 }, go: 'depth 4 movetime 600', minDelayMs: 800, blunder: 0.09 },
  { id: 'tuong-go', name: 'Tượng Gỗ', elo: 1400, piece: 'bB', style: 'Ít bỏ quân, đã thấy đòn hai bước.',
    options: { 'Skill Level': 20, UCI_LimitStrength: true, UCI_Elo: 1400 }, go: 'depth 12 movetime 800', minDelayMs: 700 },
  { id: 'xe-sat', name: 'Xe Sắt', elo: 1800, piece: 'bR', style: 'Phạt nước hở, tàn cuộc chắc tay.',
    options: { 'Skill Level': 20, UCI_LimitStrength: true, UCI_Elo: 1800 }, go: 'depth 14 movetime 900', minDelayMs: 600 },
  { id: 'hau-bac', name: 'Hậu Bạc', elo: 2200, piece: 'bQ', style: 'Ép thế liên tục, hiếm khi để lọt đòn chiến thuật.',
    options: { 'Skill Level': 20, UCI_LimitStrength: true, UCI_Elo: 2200 }, go: 'depth 16 movetime 3000', minDelayMs: 500 },
  { id: 'vua-vang', name: 'Vua Vàng', elo: 2600, piece: 'bK', style: 'Tính sâu, giữ ưu thế và chuyển hóa gọn như kiện tướng.',
    options: { 'Skill Level': 20, UCI_LimitStrength: true, UCI_Elo: 2600 }, go: 'depth 18 movetime 5000', minDelayMs: 500 },
];

export const bossById = (id: string) => BOSSES.find((b) => b.id === id) ?? BOSSES[1];
