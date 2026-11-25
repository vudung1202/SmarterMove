// Chạy: npm test  (node --test, Node ≥ 23 tự bỏ kiểu TypeScript)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBestMove, parseInfo } from '../engine/uci.ts';
import { classify, consequence, gradeClass, isSacrifice, signed, toPawns, viSan, winPercent } from './coach.ts';
import { bookKey } from './book-key.ts';
import { KEYS, NAMES } from '../data/book.ts';
import { Chess } from 'chess.js';

test('parseInfo đọc depth, điểm, nps và biến chính', () => {
  const i = parseInfo('info depth 14 seldepth 20 multipv 1 score cp -35 nodes 120000 nps 450000 time 266 pv e7e5 g1f3 b8c6');
  assert.deepEqual(i, { depth: 14, score: { cp: -35 }, nps: 450000, pv: ['e7e5', 'g1f3', 'b8c6'] });
  assert.deepEqual(parseInfo('info depth 9 score mate -3 pv a1a8')?.score, { mate: -3 });
  assert.equal(parseInfo('info depth 9 multipv 2 score cp 10 pv a2a3'), null);
  assert.equal(parseInfo('info string NNUE evaluation using nn.bin'), null);
  assert.equal(parseBestMove('bestmove e2e4 ponder e7e5'), 'e2e4');
  assert.equal(parseBestMove('readyok'), null);
});

test('toPawns kẹp ±10 và đổi chiếu hết', () => {
  assert.equal(toPawns({ cp: 250 }), 2.5);
  assert.equal(toPawns({ cp: -3000 }), -10);
  assert.equal(toPawns({ mate: 2 }), 10);
  assert.equal(toPawns({ mate: -1 }), -10);
});

test('classify theo winning chances: cùng mức mất 2 tốt, thế cân bằng bị phạt nặng hơn thế đã thắng', () => {
  assert.equal(classify(0, -2.5, false), 'blunder');
  assert.equal(classify(0, -1.2, false), 'mistake');
  assert.equal(classify(0, -0.6, false), 'inaccuracy');
  assert.equal(classify(0.3, 0.1, false), 'excellent');
  assert.equal(classify(0.3, -0.2, false), 'good');
  assert.equal(classify(8, 6, false), 'good');
  assert.equal(classify(0.3, -5, true), 'best');
  assert.equal(winPercent(0), 50);
  assert.equal(winPercent(10), 98);
});

test('viSan và signed', () => {
  assert.equal(viSan('Nxd4'), 'Mxd4');
  assert.equal(viSan('exd8=Q+'), 'exd8=H+');
  assert.equal(viSan('O-O'), 'O-O');
  assert.equal(signed(2.56), '+2,6');
  assert.equal(signed(-2.55), '\u22122,6');
  assert.equal(signed(0.02), '0,0');
});

test('consequence: nước đáp bắt quân, chiếu hết, hoặc chỉ báo điểm', () => {
  // Trắng vừa đi Mxd4?? (thế cờ ván mẫu B); Đen đáp Txd1 bắt hậu
  const after = 'r3k2r/1pp1qpp1/p1nb3p/4p2n/3NP1bP/PB1P4/1PP2PP1/R1BQKN1R b KQkq - 0 14';
  assert.equal(consequence(after, 'g4d1', { cp: 450 }, 'Mã Non'), 'Mã Non đáp Txd1 và bắt hậu của bạn.');
  assert.equal(consequence('r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', 'a8a1', { mate: 1 }, 'Xe Sắt'), 'Xe Sắt có đòn chiếu hết sau 1 nước, mở đầu bằng Xa1#.');
  assert.equal(consequence('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 'e7e5', { cp: -20 }, 'Tốt Nhỏ'), 'Tốt Nhỏ đáp e5, thế cờ còn +0,2 cho bạn.');
});

test('isSacrifice: thí tượng h7 thì có, đổi mã ngang giá thì không', () => {
  const greek = 'r1bq1rk1/pppn1ppp/4p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R1BQK2R w KQ - 4 8';
  assert.equal(isSacrifice(greek, ['d3h7', 'g8h7', 'f3g5', 'h7g8', 'd1h5']), true);
  const trade = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4';
  assert.equal(isSacrifice(trade, ['c3d5', 'f6d5', 'e4d5', 'c6d4']), false);
  assert.equal(isSacrifice(trade, ['c3d5']), false); // biến chính quá ngắn
});

test('gradeClass: sách khai cuộc và xuất sắc', () => {
  assert.equal(gradeClass({ before: 0.3, after: 0.1, isBest: false, isBook: true, sacrifice: false }), 'book');
  assert.equal(gradeClass({ before: 0.3, after: -3, isBest: false, isBook: true, sacrifice: false }), 'blunder'); // bẫy trong sách vẫn là lỗi
  assert.equal(gradeClass({ before: 0.5, after: 0.5, isBest: true, isBook: false, sacrifice: true }), 'brilliant');
  assert.equal(gradeClass({ before: 6, after: 6, isBest: true, isBook: false, sacrifice: true }), 'best'); // đã thắng áp đảo
  assert.equal(gradeClass({ before: 0.5, after: -2, isBest: false, isBook: false, sacrifice: true }), 'blunder');
  assert.equal(gradeClass({ before: 0.2, after: 0.2, isBest: true, isBook: false, sacrifice: false, onlyMove: true }), 'great');
  assert.equal(gradeClass({ before: 0.5, after: 0.5, isBest: true, isBook: false, sacrifice: true, onlyMove: true }), 'brilliant'); // thí quân xếp trên
});

test('sách khai cuộc: Italian Game có, nước lạ không', () => {
  const c = new Chess();
  for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']) c.move(san);
  assert.equal(NAMES[KEYS[bookKey(c.fen())]], 'Italian Game');
  c.move('a5'); c.move('Qe2'); c.move('Ra6');
  assert.equal(KEYS[bookKey(c.fen())], undefined);
});
