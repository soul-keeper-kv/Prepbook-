# Gợi ý theo module

Đây không phải nội dung chính của app: những gì bạn học nằm trong notebook do bạn tự viết.
Thư mục này chứa **gợi ý**, chia theo module, mỗi module gắn với một chủ đề. Trang chủ đề hiện gợi ý của mọi module gắn với nó:

- bấm **Thêm** thì một mục thành pattern trống của bạn;
- bài và tài liệu của mục hiện ở trang pattern, chỉ thêm khi bạn bấm;
- link bài bạn dán vào (Hộp thu, ô thêm bài) được nhận ra: lấy sẵn tên và mức;
- module `dsa` còn là nguồn để chuyển tiến độ của bản cũ (lần đầu mở bản mới, hoặc nút **Nhập dữ liệu**).

## Cấu trúc

```text
data/
  README.md
  dsa/                              1 module = 1 thư mục
    module.json                     gắn với chủ đề nào, tên hiện trên khung gợi ý
    00-language-fundamentals.json   1 file = 1 giai đoạn
    01-core-thinking.json
    ...
  java/                             module sau này, cùng cách đặt
    module.json
    01-collections.json
```

## Quy tắc đặt tên

| Cái gì                | Quy tắc                                                                    | Ví dụ                              |
| --------------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| Thư mục module        | Tiếng Anh, chữ thường, kebab-case                                          | `dsa`, `java`, `system-design`     |
| File giai đoạn        | `NN-ten.json`: 2 chữ số thứ tự, rồi tên tiếng Anh kebab-case               | `01-core-thinking.json`            |
| `id` giai đoạn và mục | Chữ thường kebab-case, **không trùng trong cả `data/`**, kể cả khác module | `java-collections`, `java-hashmap` |

- Thứ tự giai đoạn lấy theo số đầu tên file, không khai báo ở đâu khác. Hai file trong một module không được trùng số.
  Muốn chèn giữa thì đổi số các file sau: đổi tên file không ảnh hưởng gì, vì `id` nằm trong file.
- Module xếp theo tên thư mục.
- Mọi file phải nằm đúng `data/<module>/<file>.json`, không để file lẻ ở ngoài hay lồng thư mục.

App kiểm tra hết các quy tắc trên lúc nạp: sai thì báo tên file và chỗ sai.

## `id`: đặt 1 lần rồi đừng đổi

Pattern tạo từ một mục giữ `id` của mục (`pt_<id>`), giai đoạn cũng vậy (`ph_<id>`).
Nhờ đó trang pattern biết lấy gợi ý ở đâu, và 2 máy cùng thêm 1 mục thì ra 1 pattern. Đổi `id` là mất liên kết với thứ bạn đã thêm.

- Module mới: `id` bắt đầu bằng tên module để khỏi trùng, ví dụ `java-collections`, `java-hashmap`.
- Module `dsa` giữ `id` cũ (`p0`, `p0-lang`, ...) vì notebook và tiến độ bản cũ đã dùng chúng.
- Đừng đổi tên thư mục `dsa`: code tìm tiến độ bản cũ theo tên này (`LEGACY_MODULE` trong `src/progress/legacy.ts`).

## module.json

```json
{
  "topic": "t_java",
  "title": { "vi": "Java Core cơ bản", "en": "Java Core basics" }
}
```

| Trường  | Ý nghĩa                                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `topic` | Chủ đề hiện module này. Phải là 1 chủ đề mặc định (id cố định, xem `src/notebook/templates.ts`): `t_dsa`, `t_java`, `t_db`, `t_sd`, `t_spring`, `t_behavioral` |
| `title` | Tên module, hiện trên khung gợi ý: "Gợi ý: _title_". Nên ngắn (2–4 chữ) vì khung hẹp                                                                           |

Nhiều module cùng gắn 1 chủ đề thì trang chủ đề hiện nhiều khung gợi ý.

## File giai đoạn

```json
{
  "id": "java-collections",
  "name": { "vi": "Giai đoạn 1 · Collections", "en": "Phase 1 · Collections" },
  "items": [
    {
      "id": "java-hashmap",
      "title": { "vi": "HashMap hoạt động thế nào", "en": "How HashMap works" },
      "problems": [
        { "title": "Design HashMap", "url": "https://leetcode.com/problems/design-hashmap/", "level": "Easy" }
      ],
      "resources": [
        { "type": "docs", "title": "HashMap (Java SE 21)", "url": "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html" }
      ]
    }
  ]
}
```

| Trường      | Ý nghĩa                                                                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | Id giai đoạn                                                                                                                                                                            |
| `name`      | Tên giai đoạn, thành tên giai đoạn trong notebook khi thêm mục đầu tiên của nó                                                                                                          |
| `items`     | Các mục. Mỗi mục có `id`, `title` (thành tên pattern khi được thêm), và `problems`, `resources` nếu có                                                                                  |
| `problems`  | Bài gợi ý: `{ "title", "url", "level", "guides" }`. `level`: `Easy` / `Medium` / `Hard` (HackerRank có thêm `Advanced`, `Expert`). Mục không có bài nào thành pattern "lý thuyết thuần" |
| `resources` | Tài liệu gợi ý: `{ "type", "title", "url" }`. `type`: `article`, `video`, `course`, `docs`, `book`, `visual`, `practice`                                                                |

Chỉ có các trường này, và trường nào cũng được app đọc. Gõ sai tên trường hay thêm trường lạ thì app báo lỗi, không bỏ qua.
URL phải là http(s). Tên là văn bản thuần, không dùng Markdown.

Cùng 1 link bài ở nhiều mục (kể cả khác module) vẫn là 1 bài trong notebook (khớp theo link, bỏ qua `www.`, dấu `/` cuối và phần sau tên bài của LeetCode).

Nội dung bài học của lộ trình cũ (mô tả, ý chính, ví dụ, code mẫu, độ phức tạp, bẫy, thời gian từng giai đoạn, checklist) không còn ở đây vì app đã thôi hiện chúng. Cần xem lại thì lấy trong git ở commit `52e11c1`.

## Thêm một module

1. Tạo thư mục `data/<module>/`.
2. Tạo `module.json` với `topic` và `title`.
3. Mỗi giai đoạn một file `01-<ten>.json`, `02-<ten>.json`, ...; `id` bắt đầu bằng `<module>-`.
4. Chạy `npm test`, hoặc mở app: sai chỗ nào app báo chỗ đó.

## Hai ngôn ngữ (vi / en)

Mọi trường chữ đều viết được theo 2 cách:

- Chuỗi thường: hiện giống nhau ở mọi ngôn ngữ, ví dụ `"title": "Two Sum"`.
- Theo ngôn ngữ: `"title": { "vi": "Dạng bài Stack", "en": "Stack problems" }`. Thiếu `en` thì app dùng `vi`.

Khi một gợi ý được thêm vào notebook, tên được chép theo ngôn ngữ đang chọn lúc đó; sau đó là chữ của bạn, không đổi theo ngôn ngữ nữa.
Chữ trên nút và nhãn của app nằm trong `src/i18n/locales/`.

## Gợi ý khi bí

Trang của mỗi bài có phần **Bí? Xem gợi ý**, app tự tạo từ link của bài: link lời giải (LeetCode, HackerRank, AtCoder; trang khác thì tìm Google), video trên YouTube, và câu hỏi soạn sẵn để mở Claude hoặc ChatGPT. Nội dung câu hỏi nằm trong `src/i18n/locales/` (key `prompt.hint`, `prompt.explain`).

`guides` của một bài (không bắt buộc) là link hướng dẫn riêng, hiện đầu tiên:

```json
{ "title": "Two Sum", "url": "https://leetcode.com/problems/two-sum/", "level": "Easy",
  "guides": [{ "title": { "vi": "Giải thích bằng hash map", "en": "Hash map walkthrough" }, "url": "https://..." }] }
```

Bài bạn tự thêm cũng có các link này khi link của nó trùng một bài ở đây.

## Sửa và kiểm tra

- Đang chạy `npm run dev`: lưu file JSON là trang tự cập nhật.
- Chạy bằng `start.sh`: chạy lại `start.sh` (nó build lại mỗi lần).
- Lúc nạp, app kiểm tra từng file theo `src/content/schema.ts` và các quy tắc đặt tên ở `src/content/load.ts`. `npm test` cũng kiểm tra toàn bộ thư mục này.
- Prettier bỏ qua thư mục này để giữ kiểu viết tay: mỗi bài hay tài liệu nằm trên một dòng.

## Dữ liệu của bạn

Pattern, bài, lần làm, ghi chú và thẻ của bạn không nằm trong các file này: chúng ở trong trình duyệt và trong file `interview-prep-notebook.json` trên Google Drive. Cách đồng bộ xem [README.md](../../README.md).
