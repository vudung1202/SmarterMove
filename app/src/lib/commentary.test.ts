import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from 'chess.js';
import { describeMove, threatened } from './commentary.ts';

const START = new Chess().fen();
const after = (sans: string[]) => { const c = new Chess(); sans.forEach((s) => c.move(s)); return c.fen(); };

test('mô tả nước: trung tâm, ra quân, nhập thành, bắt quân', () => {
  assert.deepEqual(describeMove(START, 'e4'), ['chiếm trung tâm']);
  assert.deepEqual(describeMove(after(['e4', 'e5']), 'Nf3'), ['ra quân mã', 'tấn công tốt ở e5']);
  assert.deepEqual(describeMove(after(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']), 'O-O'), ['nhập thành, đưa vua vào chỗ an toàn']);
  assert.deepEqual(describeMove(after(['e4', 'd5']), 'exd5'), ['bắt tốt']);
});

test('chiếu và chĩa đôi', () => {
  // Mc7+ chiếu vua e8 và đánh xe a8
  const fen = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1';
  assert.deepEqual(describeMove(fen, 'Nc7+'), ['chiếu vua', 'tấn công xe ở a8']);
  const fork = '4k3/8/2r3q1/8/8/5N2/8/4K3 w - - 0 1'; // Mã f3 nhảy e5 đánh đôi xe c6 và hậu g6
  assert.deepEqual(describeMove(fork, 'Ne5'), ['chĩa đôi hậu và xe']);
});

test('quân bị đe dọa: bỏ không, hoặc bị quân rẻ hơn tấn công; quân được bảo vệ ngang giá thì không', () => {
  const c = new Chess(after(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5']));
  assert.deepEqual(threatened(c, 'w').map((t) => t.square), ['c4']); // tượng c4 bị tốt d5 tấn công; tốt e4 có mã g5 giữ
  assert.deepEqual(threatened(new Chess(START), 'w'), []);
});
