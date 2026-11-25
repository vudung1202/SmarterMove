// Chạy thử app trong Chrome giả lập iPhone 14 Pro Max: chấm nước, lưu/khôi phục ván, cầm Đen, phong cấp, trang đo.
// Cần: (cd app && npx vite build && npx vite preview). Chạy: node tools/check-app.mjs [--bench]
import { Browser, sleep } from '/Users/dzung/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';

const BASE = 'http://localhost:4174/';
const OUT = new URL('../.taste-skill/shots/', import.meta.url).pathname;
const browser = await Browser.launch();
const page = await browser.newPage({ width: 430, height: 932, dsf: 1, mobile: true });
const phase = () => page.eval(`document.querySelector('.play')?.dataset.phase`);
const waitPhase = async (want, ms = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const p = await phase(); if (want.includes(p)) return p; await sleep(100); }
  throw new Error(`chờ phase ${want} quá ${ms}ms, đang là ${await phase()}`);
};
const tap = (sq) => page.eval(`document.querySelector('[aria-label^="${sq}"]').click()`);
const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)}).click()`);
const clickText = (t) => page.eval(`[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === ${JSON.stringify(t)}).click()`);
const coach = () => page.eval(`document.querySelector('.coach').innerText.replace(/\\n+/g, ' | ')`);
const badge = () => page.eval(`(() => { const b = document.querySelector('.board .badge'); return b ? b.className.replace('badge badge-', '') + '@' + b.closest('[aria-label]').getAttribute('aria-label').slice(0, 2) : 'không'; })()`);
const nMoves = () => page.eval(`document.querySelectorAll('.moves .mv').length`);
const firstSq = () => page.eval(`document.querySelector('.board .sq').getAttribute('aria-label').slice(0, 2)`);
const reload = async (hash = '#/play') => { await page.goto('about:blank', { settleMs: 0 }); await page.goto(BASE + hash, { settleMs: 400 }); };
const text = (sel) => page.eval(`[...document.querySelectorAll(${JSON.stringify(sel)})].map((e) => e.innerText.replace(/\\s+/g, ' ')).join(' | ')`);
const shot = (n) => page.screenshot({ path: `${OUT}app-${n}.jpg`, quality: 80 });
const ok = (cond, msg) => console.log(cond ? '✓' : '✗', msg);

try {
  // 0. Tài khoản mới: màn chọn đối thủ
  await reload('#/');
  await page.eval(`localStorage.clear(); new Promise((r) => { const q = indexedDB.deleteDatabase('nuoc-hay'); q.onsuccess = q.onerror = q.onblocked = r; })`);
  await reload('#/');
  ok((await text('h1')) === 'Chọn đối thủ' && (await text('.title-row .sub')).includes('Chưa có ván nào'), `màn đầu: ${await text('.title-row .sub')}`);
  await shot('home-empty');

  // 1. Đấu Tốt Nhỏ cầm Trắng, nước sách rồi lỗi lớn
  await clickText('Đấu với Tốt Nhỏ'); await sleep(200);
  await clickText('Trắng'); await clickText('Bắt đầu ván');
  await waitPhase(['you']);
  ok((await text('.play-title h1')) === 'Tốt Nhỏ', 'vào ván với Tốt Nhỏ');
  await sleep(1600);
  await tap('e2'); await sleep(100); await tap('e4');
  await waitPhase(['you']);
  ok((await badge()).startsWith('book@e4'), `e4 là nước sách | ${await coach()}`);
  await sleep(1600);
  await tap('f1'); await sleep(100); await tap('a6');
  await waitPhase(['you']);
  ok((await coach()).includes('Lỗi lớn'), `Ta6 bị chấm lỗi lớn | ${await coach()}`);

  // 2. Tải lại: ván còn nguyên; màn chọn đối thủ hiện ván dở
  const before = await nMoves();
  await reload();
  await waitPhase(['you']);
  ok((await nMoves()) === before, `tải lại vẫn còn ${before} nửa nước`);
  await reload('#/');
  ok((await text('.resume h2')).includes('Ván đang dở với Tốt Nhỏ'), `ván dở: ${await text('.resume')}`);

  // 2b. Bỏ ván → lịch sử, thành tích, tiến độ
  await reload();
  await waitPhase(['you']);
  await page.eval(`window.confirm = () => true`);
  await click('[aria-label="Tùy chọn ván"]'); await sleep(100);
  await clickText('Bỏ ván này');
  await waitPhase(['over']);
  await sleep(300);
  await reload('#/');
  const row = await text('.recent tbody tr');
  ok(row.includes('Tốt Nhỏ') && row.includes('Thua'), `ván gần đây: ${row}`);
  ok((await text('.boss:first-child .tally')).includes('1 thua') && !(await text('.resume')).length, `thành tích Tốt Nhỏ: ${await text('.boss:first-child .tally')}; không còn ván dở`);
  await shot('home-after');

  // 2c. Bắt đầu boss khác
  await clickText('Bỏ qua').catch(() => {});
  await page.eval(`[...document.querySelectorAll('.boss')][3].querySelector('button').click()`); await sleep(200);
  await clickText('Bắt đầu ván');
  await waitPhase(['you']);
  ok((await text('.play-title h1')) === 'Xe Sắt', 'đổi sang Xe Sắt');

  // 3. Ván mới cầm Đen: bàn cờ lật, boss đi trước
  await click('[aria-label="Tùy chọn ván"]'); await sleep(100);
  await clickText('Ván mới'); await sleep(100);
  await clickText('Đen'); await clickText('Bắt đầu ván');
  await waitPhase(['you']);
  ok((await firstSq()) === 'h1' && (await nMoves()) === 1, `cầm Đen: ô đầu tiên ${await firstSq()}, Xe Sắt đã đi ${await nMoves()} nước | ${await coach()}`);
  await shot('black');

  // 4. Phong cấp: dựng ván sắp phong cấp qua localStorage rồi chọn mã
  await page.eval(`localStorage.setItem('nuoc-hay:game', JSON.stringify({ v: 1, bossId: 'ma-non', color: 'w', sans: ['h4','g5','hxg5','h6','gxh6','Nf6','h7','Rg8'], grades: {}, over: '' }))`);
  await reload();
  await waitPhase(['you']);
  await tap('h7'); await sleep(100); await tap('h8'); await sleep(200);
  ok(await page.eval(`!!document.querySelector('.promo')`), 'chạm ô phong cấp thì hiện bảng chọn quân');
  await shot('promo');
  await click('.promo [aria-label="mã"]');
  await waitPhase(['you', 'over']);
  const h8 = await page.eval(`document.querySelector('[aria-label^="h8"]').getAttribute('aria-label')`);
  ok(h8.includes('mã trắng') || (await page.eval(`[...document.querySelectorAll('.moves .mv')].some((m) => m.innerText.startsWith('h8=M'))`)), `phong thành mã: ${h8}`);
  if (page.consoleErrors.length) console.log('LỖI console:', page.consoleErrors);

  if (process.argv.includes('--bench')) {
    await page.goto(BASE + '#/bench', { settleMs: 300 });
    await click('.bench-actions .btn.primary');
    const t0 = Date.now();
    while (Date.now() - t0 < 180000) { if (await page.eval(`!document.querySelector('.bench-actions .btn.primary').disabled`)) break; await sleep(500); }
    console.log(await page.eval(`[...document.querySelectorAll('.bench tbody tr')].map((r) => r.innerText.replace(/\\s+/g, ' ')).join('\\n')`));
  }
} finally { await browser.close(); }
