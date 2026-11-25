import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOSSES } from '../bosses.ts';
import { passed, record, recommended, recentWins, type GameRecord, type Result } from './progress.ts';

let n = 0;
const g = (bossId: string, result: Result): GameRecord =>
  ({ id: String(n++), bossId, color: 'w', sans: [], grades: {}, result, reason: '', endedAt: `2026-11-${String(30 - n).padStart(2, '0')}` });

test('tài khoản mới: thành tích 0 và đề xuất boss dễ nhất', () => {
  assert.deepEqual(record([], 'tot-nho'), { games: 0, win: 0, draw: 0, loss: 0 });
  assert.equal(recommended([], BOSSES).id, 'tot-nho');
});

test('thắng 3/5 ván gần nhất thì lên cấp, ván cũ hơn không tính', () => {
  // mới nhất trước: 4 ván gần nhất với Tốt Nhỏ có 2 thắng, ván thắng thứ 3 nằm ngoài cửa sổ 5 ván
  const games = [g('tot-nho', 'win'), g('tot-nho', 'loss'), g('tot-nho', 'win'), g('tot-nho', 'draw'), g('tot-nho', 'loss'), g('tot-nho', 'win')];
  assert.equal(recentWins(games, 'tot-nho'), 2);
  assert.equal(passed(games, 'tot-nho'), false);
  assert.equal(recommended(games, BOSSES).id, 'tot-nho');
  const more = [g('tot-nho', 'win'), ...games];
  assert.equal(passed(more, 'tot-nho'), true);
  assert.equal(recommended(more, BOSSES).id, 'ma-non');
  assert.deepEqual(record(more, 'tot-nho'), { games: 7, win: 4, draw: 1, loss: 2 });
});
