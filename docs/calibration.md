# Hiệu chỉnh độ khó boss

Sinh bởi `node tools/calibrate.mjs <số ván>` (chỉ đo một số cặp: `PAIRS=4,5 node tools/calibrate.mjs 20`). Các boss liền kề tự đấu với nhau, đổi màu xen kẽ, khai cuộc xoay vòng 10 biến.
Mục tiêu: boss mạnh hơn được 80–95% điểm (chênh khoảng 250–500 Elo). Chạy trên Mac, nơi giới hạn depth đến trước giới hạn thời gian.
Trên iPhone (khoảng 25 nghìn thế cờ/giây), các boss từ Xe Sắt trở lên sẽ chạm trần thời gian trước khi tính đủ depth, nên yếu hơn con số ghi.

| Cặp (mạnh – yếu) | Thắng | Hòa | Thua | Điểm của boss mạnh | Chênh Elo ước tính |
|---|---:|---:|---:|---:|---:|
| Mã Non – Tốt Nhỏ | 24 | 3 | 3 | 85% | +301 |
| Tượng Gỗ – Mã Non | 27 | 1 | 2 | 92% | +417 |
| Xe Sắt – Tượng Gỗ | 26 | 3 | 1 | 92% | +417 |
| Hậu Bạc – Xe Sắt | 14 | 3 | 3 | 78% | +215 |
| Vua Vàng – Hậu Bạc | 16 | 3 | 1 | 88% | +338 |

Ba cặp đầu: 30 ván mỗi cặp. Hai cặp sau (thêm Hậu Bạc, Vua Vàng): 20 ván mỗi cặp, tốn 31 phút vì các ván giữa boss mạnh thường kéo dài tới giới hạn 200 nửa nước.
Hậu Bạc – Xe Sắt được 78%, hơi dưới mục tiêu 80% nhưng vẫn nằm trong sai số (khoảng ±120 Elo với 20 ván), nên giữ nguyên cấu hình.

Cấu hình đã đo:

| Boss | Elo mục tiêu | setoption | Lệnh go | Nước ngẫu nhiên |
|---|---:|---|---|---:|
| Tốt Nhỏ | 600 | `UCI_LimitStrength=false, Skill Level=0` | `go depth 2 movetime 300` | 32% |
| Mã Non | 1000 | `UCI_LimitStrength=false, Skill Level=0` | `go depth 4 movetime 600` | 9% |
| Tượng Gỗ | 1400 | `Skill Level=20, UCI_LimitStrength=true, UCI_Elo=1400` | `go depth 12 movetime 800` | 0% |
| Xe Sắt | 1800 | `Skill Level=20, UCI_LimitStrength=true, UCI_Elo=1800` | `go depth 14 movetime 900` | 0% |
| Hậu Bạc | 2200 | `Skill Level=20, UCI_LimitStrength=true, UCI_Elo=2200` | `go depth 16 movetime 1200` | 0% |
| Vua Vàng | 2600 | `Skill Level=20, UCI_LimitStrength=true, UCI_Elo=2600` | `go depth 18 movetime 1500` | 0% |

Độ nhiễu: với 30 ván mỗi cặp, cùng một cấu hình chạy 2 lần cho Tượng Gỗ – Mã Non lần lượt 82% và 92%, tức sai số khoảng ±100 Elo.
Lịch sử chỉnh: lần đo đầu, Mã Non (Skill 3, depth 8) **mạnh hơn** Tượng Gỗ (UCI_Elo 1400) khoảng 380 Elo. Vì vậy hai boss thấp được đổi sang
Skill 0, depth thấp và đi nước ngẫu nhiên với một xác suất nhất định (`blunder`).
Giới hạn: chỉ đo được độ chênh giữa các boss. Elo tuyệt đối vẫn là ước lượng, cần người thật chơi nhiều ván mới đo được.

Cập nhật sau đo: thời gian nghĩ tối đa của Hậu Bạc tăng lên 3 giây và của Vua Vàng tăng lên 5 giây (giới hạn depth giữ nguyên), để trên iPhone hai boss này mạnh gần đúng nhãn Elo hơn. Trên Mac giới hạn depth vẫn đến trước, nên bảng trên không đổi.
