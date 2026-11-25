import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameRecord } from './progress.ts';
import { keyMoments, missingPositions } from './review.ts';

const rec = (over: Partial<GameRecord>): GameRecord =>
  ({ id: 'r', bossId: 'ma-non', color: 'w', sans: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], grades: {}, evals: {}, result: 'loss', reason: '', endedAt: '2026-11-25T10:00:00Z', ...over });

test('keyMoments: 3 nước kém tụt nhiều nhất của người chơi, theo thứ tự ván; bỏ nước của boss và nước tốt', () => {
  const r = rec({
    sans: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'd6', 'h3', 'h6'],
    grades: {
      0: { cls: 'best', text: null, before: 0.3, after: 0.3 },
      2: { cls: 'inaccuracy', text: null, before: 0.3, after: -0.4 },
      4: { cls: 'blunder', text: null, before: 0.2, after: -4 },
      6: { cls: 'mistake', text: null, before: -0.5, after: -1.8 },
      8: { cls: 'inaccuracy', text: null, before: -1.8, after: -2.4 },
      1: { cls: 'blunder', text: null, before: 0, after: 5 }, // nước của boss (Đen): không tính
    },
  });
  assert.deepEqual(keyMoments(r), [2, 4, 6]);
  assert.deepEqual(keyMoments(rec({})), []);
});

test('missingPositions: ván chơi trên app mới đủ dữ liệu thì không cần engine; ván cũ thì cần', () => {
  const full = rec({
    evals: { [-1]: 0.2, 0: 0.3, 1: 0.3, 2: 0.3, 3: 0.2, 4: 0.3, 5: 0.2 },
    grades: { 0: { cls: 'book', text: null, before: 0.2, after: 0.3, best: 'e2e4' }, 2: { cls: 'book', text: null, before: 0.3, after: 0.3, best: 'g1f3' }, 4: { cls: 'book', text: null, before: 0.2, after: 0.3, best: 'f1c4' } },
  });
  assert.deepEqual(missingPositions(full), []);
  assert.deepEqual(missingPositions(rec({})), [-1, 0, 1, 2, 3, 4, 5]);
  // ván kết thúc bằng chiếu hết: thế cờ cuối không cần engine
  assert.deepEqual(missingPositions(rec({ sans: ['f3', 'e5', 'g4', 'Qh4#'] })), [-1, 0, 1, 2]);
});
