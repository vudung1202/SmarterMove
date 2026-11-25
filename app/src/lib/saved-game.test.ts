// Luật cờ đặc biệt phải đi qua được vòng lưu → đọc lại ván.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSaved, type SavedGame } from './saved-game.ts';

const raw = (sans: string[], extra: Partial<SavedGame> = {}) =>
  JSON.stringify({ v: 1, id: 'g1', bossId: 'ma-non', color: 'w', sans, grades: {}, over: '', ...extra });
const load = (sans: string[], extra?: Partial<SavedGame>) => parseSaved(raw(sans, extra));

test('nhập thành, bắt tốt qua đường, phong cấp thành mã', () => {
  assert.deepEqual(load(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O'])!.game.get('g1'), { type: 'k', color: 'w' });
  const ep = load(['e4', 'a6', 'e5', 'd5', 'exd6'])!.game;
  assert.equal(ep.get('d5'), undefined);
  assert.deepEqual(ep.get('d6'), { type: 'p', color: 'w' });
  assert.deepEqual(load(['h4', 'g5', 'hxg5', 'h6', 'gxh6', 'Nf6', 'h7', 'Rg8', 'hxg8=N'])!.game.get('g8'), { type: 'n', color: 'w' });
});

test('chiếu hết và hòa do hết nước', () => {
  assert.ok(load(['f3', 'e5', 'g4', 'Qh4#'])!.game.isCheckmate());
  const stalemate = ['e3', 'a5', 'Qh5', 'Ra6', 'Qxa5', 'h5', 'h4', 'Rah6', 'Qxc7', 'f6', 'Qxd7+', 'Kf7', 'Qxb7', 'Qd3', 'Qxb8', 'Qh7', 'Qxc8', 'Kg6', 'Qe6'];
  assert.ok(load(stalemate)!.game.isStalemate());
});

test('giữ màu quân, đánh giá và câu kết thúc', () => {
  const s = load(['e4'], { color: 'b', grades: { 0: { cls: 'best', text: null } }, over: 'Bạn đã bỏ ván.' })!;
  assert.equal(s.color, 'b');
  assert.deepEqual(s.grades[0], { cls: 'best', text: null });
  assert.equal(s.over, 'Bạn đã bỏ ván.');
});

test('bỏ dữ liệu hỏng hoặc nước sai; ván cũ chưa có id thì được cấp id', () => {
  assert.equal(parseSaved(null), null);
  assert.equal(parseSaved('{không phải json'), null);
  assert.equal(load(['e4', 'e4']), null);
  assert.equal(load(['e4'], { color: 'x' as 'w' }), null);
  assert.equal(load(['e4'])!.id, 'g1');
  assert.ok(parseSaved(raw(['e4'], { id: undefined }))!.id.length > 4);
});
