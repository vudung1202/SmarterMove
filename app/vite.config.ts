import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/** Liệt kê mọi file trong public/ (đường dẫn tương đối, dấu /). */
function publicFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? publicFiles(p, root) : [relative(root, p).split('\\').join('/')]
  })
}

/**
 * Sinh sw.js lúc build: lưu sẵn toàn bộ app (JS/CSS, engine, sách khai cuộc, quân cờ, font, icon) để chơi offline.
 * Tên cache đổi theo nội dung, nên bản mới tự thay bản cũ khi người dùng mở lại app.
 */
function serviceWorker(): Plugin {
  return {
    name: 'nuoc-hay-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = ['./', 'index.html', ...Object.keys(bundle), ...publicFiles('public')].filter((f) => f !== 'sw.js')
      const hash = createHash('sha256')
      for (const [name, chunk] of Object.entries(bundle)) hash.update(name + ('code' in chunk ? chunk.code : String(chunk.source)))
      for (const f of publicFiles('public')) hash.update(f).update(readFileSync(join('public', f)))
      const version = hash.digest('hex').slice(0, 12)
      const source = readFileSync('src/sw.template.js', 'utf8').replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// base './' để chạy được dưới mọi đường dẫn (LAN, GitHub Pages /SmarterMove/…)
export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  server: { host: true, port: 4174 },
  preview: { host: true, port: 4174 },
})
