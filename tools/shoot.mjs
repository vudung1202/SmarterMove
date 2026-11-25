// Chụp các màn + trạng thái của prototype ở iPhone 14 Pro Max (430×932) và desktop (1440×900).
// Cần server: (cd prototype && python3 -m http.server 4173). Chạy: node tools/shoot.mjs [lọc-tên]
import { mkdirSync } from 'node:fs';
import { Browser, sleep } from '/Users/dzung/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';

const BASE = 'http://localhost:4173/index.html';
const OUT = new URL('../.taste-skill/shots/', import.meta.url).pathname;
const click = (sel) => `document.querySelector(${JSON.stringify(sel)}).click()`;
const tap = (sq) => click(`[data-sq="${sq}"]`);
const SCENES = [
  ['home', '#/'],
  ['home-empty', '#/?demo=empty'],
  ['start-sheet', '#/', [click('[data-start="ma-non"]')]],
  ['play', '#/play'],
  ['play-select', '#/play', [tap('c2')]],
  ['play-hint1', '#/play', [click('[data-act="hint"]')]],
  ['play-hint2', '#/play', [click('[data-act="hint"]'), click('[data-act="hint"]')]],
  ['play-alert', '#/play', [tap('f3'), tap('d4')]],
  ['play-done', '#/play', [tap('c2'), tap('c3'), 'wait']],
  ['play-menu', '#/play', [click('[data-act="menu"]')]],
  ['play-loading', '#/play?demo=loading'],
  ['play-error', '#/play?demo=error'],
  ['review', '#/review'],
  ['review-ply', '#/review', [click('[data-ply="10"]')]],
  ['retry', '#/play?retry=36'],
  ['retry-ok', '#/play?retry=36', ['RETRY_BEST', 'wait']],
  ['retry-bad', '#/play?retry=36', ['RETRY_BAD', 'wait']],
];
const only = process.argv[2];
mkdirSync(OUT, { recursive: true });
const browser = await Browser.launch();
try {
  for (const [w, h, tag] of [[430, 932, 'phone'], [1440, 900, 'desk']]) {
    const page = await browser.newPage({ width: w, height: h, dsf: 1, mobile: w < 600 });
    for (const [name, hash, steps = []] of SCENES) {
      if (only && !name.includes(only)) continue;
      await page.goto('about:blank', { settleMs: 0 });
      await page.goto(BASE + hash, { settleMs: 700 });
      for (const s of steps) {
        if (s === 'wait') { await sleep(1300); continue; }
        if (s === 'RETRY_BEST' || s === 'RETRY_BAD') {
          // đi nước máy chọn (hoặc một nước "lỗi lớn") ở thế cờ thử lại
          await page.eval(`(() => { const m = window.ENGINE_DATA.gameA.momentMoves[36]; const e = ${s === 'RETRY_BEST' ? 'm[0]' : "m.find((x) => x.judgement === 'loi-lon' && x.san !== window.ENGINE_DATA.gameA.plies[36].san)"};
            document.querySelector('[data-sq="' + e.from + '"]').click(); document.querySelector('[data-sq="' + e.to + '"]').click(); })()`);
          continue;
        }
        await page.eval(s); await sleep(150);
      }
      await page.screenshot({ path: `${OUT}${name}-${tag}.jpg`, quality: 80, fullPage: tag === 'phone' && !name.startsWith('play') && !name.startsWith('retry') && !name.startsWith('start') });
      if (page.consoleErrors.length) console.log(name, tag, 'LỖI:', page.consoleErrors.splice(0));
    }
    await page.close();
  }
} finally { await browser.close(); }
console.log('xong:', OUT);
