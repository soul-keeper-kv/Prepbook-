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
- Module `dsa` giữ `id` cũ (`p0`, `p0-lang`, ...) vì notebook và tiến độ bản cũ đã dùng chúng. Mục mới của `dsa` đặt `p<số giai đoạn>-<tên>`, ví dụ `p2-fast-slow`.
  Số đó là giai đoạn lúc tạo mục: chuyển mục sang giai đoạn khác thì giữ nguyên `id` (`p5-trie` giờ nằm ở giai đoạn 3).
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
      ],
      "notes": {
        "what": { "vi": ["Bảng băm: mảng các bucket, ..."], "en": ["A hash table: an array of buckets, ..."] }
      }
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
| `lesson`    | Bài giảng cho người mới, đọc trước khi viết ghi chú, xem phần dưới                                                                                                                      |
| `guide`     | Giải thích riêng cho từng bước của Lộ trình học (Nhận diện, Ý tưởng, Template, Bẫy), xem phần dưới                                                                                      |
| `quiz`      | Câu hỏi trắc nghiệm luyện nhận diện, xem phần dưới                                                                                                                                      |
| `notes`     | Lý thuyết mẫu cho các mục ghi chú của pattern, xem phần dưới                                                                                                                            |

Chỉ có các trường này, và trường nào cũng được app đọc. Gõ sai tên trường hay thêm trường lạ thì app báo lỗi, không bỏ qua.
URL phải là http(s). Tên là văn bản thuần; chỉ `lesson` và `notes` dùng Markdown.

Cùng 1 link bài ở nhiều mục (kể cả khác module) vẫn là 1 bài trong notebook (khớp theo link, bỏ qua `www.`, dấu `/` cuối và phần sau tên bài của LeetCode).

## Viết tiếng Việt: thuật ngữ giữ tiếng Anh

Câu viết bằng tiếng Việt, còn **thuật ngữ kỹ thuật giữ nguyên tiếng Anh**, đúng như trong đề LeetCode, tag, lời giải và lúc phỏng vấn. Đề bài viết "sorted array", "subarray", "in-place"; ghi chú dịch thành "mảng đã sắp xếp", "đoạn con", "tại chỗ" thì người đọc phải dịch ngược lại mới nhận ra trong đề, và nhiều từ dịch còn khó hiểu hơn từ gốc.

- Không kèm bản dịch trong ngoặc ("Two Pointers (hai con trỏ)"). Lần đầu gặp một thuật ngữ người mới có thể chưa biết, giải thích nghĩa của nó bằng lời thường: "subarray: một đoạn **liên tiếp** của array".
- Giữ tiếng Việt cho lời giải thích và các từ thường: phần tử, số, bước, biến, hàm, vòng `for`, tổng, dấu hiệu.
- Tên dạng của một pattern cũng giữ tiếng Anh: Opposite Direction, Same Direction, Fast & Slow.
- Áp dụng cho mọi chữ tiếng Việt trong `data/`: `title`, `lesson`, `guide`, `quiz`, `notes`, cả comment và bảng chạy tay trong khối code.

| Viết                                                                                       | Không viết                                                       |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| array, string, sorted / unsorted, index, in-place, duplicate                               | mảng, chuỗi, đã sắp xếp, vị trí, tại chỗ, trùng                  |
| subarray, substring, subsequence, subset, permutation, combination, prefix, suffix         | đoạn con, chuỗi con, dãy con, tập con, hoán vị, tổ hợp, tiền tố  |
| Two Pointers, pointer, Sliding Window, window, expand / shrink                             | hai con trỏ, con trỏ, cửa sổ trượt, nới rộng / co cửa sổ         |
| brute force, time / space complexity, extra space, constraints, edge case, dry run         | vét cạn, độ phức tạp, bộ nhớ thêm, giới hạn, trường hợp biên     |
| stack, queue, deque, heap, min-heap, priority queue, hash map, hash set, linked list, node | ngăn xếp, hàng đợi, đống, bảng băm, danh sách liên kết, nút      |
| tree, binary tree, BST, root, leaf, parent, child, subtree, level, depth, height           | cây, cây nhị phân, gốc, lá, cha, con, cây con, tầng, độ sâu      |
| graph, vertex, edge, neighbor, adjacency list, directed / undirected, weight, cycle        | đồ thị, đỉnh, cạnh, láng giềng, danh sách kề, trọng số, chu trình |
| connected component, shortest path, in-degree, spanning tree, grid, cell, matrix, interval | thành phần liên thông, đường đi ngắn nhất, bậc vào, lưới, khoảng |
| recursion, base case, backtracking, greedy, divide and conquer, Binary Search              | đệ quy, điều kiện dừng, quay lui, tham lam, chia để trị          |
| DP, state, transition, memoization, invariant, monotonic, median, overflow                 | quy hoạch động, trạng thái, chuyển trạng thái, bất biến, đơn điệu |
| prime, GCD, modulo, fast power, modular inverse                                            | số nguyên tố, ước chung lớn nhất, đồng dư, lũy thừa nhanh        |
| Template                                                                                   | khung code, khuôn                                                |

## Bài giảng (`lesson`)

Bài giảng là bước đầu của Lộ trình học ("Hiểu pattern"): đọc để hiểu, trước khi viết lại Nhận diện, Ý tưởng, Template bằng lời của mình. App chỉ hiện nó, không chép vào notebook, nên sửa ở đây là thấy ngay.

Viết cho người biết lập trình (Java) nhưng chưa biết pattern, đọc một lượt là hiểu. Theo khuôn của `p1-twoptr`:

1. `## <Pattern> là gì?`: 2–4 câu bằng lời thường.
2. `## Vì sao cần: một bài cụ thể`: một bài nhỏ, brute force tốn bao nhiêu, rồi cách dùng pattern **dry run từng bước** trong khối code `text` (cột thẳng hàng; mỗi bước ghi giá trị các biến và quyết định).
3. `## Vì sao cách này đúng`: ý then chốt, giải thích bằng chính ví dụ ở trên.
4. `## Các dạng thường gặp`: mỗi dạng một câu và một ví dụ nhỏ.
5. `## Template`: Java ngắn, comment tiếng Việt.
6. `## Khi nào nghĩ tới <pattern>?`: 3–5 dấu hiệu trong đề.
7. `## Tự kiểm tra`: 2–3 câu hỏi, không kèm đáp án.

Viết `{ "vi": [...] }`, mảng các dòng. Thiếu `en` thì bản tiếng Anh hiện bản tiếng Việt.

## Giải thích từng bước (`guide`) và trắc nghiệm (`quiz`)

`guide` có cùng tên mục như `notes` (`recognition`, `idea`, `template`, `pitfalls`). Mỗi bước của Lộ trình học hiện phần giải thích của nó trước, rồi mới tới ghi chú của người dùng. Viết như khi trả lời đúng một câu hỏi hẹp: bảng (dấu hiệu → dạng), các câu hỏi để tự quyết định, brute force và cách tối ưu đặt cạnh nhau, đọc từng dòng code, lỗi hay gặp. Mẫu: `p1-twoptr`.

`quiz` hiện ở bước Nhận diện: mỗi câu `{ "question", "options", "answer", "why" }`, `answer` là vị trí đáp án đúng trong `options` (đếm từ 0), `why` hiện ra sau khi người dùng chọn. App không lưu kết quả: đây là luyện tập, không tính mức.

## Lý thuyết mẫu (`notes`)

Mỗi mục có thể kèm lý thuyết cho từng mục ghi chú của pattern. Thêm mục thành pattern là lý thuyết này được chép vào mục ghi chú cùng tên; người dùng viết lại bằng lời của mình (để nguyên bản mẫu thì app không tính là đã học). Mục ghi chú nào bị xoá trắng thì khung Gợi ý ở trang pattern cho chép lại. Sửa `notes` ở đây không đổi gì trong notebook đã có.

Sửa chữ của `notes` đã có thì chạy `npm run samples:legacy` trước khi commit. Lệnh lưu hash của bản cũ vào `src/notebook/legacy-samples.json`, để bản cũ đã chép vào notebook vẫn được nhận là bản mẫu. Thiếu bước này thì bản cũ bị tính là lời của người dùng, và các bước của Lộ trình học hiện là đã xong dù họ chưa viết gì.

Tên các mục theo loại chủ đề của module (`src/notebook/templates.ts`); dùng sai tên thì app báo lỗi:

| Loại chủ đề                  | Các mục                                                        |
| ---------------------------- | -------------------------------------------------------------- |
| `dsa` (DSA)                  | `recognition`, `idea`, `template`, `pitfalls`                  |
| `concept` (Java, DB, Spring) | `what`, `how`, `when`, `pitfalls`                              |
| `design` (System Design)     | `requirements`, `estimates`, `design`, `deepDive`, `tradeoffs` |
| `story` (Hành vi)            | `situation`, `task`, `action`, `result`, `questions`           |

- Giá trị là Markdown, viết thành mảng các dòng (app nối bằng xuống dòng). App hiện được: đoạn văn, tiêu đề `## `, danh sách `- ` và `1. ` (không lồng nhau), `code`, **đậm**, link, bảng `| a | b |` (dòng thứ hai là `| --- | --- |`), khối code (`text` thì không có số dòng, hợp để vẽ bảng dry run).
- Chữ thì viết `{ "vi": [...], "en": [...] }`. Code (`template`) viết một lần, không chia ngôn ngữ, comment tiếng Anh.
- Template của DSA viết bằng Java. Bẫy (`pitfalls`) ở đây là bẫy hay gặp, ghi kèm tên bài trong ngoặc; bẫy của riêng bạn thì bạn tự ghi thêm.
- Mục chỉ là bộ bài luyện (CSES, AtCoder, Codeforces, contest) thì không cần `notes`.

Lý thuyết của lộ trình cũ đã được viết lại theo từng dạng bài trong `notes`. Bản cũ (mô tả, ý chính, ví dụ, code Python, độ phức tạp, checklist) còn trong git ở commit `52e11c1`.

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
