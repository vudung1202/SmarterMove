import { parseBestMove, parseInfo, type Info } from './uci.ts';

export type Options = Record<string, string | number | boolean>;
export interface SearchResult {
  best: string | null;
  info: Info | null;
  ms: number;
}

/** Sức mạnh đầy đủ, dùng cho gợi ý, nhắc lỗi và review. */
export const ANALYSIS: Options = { UCI_LimitStrength: false, 'Skill Level': 20 };
/** Phân tích thế cờ lượt người chơi (gợi ý + mốc so sánh khi nhắc lỗi). Chạy trong lúc người chơi nghĩ và bị dừng sớm khi họ đi. */
export const HINT_GO = 'movetime 1500';

/**
 * Stockfish 19 lite (WASM, đơn luồng) trong một Web Worker.
 * Mọi lệnh search chạy tuần tự qua một hàng đợi, nên boss và phân tích dùng chung một engine.
 */
export class Engine {
  private listeners = new Set<(line: string) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private current: Options = {};
  private worker: Worker;

  private constructor(worker: Worker) {
    this.worker = worker;
    worker.onmessage = (e: MessageEvent) => this.listeners.forEach((f) => f(String(e.data)));
  }

  /** Tạo worker và đợi engine sẵn sàng. loadMs = tải file + khởi tạo WASM. */
  static async create(timeoutMs = 30000): Promise<{ engine: Engine; loadMs: number }> {
    const t0 = performance.now();
    const worker = new Worker(new URL('engine/stockfish-19-lite-single.js', document.baseURI));
    const engine = new Engine(worker);
    let timer = 0;
    const failed = new Promise<never>((_, reject) => {
      worker.onerror = (e) => reject(new Error(e.message || 'Không tải được engine'));
      timer = window.setTimeout(() => reject(new Error(`Engine không phản hồi sau ${timeoutMs / 1000} giây`)), timeoutMs);
    });
    try {
      engine.send('uci');
      await Promise.race([engine.until((l) => l === 'uciok'), failed]);
      engine.send('setoption name Hash value 16');
      await Promise.race([engine.ready(), failed]);
    } catch (err) {
      worker.terminate();
      throw err;
    } finally {
      clearTimeout(timer);
    }
    return { engine, loadMs: performance.now() - t0 };
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private until(test: (line: string) => boolean): Promise<string> {
    return new Promise((resolve) => {
      const f = (l: string) => {
        if (!test(l)) return;
        this.listeners.delete(f);
        resolve(l);
      };
      this.listeners.add(f);
    });
  }

  private ready() {
    this.send('isready');
    return this.until((l) => l === 'readyok');
  }

  /** Tìm nước ở thế cờ `fen`. `go` là phần sau lệnh UCI go, ví dụ "movetime 1000" hoặc "depth 12". */
  search(fen: string, options: Options, go: string): Promise<SearchResult> {
    const job = this.queue.then(async () => {
      for (const [k, v] of Object.entries(options)) {
        if (this.current[k] === v) continue;
        this.send(`setoption name ${k} value ${v}`);
        this.current[k] = v;
      }
      await this.ready();
      let info: Info | null = null;
      const onInfo = (l: string) => {
        const i = parseInfo(l);
        if (i && i.pv.length) info = i;
      };
      this.listeners.add(onInfo);
      const t0 = performance.now();
      this.send(`position fen ${fen}`);
      this.send(`go ${go}`);
      const line = await this.until((l) => l.startsWith('bestmove'));
      this.listeners.delete(onInfo);
      return { best: parseBestMove(line), info, ms: performance.now() - t0 };
    });
    this.queue = job.catch(() => undefined);
    return job;
  }

  /** Dừng lệnh search đang chạy; nó vẫn trả bestmove, người gọi tự bỏ kết quả cũ. */
  stop() {
    this.send('stop');
  }

  newGame() {
    this.send('ucinewgame');
  }

  terminate() {
    this.worker.terminate();
  }
}
