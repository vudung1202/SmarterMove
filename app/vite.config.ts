import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' để chạy được dưới mọi đường dẫn (LAN, GitHub Pages…)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 4174 },
  preview: { host: true, port: 4174 },
})
