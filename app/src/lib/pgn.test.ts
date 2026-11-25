import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from 'chess.js';
import { bossById } from '../bosses.ts';
import { gamesToPgn, toPgn } from './pgn.ts';
import type { GameRecord } from './progress.ts';

const base = { id: 'x', bossId: 'ma-non', grades: {}, endedAt: '2026-11-25T10:00:00.000Z' };

test('ván chiếu hết: tên hai bên theo màu quân, kết quả đúng, đọc lại được', () => {
  const g: GameRecord = { ...base, color: 'b', sans: ['f3', 'e5', 'g4', 'Qh4#'], result: 'win', reason: 'Bạn chiếu hết Mã Non!' };
  const pgn = toPgn(g, bossById('ma-non'));
  assert.match(pgn, /\[White "Mã Non \(Nước Hay, ~1000\)"\]/);
  assert.match(pgn, /\[Black "Bạn"\]/);
  assert.match(pgn, /\[Result "0-1"\]/);
  const c = new Chess();
  c.loadPgn(pgn);
  assert.equal(c.history().length, 4);
});

test('bỏ ván giữa chừng vẫn ghi kết quả ở cuối', () => {
  const g: GameRecord = { ...base, color: 'w', sans: ['e4', 'e5'], result: 'loss', reason: 'Bạn đã bỏ ván.' };
  const pgn = gamesToPgn([g, g], bossById);
  assert.match(pgn, /\[Result "0-1"\]/);
  assert.equal(pgn.match(/ 0-1\n/g)?.length, 2);
});
