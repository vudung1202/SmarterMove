// Kiểm tra chơi offline: mở app (bản build), chờ "Đã sẵn sàng chơi offline", TẮT server, tải lại rồi đấu một nước.
// Cần: (cd app && npx vite build && npx vite preview) đang chạy ở cổng 4174. Chạy: node tools/check-offline.mjs
import { execSync, spawn } from 'node:child_process';
import { Browser, sleep } from '/Users/dzung/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';

const BASE = 'http://localhost:4174/';
const ok = (c, m) => console.log(c ? '✓' : '✗', m);
const b = await Browser.launch();
const p = await b.newPage({ width: 430, height: 932, dsf: 1, mobile: true });
const until = async (expr, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.eval(expr).catch(() => false)) return true; await sleep(200); } return false; };
try {
  await p.goto(BASE, { settleMs: 500 });
  ok(await until(`!!document.querySelector('.offline-status.ready')`), 'online: hiện "Đã sẵn sàng chơi offline"');
  const pid = execSync('lsof -tiTCP:4174 -sTCP:LISTEN').toString().trim();
  execSync(`kill ${pid}`);
  await sleep(500);
  ok(execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:4174/ || true').toString() === '000', 'đã tắt server');
  await p.goto('about:blank', { settleMs: 0 });
  await p.goto(BASE, { settleMs: 800 });
  ok(await until(`document.querySelector('h1')?.innerText === 'Chọn đối thủ' && !!document.querySelector('.boss.is-rec')`), 'offline: mở được màn Chọn đối thủ');
  console.log('  đề xuất:', await p.eval(`document.querySelector('.boss.is-rec button')?.innerText`), '| lỗi:', p.consoleErrors);
  await p.eval(`[...document.querySelectorAll('button')].find((x) => x.innerText.trim().startsWith('Đấu với')).click()`); await sleep(200);
  await p.eval(`[...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Trắng').click()`);
  await p.eval(`[...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Bắt đầu ván').click()`);
  ok(await until(`document.querySelector('.play')?.dataset.phase === 'you'`), 'offline: engine tải được, tới lượt bạn');
  await sleep(1600);
  await p.eval(`document.querySelector('[aria-label^="e2"]').click()`); await sleep(100);
  await p.eval(`document.querySelector('[aria-label^="e4"]').click()`);
  ok(await until(`document.querySelector('.play')?.dataset.phase === 'you' && document.querySelectorAll('.moves .mv').length === 2`), 'offline: đi e4, boss đáp');
  ok(await until(`document.querySelector('.coach').innerText.includes('Nước sách')`, 3000), `offline: sách khai cuộc vẫn chấm được | ${await p.eval(`document.querySelector('.coach').innerText.replace(/\\n+/g, ' | ')`)}`);
  ok(await p.eval(`document.fonts.check('16px Geist', 'Nước')`), 'offline: font Geist đã tải');
  if (p.consoleErrors.length) console.log('LỖI console:', p.consoleErrors);
} finally {
  await b.close();
  spawn('npx', ['vite', 'preview'], { cwd: new URL('../app/', import.meta.url).pathname, detached: true, stdio: 'ignore' }).unref();
}
