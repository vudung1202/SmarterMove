# Nước Hay

Luyện cờ vua với 4 boss theo mức Elo, có gợi ý 2 bậc, chấm từng nước đi kiểu Chess.com (sách, xuất sắc, tốt nhất… lỗi lớn)
và thanh cơ hội thắng. Là app web (PWA) dành cho iPhone: cài ra màn hình chính và chơi được khi không có mạng.
Engine Stockfish chạy ngay trên máy, không cần server.

**Dùng thử:** https://vudung1202.github.io/nuoc-hay/ — trên iPhone mở bằng Safari → Chia sẻ → Thêm vào MH chính.

## Chạy trên máy

```bash
cd app
npm install
npm run dev        # http://localhost:4174
npm test           # test logic (node --test)
npm run build && npx vite preview   # bản build, có service worker để thử offline
```

Mỗi lần push lên `main`, GitHub Actions (`.github/workflows/pages.yml`) chạy test, build rồi đưa lên GitHub Pages.

## Thư mục

| Thư mục | Nội dung |
|---|---|
| `app/` | App React + TypeScript + Vite |
| `prototype/` | Prototype HTML 3 màn ban đầu |
| `tools/` | Script: sinh dữ liệu mẫu, sách khai cuộc, biểu tượng app, hiệu chỉnh boss, kiểm tra tự động |
| `docs/` | Logic từng màn (`screens-logic.md`), kết quả hiệu chỉnh boss (`calibration.md`) |

## Giấy phép

Mã nguồn của dự án phát hành theo **GNU GPL v3** (xem `LICENSE`), vì app phân phối kèm Stockfish (GPLv3).

| Thành phần | Nguồn | Giấy phép |
|---|---|---|
| Stockfish 19 lite (WASM) | [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js), dựa trên [official-stockfish/Stockfish](https://github.com/official-stockfish/Stockfish) | GPLv3 |
| chess.js | [jhlywa/chess.js](https://github.com/jhlywa/chess.js) | BSD-2-Clause |
| Quân cờ cburnett (và logo, vẽ lại từ con Mã) | Colin M.L. Burnett, qua [lichess-org/lila](https://github.com/lichess-org/lila) | CC BY-SA 3.0 |
| Font Geist | [vercel/geist-font](https://github.com/vercel/geist-font) | SIL OFL 1.1 (`app/public/fonts/OFL.txt`) |
| Sách khai cuộc | [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) | CC0 |
