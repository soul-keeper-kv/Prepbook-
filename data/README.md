# Dữ liệu của app

App (`index.html`, `main.js`, `index.css`, `i18n.js`) chỉ là phần vỏ. Toàn bộ nội dung nằm trong thư mục này.
Sửa JSON xong thì tải lại trang là thấy.

## Hai ngôn ngữ (vi / en)

Mọi trường chữ đều viết được theo 2 cách:

- Chuỗi thường: hiện giống nhau ở mọi ngôn ngữ, ví dụ `"title": "Two Sum"`.
- Theo ngôn ngữ: `"title": { "vi": "Dạng bài Stack", "en": "Stack problems" }`. Thiếu `en` thì app dùng `vi`.

Cách thứ hai dùng được cả cho mảng (`keyPoints`, `pitfalls`) và code (`template[].code`).
Chữ trên nút và nhãn của app (không phải nội dung) nằm trong `i18n.js`.

## manifest.json

```json
{
  "title": { "vi": "Tiêu đề trang", "en": "Page title" },
  "subtitle": { "vi": "Dòng mô tả", "en": "Subtitle" },
  "phases": ["phase-0-nen-tang.json", "phase-1-co-ban.json"],
  "codeReviewChecklist": [{ "id": "edge", "text": { "vi": "Đã xét edge case", "en": "Edge cases covered" } }]
}
```

- `phases`: danh sách file giai đoạn, theo đúng thứ tự hiển thị. Thêm giai đoạn mới = tạo file mới rồi thêm tên file vào đây.
- `codeReviewChecklist`: các ô tự review ở tab "Ghi chú & review" của mọi mục.

## File giai đoạn

```json
{
  "id": "p6",
  "name": { "vi": "Giai đoạn 6 · System design", "en": "Phase 6 · System design" },
  "time": { "vi": "2 tuần", "en": "2 weeks" },
  "items": [ ... ]
}
```

Mỗi mục trong `items`. Chỉ `id`, `type`, `title` là bắt buộc; trường nào có thì hiện, không có thì thôi:

| Trường | Ý nghĩa |
|---|---|
| `id` | Khoá lưu tiến độ, không trùng với mục khác. **Đặt 1 lần rồi đừng đổi**, đổi là mất tick và ghi chú của mục đó |
| `type` | `"theory"` (Lý thuyết) hoặc `"practice"` (Luyện bài) |
| `title` | Tên mục |
| `description` | Mô tả. Xuống 2 dòng (`\n\n`) để tách đoạn |
| `keyPoints` | Danh sách ý chính |
| `examples` | `[{ "title", "input", "output", "explain" }]` |
| `template` | Code mẫu, mỗi ngôn ngữ 1 phần tử: `[{ "lang": "python", "code": ["dòng 1", "dòng 2"] }, { "lang": "java", "code": [...] }]`. Hiện thành các tab Python / Java |
| `complexity` | Độ phức tạp |
| `pitfalls` | Danh sách lỗi hay gặp |
| `problems` | Bài cần giải, có ô tick: `[{ "title", "url", "level", "note", "guides" }]`. App tự gom theo trang (LeetCode, HackerRank, CSES...). `level`: `Easy` / `Medium` / `Hard` (HackerRank có thêm `Advanced`). `guides` (không bắt buộc): link hướng dẫn riêng cho bài, `[{ "title", "url" }]`, xem phần "Cách giải" bên dưới |
| `resources` | Tài liệu: `[{ "type", "title", "url" }]` |

`type` của `resources`:

- `article`, `video`, `course`, `docs`, `book`, `visual`: hiện ở tab "Kiến thức", phần "Tài liệu miễn phí".
- `practice` (danh sách bài theo tag, study plan, contest...): hiện ở tab "Bài tập", phần "Danh sách bài khác".

Trong text có thể viết `` `code` `` và `**chữ đậm**`.

Bài tập được tính theo `url`: cùng 1 bài xuất hiện ở nhiều mục thì tick ở đâu cũng tính chung.

### Cách giải

Mỗi bài ở tab "Bài tập" có nút "Cách giải". Không cần thêm gì vào data, app tự tạo từ `url` của bài:

- Link lời giải: LeetCode (editorial, solutions), HackerRank (editorial, discussions), AtCoder (editorial). Trang khác (CSES...) thì là link tìm Google. Cuối cùng là link tìm video trên YouTube.
- Hỏi AI: copy sẵn câu hỏi (tên bài, link, mục đang học, ngôn ngữ code đang chọn) rồi mở Claude hoặc ChatGPT. Có 2 kiểu: "Chỉ gợi ý" và "Giải thích từng bước". Nội dung câu hỏi nằm trong `i18n.js` (key `prompt.hint`, `prompt.explain`).

Tìm được bài hướng dẫn hay cho 1 bài cụ thể thì thêm vào `guides`, link đó hiện đầu tiên:

```json
{ "title": "Two Sum", "url": "https://leetcode.com/problems/two-sum/", "level": "Easy",
  "guides": [{ "title": { "vi": "Giải thích bằng hash map", "en": "Hash map walkthrough" }, "url": "https://..." }] }
```

## Tiến độ

Tick, ghi chú, code của bạn không nằm trong các file này.

- Mở app bằng `start.sh` (server `server.js`): mỗi thay đổi được tự lưu vào `progress/progress.json` ở thư mục gốc project, nên đổi trình duyệt vẫn giữ nguyên tiến độ. Lần đầu mở ở một trình duyệt, tiến độ cũ trong trình duyệt đó được gộp vào file.
- Mở cách khác (mở thẳng file, Live Server...): chỉ lưu trong trình duyệt (localStorage). Dòng chữ ở cuối trang cho biết đang lưu ở đâu.

Dùng nút "Xuất tiến độ" để sao lưu ra file, "Nhập tiến độ" để khôi phục hoặc chuyển sang máy khác. File `progress/progress.json` cũng nhập lại được bằng nút này.
