/** Khóa tra sách khai cuộc: FNV-1a 32-bit của 4 trường đầu FEN (bỏ đếm nước), dạng base36. */
export function bookKey(fen: string): string {
  const epd = fen.split(' ').slice(0, 4).join(' ');
  let h = 0x811c9dc5;
  for (let i = 0; i < epd.length; i++) h = Math.imul(h ^ epd.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}
