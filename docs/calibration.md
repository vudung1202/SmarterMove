# Hiệu chỉnh độ khó boss

Sinh bởi `node tools/calibrate.mjs 30`. Các boss liền kề tự đấu 30 ván mỗi cặp, đổi màu xen kẽ, khai cuộc xoay vòng 10 biến.
Mục tiêu: boss mạnh hơn được 80–95% điểm (chênh ≈ 250–500 Elo). Chạy trên Mac, nơi giới hạn depth đến trước giới hạn thời gian;
trên iPhone, Xe Sắt có thể chạm trần 900 ms trước khi tới depth 14, nên yếu hơn một chút.

| Cặp (mạnh – yếu) | Thắng | Hòa | Thua | Điểm của boss mạnh | Chênh Elo ước tính |
|---|---:|---:|---:|---:|---:|
| Mã Non – Tốt Nhỏ | 24 | 3 | 3 | 85% | +301 |
| Tượng Gỗ – Mã Non | 27 | 1 | 2 | 92% | +417 |
| Xe Sắt – Tượng Gỗ | 26 | 3 | 1 | 92% | +417 |

Cấu hình đã đo:

| Boss | Elo mục tiêu | setoption | Lệnh go | Nước ngẫu nhiên |
|---|---:|---|---|---:|
| Tốt Nhỏ | 600 | `UCI_LimitStrength=false, Skill Level=0` | `go depth 2 movetime 300` | 32% |
| Mã Non | 1000 | `UCI_LimitStrength=false, Skill Level=0` | `go depth 4 movetime 600` | 9% |
| Tượng Gỗ | 1400 | `Skill Level=20, UCI_LimitStrength=true, UCI_Elo=1400` | `go depth 12 movetime 800` | 0% |
| Xe Sắt | 1800 | `Skill Level=20, UCI_LimitStrength=true, UCI_Elo=1800` | `go depth 14 movetime 900` | 0% |

Giới hạn: chỉ đo được độ chênh giữa các boss. Elo tuyệt đối vẫn là ước lượng, cần người thật chơi nhiều ván mới đo được.

Độ nhiễu: với 30 ván mỗi cặp, cùng một cấu hình chạy 2 lần cho Tượng Gỗ – Mã Non lần lượt 82% và 92%, tức sai số khoảng ±100 Elo.
Lịch sử chỉnh: lần đo đầu, Mã Non (Skill 3, depth 8) **mạnh hơn** Tượng Gỗ (UCI_Elo 1400) khoảng 380 Elo. Vì vậy hai boss thấp được đổi sang
Skill 0, depth thấp và đi nước ngẫu nhiên với một xác suất nhất định (`blunder`).
