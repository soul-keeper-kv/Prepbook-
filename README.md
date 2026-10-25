# Interview Prep

Sổ học ôn phỏng vấn do bạn tự viết, xếp theo pattern, nhiều chủ đề (DSA, Java, Database, System Design...).
Bạn tự tìm tài liệu và bài, tự làm, rồi ghi lại trong app: **Tìm → Làm → Ghi → Ôn**.

- **Chủ đề → Giai đoạn → Pattern**: lộ trình do bạn sắp, kéo thả ở cây bên trái.
- **Trang pattern**: các mục ghi chú theo kiểu chủ đề (DSA: nhận diện, ý tưởng, template, bẫy), bài đã làm, tài liệu đã đọc, câu hỏi phỏng vấn tự soạn.
- **Mỗi lần làm bài** được ghi lại (tự làm / cần gợi ý / xem lời giải, số phút, sai ở đâu, code). Lịch làm lại và mức của pattern (Chưa học → Đang học → Nắm được → Thành thạo) tính từ đó, không tick tay.
- **Hộp thu** giữ link vừa tìm được; **Ôn lại** gom bài và thẻ hỏi đáp đến hạn; **Graph** vẽ các pattern và bài như Obsidian.
- Lộ trình DSA cũ trong `web/data/` giờ chỉ là **gợi ý**: bấm Thêm thì mới thành pattern của bạn.

Gồm 2 phần tách riêng:

| Thư mục            | Là gì                                                                                      | Hướng dẫn                            |
| ------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------ |
| [web/](web/)       | App React (Vite, TypeScript, Tailwind, shadcn/ui) + server chạy trên máy tính (`start.sh`) | [web/README.md](web/README.md)       |
| [mobile/](mobile/) | App Android, đóng gói bản build của `web/` bằng Capacitor                                  | [mobile/README.md](mobile/README.md) |

App Android không có bản code giao diện riêng: lúc build, nó copy `web/dist/` (code, CSS và nội dung `data/` đã gom lại).
Sửa giao diện hay nội dung thì sửa trong `web/`, rồi build lại app.

Không có backend hay database: mọi thứ bạn viết nằm trong máy và trên Google Drive của bạn.

Mọi thứ bạn viết (pattern, bài, lần làm, ghi chú, thẻ) của cả 2 bản nằm chung trong file `interview-prep-notebook.json` ở My Drive của bạn.
File `dsa-roadmap-progress.json` của bản cũ được để nguyên: lần đầu mở bản mới, tiến độ cũ trong máy (mục đã tick, ghi chú, code, bài đã giải) được chuyển thành pattern và bài tập.
Mỗi máy giữ thêm 1 bản trong máy, nên mất mạng vẫn học bình thường, có mạng lại thì tự đồng bộ.

## Cài Google Cloud (1 lần, miễn phí)

Cần để app được phép ghi file vào Drive của bạn. Không cần thẻ thanh toán.

1. Vào <https://console.cloud.google.com>, tạo project mới (ví dụ `DSA Roadmap`).
2. **APIs & Services → Library**, tìm **Google Drive API**, bấm **Enable**.
3. **Google Auth Platform** (màn hình OAuth consent) → **Get started**: điền tên app, email của bạn, chọn **External**.
4. **Audience** → bấm **Publish app** (chuyển sang _In production_).
   App chỉ xin quyền `drive.file` (chỉ thấy file do chính app tạo), Google xếp loại không nhạy cảm nên không phải chờ duyệt.
   Nếu để _Testing_ thì phải thêm Gmail của bạn vào **Test users**, và cứ 7 ngày phải kết nối lại.
5. **Clients → Create client**, tạo **2 client trong cùng project này**:
   - **Desktop app** cho bản máy tính: tạo xong bấm **Download JSON**, lưu thành `web/google-oauth.json`. File này đã nằm trong `.gitignore`.
   - **Android** cho app điện thoại: package name `dev.kienpt.dsaroadmap`, SHA-1 lấy theo [mobile/README.md](mobile/README.md#sha-1-cho-google-cloud).

## Đồng bộ hoạt động thế nào

- Có thay đổi: khoảng 1,5 giây sau tự ghi lên Drive.
- Quay lại app hay tab: tự lấy bản mới nhất từ Drive về.
- Hai máy cùng sửa lúc chưa đồng bộ: gộp theo từng ô, so với bản đồng bộ lần trước. Ô chỉ một máy sửa thì lấy bản đó.
  Cùng 1 ô bị sửa ở cả 2 máy thì bản sửa sau thắng; nếu là ghi chú dài, bản kia được giữ lại để bạn chọn (hiện ở trang pattern, trang bài và Cài đặt).
- Xoá thứ gì thì nó được đánh dấu đã xoá chứ không mất khỏi file, để máy kia không đưa nó quay lại.
- Đóng tab ngay sau khi sửa (chưa kịp 1,5 giây): thay đổi vẫn còn trong máy, lần mở sau mới đẩy lên.
- File trên Drive cùng định dạng với file "Xuất dữ liệu": tải về rồi "Nhập dữ liệu" được. Đổi tên hay chuyển thư mục vẫn chạy (app tìm file theo thẻ, không theo tên).
- Xoá file trên Drive thì lần đồng bộ sau app tạo lại từ bản trong máy.

Code đồng bộ nằm trong `web/src/sync/` (`engine.ts`) và cách gộp ở `web/src/notebook/merge.ts`, đều có test, dùng chung cho cả 2 bản.
Chỉ khác cách lấy quyền Google: máy tính qua `web/server/google-auth.ts`, Android qua `mobile/android/.../GoogleDrivePlugin.java`.
