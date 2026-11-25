# Notes — prototype UI "Nước Hay" (tên tạm)

Đọc brief: prototype HTML tĩnh, bấm được, cho 3 màn MVP (chọn boss, đấu, xem lại) + tài liệu logic.
Không phải app thật: không có engine chạy trong trình duyệt; mọi đánh giá được tính trước bằng Stockfish 19 lite.

## Inventory (dữ liệu và việc cần làm)
- Đối tượng: boss (tên, Elo mục tiêu 600/1000/1400/1800, kiểu chơi, thành tích với bạn W/D/L);
  ván (nước SAN, FEN, kết quả, boss, màu quân, ngày); đánh giá thế cờ (pawn, góc nhìn quân Trắng; chiếu hết = ±M);
  gợi ý (mức 1: quân nên đi, mức 2: ô đích); khoảnh khắc review (ply, nước đã đi, nước tốt hơn, eval trước/sau).
- Độ lớn thật: ván 25–60 nước (50–120 ply); eval kẹp ±10; 1 người chơi, vài ván/ngày; tối đa 3 khoảnh khắc/ván;
  tài khoản mới: 0 ván, thành tích 0–0–0 (in số 0, không ẩn).
- Người dùng: 1 người, iPhone 14 Pro Max (430×932 CSS px), màn dọc, một tay, phiên 10–20 phút.
- Việc: đi nước (nhiều nhất), xin gợi ý, đi lại, bắt đầu ván với boss, tiếp tục ván dở, xem lại và thử lại.
- Thứ riêng của sản phẩm: bàn cờ và quân cờ; 4 boss mang tên quân cờ tiếng Việt (Tốt Nhỏ, Mã Non, Tượng Gỗ, Xe Sắt);
  thuật ngữ: "lỗi lớn", "sai lầm", "chưa chính xác", "lượt bạn", "đi lại", "thử lại từ đây".

## Câu hỏi + finding từng màn
- Chọn boss — "Hôm nay đấu với ai?" → khối lớn nhất: boss được đề xuất (luật: boss thấp nhất bạn chưa thắng ≥3/5 ván gần nhất).
  Finding: "Bạn thắng Tốt Nhỏ 4/5 ván gần nhất — lên Mã Non". Việc chính: "Đấu với Mã Non" (primary).
  Khối gấp lên trước: ván đang dở (tiếp tục).
- Đấu — "Nên đi gì bây giờ?" → khối lớn nhất: bàn cờ. Finding: dòng trạng thái/coach dưới bàn cờ.
  Việc chính: đi nước trên bàn cờ; Gợi ý và Đi lại là nút phụ.
- Xem lại — "Ván này hỏng ở đâu?" → khối lớn nhất: bàn cờ tại khoảnh khắc đang chọn + đường thế cờ.
  Finding: lỗi lớn nhất (nước, mất bao nhiêu). Việc chính: "Thử lại từ đây".

## Style
achromatic-ledger (seed 99006169). Lý do: chrome không màu để bàn cờ là vật duy nhất có màu; một hue (#1d5fbf)
dành riêng cho "lời coach" — đúng một nghĩa trên mọi màn.

## Face
Hue #1d5fbf = nước coach đề xuất, ở mọi nơi (ô gợi ý, mũi tên gợi ý, nước tốt hơn trong review, đường eval).
Nền "stone" #f4f3f1 thay #f8f8f8; bàn cờ cũng tông đá (sáng #ebe8e2, tối #b3aca0) thay vì nâu Lichess/xanh Chess.com.

## Signature element
Thang gợi ý 2 bậc (quân → nước) trên màn Đấu, và đường thế cờ cả ván với 3 khoảnh khắc đánh dấu trên màn Xem lại.

## Đổi so với sheet
- Shell icon rail: chỉ 2 đích (Đấu, Xem lại) → rail 56px trên desktop, bottom bar trên phone; màn Đấu trên phone ẩn bottom bar.
- Không dùng các pattern home 4 count tile nguyên dạng: 4 tile = 4 boss (peer objects, không icon trên đầu).
