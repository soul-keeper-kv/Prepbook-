# DSA Roadmap

Lộ trình học thuật toán, gồm 2 phần tách riêng:

| Thư mục | Là gì | Hướng dẫn |
| --- | --- | --- |
| [web/](web/) | App web + server chạy trên máy tính (`start.sh`) | [web/README.md](web/README.md) |
| [mobile/](mobile/) | App Android, đóng gói app web từ `web/` bằng Capacitor | [mobile/README.md](mobile/README.md) |

App Android không có bản code giao diện riêng: lúc build, nó copy `index.html`, `main.js`, `i18n.js`, CSS và `data/` từ `web/`.
Sửa giao diện hay nội dung thì sửa trong `web/`, rồi build lại app.

Tiến độ (tick, ghi chú, code) của cả 2 bản nằm chung trong file `dsa-roadmap-progress.json` ở My Drive của bạn.
Mỗi máy giữ thêm 1 bản trong máy, nên mất mạng vẫn học bình thường, có mạng lại thì tự đồng bộ.

## Cài Google Cloud (1 lần, miễn phí)

Cần để app được phép ghi file vào Drive của bạn. Không cần thẻ thanh toán.

1. Vào <https://console.cloud.google.com>, tạo project mới (ví dụ `DSA Roadmap`).
2. **APIs & Services → Library**, tìm **Google Drive API**, bấm **Enable**.
3. **Google Auth Platform** (màn hình OAuth consent) → **Get started**: điền tên app, email của bạn, chọn **External**.
4. **Audience** → bấm **Publish app** (chuyển sang *In production*).
   App chỉ xin quyền `drive.file` (chỉ thấy file do chính app tạo), Google xếp loại không nhạy cảm nên không phải chờ duyệt.
   Nếu để *Testing* thì phải thêm Gmail của bạn vào **Test users**, và cứ 7 ngày phải kết nối lại.
5. **Clients → Create client**, tạo **2 client trong cùng project này**:
   - **Desktop app** cho bản máy tính: tạo xong bấm **Download JSON**, lưu thành `web/google-oauth.json`. File này đã nằm trong `.gitignore`.
   - **Android** cho app điện thoại: package name `dev.kienpt.dsaroadmap`, SHA-1 lấy theo [mobile/README.md](mobile/README.md#sha-1-cho-google-cloud).

## Đồng bộ hoạt động thế nào

- Có thay đổi: khoảng 1,5 giây sau tự ghi lên Drive.
- Quay lại app hay tab: tự lấy bản mới nhất từ Drive về.
- Hai máy cùng sửa lúc chưa đồng bộ: hai bên được gộp lại. Cùng 1 ô (ví dụ cùng ghi chú của 1 mục) thì máy có thay đổi chưa đồng bộ thắng.
  Bỏ tick ở máy này trong lúc máy kia cũng đang sửa thì tick có thể quay lại.
- Đóng tab ngay sau khi sửa (chưa kịp 1,5 giây): thay đổi vẫn còn trong máy, lần mở sau mới đẩy lên.
- File trên Drive cùng định dạng với file "Xuất tiến độ": tải về rồi "Nhập tiến độ" được. Đổi tên hay chuyển thư mục vẫn chạy (app tìm file theo thẻ, không theo tên).
- Xoá file trên Drive thì lần đồng bộ sau app tạo lại từ bản trong máy.

Code đồng bộ nằm trong `web/main.js` (phần "Đồng bộ Google Drive"), dùng chung cho cả 2 bản.
Chỉ khác cách lấy quyền Google: máy tính qua `web/server.js`, Android qua `mobile/android/.../GoogleDrivePlugin.java`.
