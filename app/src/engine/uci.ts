// Đọc dòng UCI của Stockfish. Thuần (không DOM) để test bằng node --test.

/** Điểm theo góc nhìn bên đang đi: centipawn hoặc số nước đến chiếu hết (âm = bên đi bị chiếu hết). */
export type Score = { cp: number } | { mate: number };

export interface Info {
  depth: number;
  score?: Score;
  nps?: number;
  pv: string[];
}

export function parseInfo(line: string): Info | null {
  if (!line.startsWith('info ') || !line.includes(' depth ')) return null;
  const t = line.split(' ');
  const num = (key: string) => {
    const i = t.indexOf(key);
    return i >= 0 ? Number(t[i + 1]) : undefined;
  };
  // multipv > 1 là các biến phụ; chỉ lấy biến chính
  if ((num('multipv') ?? 1) !== 1) return null;
  const si = t.indexOf('score');
  const score: Score | undefined = si < 0 ? undefined : t[si + 1] === 'mate' ? { mate: Number(t[si + 2]) } : { cp: Number(t[si + 2]) };
  const pi = t.indexOf('pv');
  return { depth: num('depth') ?? 0, score, nps: num('nps'), pv: pi < 0 ? [] : t.slice(pi + 1) };
}

/** "bestmove e2e4 ponder e7e5" → "e2e4"; "(none)" khi hết nước (chiếu hết/hòa). */
export function parseBestMove(line: string): string | null {
  if (!line.startsWith('bestmove')) return null;
  return line.split(' ')[1] ?? null;
}
