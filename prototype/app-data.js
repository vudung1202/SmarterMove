// Dữ liệu mẫu của người chơi (KHÔNG do engine sinh) — thay bằng IndexedDB khi làm app thật.
// Riêng ván "a" (25/11, Tượng Gỗ) là ván thật trong data.js; các ván khác chỉ là lịch sử mẫu.
window.APP_DATA = {
  player: { name: 'Bạn' },
  today: '2026-11-25',
  // Luật lên cấp: thắng ít nhất 3 trong 5 ván gần nhất với boss đó.
  promote: { wins: 3, window: 5 },
  bosses: [
    { id: 'tot-nho', name: 'Tốt Nhỏ', elo: 600, piece: 'bP', style: 'Hay để quân bị bắt, hiếm khi thấy đòn chiếu.' },
    { id: 'ma-non', name: 'Mã Non', elo: 1000, piece: 'bN', style: 'Bắt được quân bị bỏ không, chưa tính xa.' },
    { id: 'tuong-go', name: 'Tượng Gỗ', elo: 1400, piece: 'bB', style: 'Ít bỏ quân, đã thấy đòn hai bước.' },
    { id: 'xe-sat', name: 'Xe Sắt', elo: 1800, piece: 'bR', style: 'Phạt nước hở, tàn cuộc chắc tay.' },
  ],
  // Mới nhất trước. moves = số nước (một nước = Trắng + Đen).
  history: [
    { id: 'a', date: '2026-11-25', boss: 'tuong-go', color: 'w', result: 'loss', moves: 26 },
    { id: 'h9', date: '2026-11-24', boss: 'ma-non', color: 'b', result: 'win', moves: 41 },
    { id: 'h8', date: '2026-11-24', boss: 'ma-non', color: 'w', result: 'draw', moves: 58 },
    { id: 'h7', date: '2026-11-23', boss: 'ma-non', color: 'w', result: 'loss', moves: 29 },
    { id: 'h6', date: '2026-11-22', boss: 'ma-non', color: 'b', result: 'win', moves: 36 },
    { id: 'h5', date: '2026-11-21', boss: 'tot-nho', color: 'w', result: 'win', moves: 24 },
    { id: 'h4', date: '2026-11-20', boss: 'tot-nho', color: 'b', result: 'win', moves: 31 },
    { id: 'h3', date: '2026-11-19', boss: 'tot-nho', color: 'w', result: 'loss', moves: 27 },
    { id: 'h2', date: '2026-11-18', boss: 'tot-nho', color: 'b', result: 'win', moves: 33 },
    { id: 'h1', date: '2026-11-17', boss: 'tot-nho', color: 'w', result: 'win', moves: 22 },
  ],
  // Ván đang dở = ván B trong data.js
  unfinished: { boss: 'ma-non', color: 'w', savedAt: '2026-11-25 14:05' },
};
