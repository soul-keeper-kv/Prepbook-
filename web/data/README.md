# Lộ trình DSA cũ (gợi ý)

Nội dung ở đây không còn là nội dung chính của app: những gì bạn học nằm trong notebook (`src/notebook/`) do bạn tự viết. Thư mục này giờ chỉ dùng để:

- gợi ý giai đoạn và mục ở trang chủ đề DSA: bấm **Thêm** thì mục đó thành một pattern trống của bạn;
- gợi ý bài và tài liệu ở trang pattern tạo từ một mục (chỉ thêm khi bạn bấm);
- nhận ra link bài bạn dán vào (Hộp thu, ô thêm bài): lấy sẵn tên và mức;
- chuyển tiến độ của bản cũ (lần đầu mở bản mới, hoặc nút **Nhập dữ liệu**) thành pattern và bài tập.

Các trường `description`, `keyPoints`, `examples`, `template`, `complexity`, `pitfalls` và `codeReviewChecklist` vẫn được kiểm tra nhưng app không hiện nữa.

- Đang chạy `npm run dev`: lưu file JSON là trang tự cập nhật.
- Chạy bằng `start.sh`: chạy lại `start.sh` (nó build lại mỗi lần).

Lúc nạp, app kiểm tra từng file theo `src/content/schema.ts`. Sai định dạng (thiếu trường bắt buộc, gõ sai tên trường, URL không phải http(s), trùng `id`...) thì app hiện tên file và chỗ sai thay vì chạy với dữ liệu hỏng. `npm test` cũng kiểm tra toàn bộ thư mục này.

## Hai ngôn ngữ (vi / en)

Mọi trường chữ đều viết được theo 2 cách:

- Chuỗi thường: hiện giống nhau ở mọi ngôn ngữ, ví dụ `"title": "Two Sum"`.
- Theo ngôn ngữ: `"title": { "vi": "Dạng bài Stack", "en": "Stack problems" }`. Thiếu `en` thì app dùng `vi`.

Khi một gợi ý được thêm vào notebook, tên được chép theo ngôn ngữ đang chọn lúc đó; sau đó là chữ của bạn, không đổi theo ngôn ngữ nữa.
Chữ trên nút và nhãn của app nằm trong `src/i18n/locales/`.

## manifest.json

```json
{
  "title": { "vi": "Tiêu đề", "en": "Title" },
  "phases": ["phase-0-nen-tang.json", "phase-1-co-ban.json"]
}
```

- `phases`: danh sách file giai đoạn, theo thứ tự gợi ý.

## File giai đoạn

```json
{
  "id": "p6",
  "name": { "vi": "Giai đoạn 6 · System design", "en": "Phase 6 · System design" },
  "time": { "vi": "2 tuần", "en": "2 weeks" },
  "items": [ ... ]
}
```

Các trường của mỗi mục trong `items` mà app còn dùng:

| Trường | Ý nghĩa |
|---|---|
| `id` | **Đặt 1 lần rồi đừng đổi**: pattern tạo từ mục này nhận ra mục qua `id` (để gợi ý bài, và để 2 máy cùng thêm 1 mục thì ra 1 pattern) |
| `title` | Tên mục, thành tên pattern khi được thêm |
| `problems` | Bài gợi ý: `[{ "title", "url", "level", "note", "guides" }]`. `level`: `Easy` / `Medium` / `Hard`. Mục không có bài nào thành pattern "lý thuyết thuần" |
| `resources` | Tài liệu gợi ý: `[{ "type", "title", "url" }]`. `type`: `article`, `video`, `course`, `docs`, `book`, `visual`, `practice` |

Cùng 1 link bài xuất hiện ở nhiều mục vẫn là 1 bài trong notebook (khớp theo link, bỏ qua `www.`, dấu `/` cuối và phần sau tên bài của LeetCode).

## Gợi ý khi bí

Trang của mỗi bài có phần **Bí? Xem gợi ý**, app tự tạo từ link của bài: link lời giải (LeetCode, HackerRank, AtCoder; trang khác thì tìm Google), video trên YouTube, và câu hỏi soạn sẵn để mở Claude hoặc ChatGPT. Nội dung câu hỏi nằm trong `src/i18n/locales/` (key `prompt.hint`, `prompt.explain`).

`guides` của một bài (không bắt buộc) là link hướng dẫn riêng, hiện đầu tiên:

```json
{ "title": "Two Sum", "url": "https://leetcode.com/problems/two-sum/", "level": "Easy",
  "guides": [{ "title": { "vi": "Giải thích bằng hash map", "en": "Hash map walkthrough" }, "url": "https://..." }] }
```

Bài bạn tự thêm cũng có các link này khi link của nó trùng một bài ở đây.

## Dữ liệu của bạn

Pattern, bài, lần làm, ghi chú và thẻ của bạn không nằm trong các file này: chúng ở trong trình duyệt và trong file `interview-prep-notebook.json` trên Google Drive. Cách đồng bộ xem [README.md](../../README.md).
