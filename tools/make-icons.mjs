// Vẽ biểu tượng app từ app/public/icons/icon.svg ra PNG (iOS cần PNG cho apple-touch-icon). Chạy: node tools/make-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { Browser } from '/Users/dzung/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';

const dir = new URL('../app/public/icons/', import.meta.url);
const svg = readFileSync(new URL('icon.svg', dir), 'utf8');
const b = await Browser.launch();
for (const [size, name] of [[180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
  const p = await b.newPage({ width: size, height: size, dsf: 1 });
  await p.goto('data:text/html,' + encodeURIComponent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`), { settleMs: 200 });
  const data = await p.screenshot({ format: 'png', clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(new URL(name, dir), Buffer.from(data, 'base64'));
  await p.close();
}
await b.close();
console.log('xong');
