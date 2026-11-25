import type { GameRecord } from './progress.ts';

// Lịch sử ván đã kết thúc trong IndexedDB (localStorage sẽ đầy sau khoảng 1.000 ván).
const DB = 'nuoc-hay', STORE = 'games';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

/** Ghi (hoặc ghi đè cùng id) một ván đã kết thúc. */
export const putGame = (g: GameRecord) => run('readwrite', (s) => s.put(g));

/** Mọi ván đã kết thúc, mới nhất trước. */
export const listGames = () => run<GameRecord[]>('readonly', (s) => s.getAll()).then((gs) => gs.sort((a, b) => b.endedAt.localeCompare(a.endedAt)));

/** Một ván theo id, hoặc undefined. */
export const getGame = (id: string) => run<GameRecord | undefined>('readonly', (s) => s.get(id));
