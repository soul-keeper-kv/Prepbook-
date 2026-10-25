# Interview Prep — web (máy tính)

App React và server chạy trên máy tính. App Android ở [../mobile](../mobile/README.md) đóng gói chính bản build của thư mục này.

## Chạy

Cần Node.js 22.18 trở lên.

| Lệnh            | Dùng khi                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `./start.sh`    | Dùng hằng ngày. Lần đầu tự `npm ci`; mỗi lần chạy build lại rồi mở app ở `http://localhost:3303` |
| `npm run dev`   | Đang sửa code hoặc `data/`: cũng mở ở `http://localhost:3303`, lưu file là trang tự cập nhật     |
| `npm run check` | Trước khi commit: kiểm tra kiểu (TypeScript), lint, format và chạy test                          |

Cả 2 cách đều đồng bộ được Google Drive: đặt `google-oauth.json` vào thư mục này (cách lấy: [README.md](../README.md) ở thư mục gốc), rồi bấm **Kết nối Google Drive** ở trang **Cài đặt** (bánh răng cuối thanh bên trái).
Đăng nhập được lưu vào `progress/google-token.json` (đã gitignore), lần sau mở không phải đăng nhập lại.
Đổi sang tài khoản Google khác: xoá `progress/google-token.json` rồi kết nối lại.

Cả 2 cách dùng chung cổng 3303 (đặt ở `server/config.ts`, đổi tạm bằng biến `PORT`), nên chỉ chạy được 1 cách mỗi lúc. Lợi ích: trình duyệt coi đó là cùng 1 trang và giữ chung 1 bản dữ liệu.

Tiến độ của bản cũ (lộ trình DSA có tick): lần đầu mở bản mới, tiến độ cũ đang lưu trong trình duyệt được tự chuyển thành pattern và bài tập. Tiến độ cũ chỉ nằm ở nơi khác thì nhập bằng nút **Nhập dữ liệu** ở trang Cài đặt, app nhận cả:

- file "Xuất tiến độ" của bản cũ, và file `dsa-roadmap-progress.json` tải từ Drive (bản mới không đọc file này tự động: nó dùng file Drive mới `interview-prep-notebook.json`);
- tiến độ ở cổng 8080 của bản trước nữa (trình duyệt giữ dữ liệu theo từng địa chỉ): chạy 1 lần `PORT=8080 ./start.sh`, app tự chuyển tiến độ ở địa chỉ đó; rồi bấm **Xuất dữ liệu** và nhập file ở `localhost:3303` (hoặc kết nối Google Drive ở cả 2 nơi);
- `progress/progress.json`, file tiến độ của bản trước khi có Drive.

## Công nghệ

| Phần              | Thư viện                                                                     |
| ----------------- | ---------------------------------------------------------------------------- |
| Build, dev server | Vite 8                                                                       |
| Giao diện         | React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Radix), lucide-react        |
| Tô màu code mẫu   | Shiki với theme Light+ / Dark+ của VS Code (tải riêng từng ngôn ngữ khi cần) |
| State             | Zustand                                                                      |
| Cây chủ đề        | Headless Tree (kéo thả, phím tắt, vai trò ARIA của cây)                      |
| Graph             | react-force-graph-2d (canvas, d3-force), chỉ tải khi mở trang Graph          |
| Kiểm tra dữ liệu  | Zod (nội dung `data/`, notebook, file tiến độ cũ, phản hồi của Drive API)    |
| Song ngữ          | i18next + react-i18next                                                      |
| Test              | Vitest, Testing Library, jsdom                                               |
| Chất lượng code   | ESLint, Prettier (+ plugin sắp xếp class Tailwind)                           |

## Thư mục

| Đường dẫn               | Vai trò                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/`                 | Lộ trình DSA cũ, giờ chỉ dùng làm gợi ý, xem [data/README.md](data/README.md). Kiểm tra theo `src/content/schema.ts`                                                                      |
| `src/notebook/`         | Dữ liệu người dùng viết: định dạng (`schema.ts`), thao tác (`store.ts`), tính lịch ôn và mức (`logic.ts`), gộp 2 bản (`merge.ts`), chuyển tiến độ cũ (`migrate.ts`), gợi ý từ lộ trình cũ |
| `src/content/`          | Nạp lộ trình cũ trong `data/`, link lời giải, câu hỏi gửi AI                                                                                                                              |
| `src/progress/`         | Định dạng tiến độ của bản cũ, chỉ đọc 1 lần để chuyển sang notebook                                                                                                                       |
| `src/sync/`             | Đồng bộ Google Drive                                                                                                                                                                      |
| `src/pages/`            | Các trang: Hôm nay, Hộp thu, Ôn lại, Chủ đề, Pattern, Bài, Graph, Tìm, Cài đặt                                                                                                            |
| `src/components/`       | Khung app (`shell/`), phần dùng chung (`common/`), phần của trang pattern và trang bài                                                                                                    |
| `src/components/ui/`    | Component của shadcn/ui (đã chỉnh lại cho giống VS Code)                                                                                                                                  |
| `src/state/router.ts`   | Địa chỉ trang theo hash (`#/pattern/<id>`): chạy được trên server tĩnh và trong app Android                                                                                               |
| `src/i18n/locales/`     | Chữ giao diện tiếng Việt / tiếng Anh. Thêm key thì thêm ở cả 2 file (có test kiểm tra)                                                                                                    |
| `src/index.css`         | Bảng màu VS Code (Light+ / Dark+), cỡ chữ, style gốc                                                                                                                                      |
| `server/serve.ts`       | Server cục bộ: phục vụ `dist/` và giữ đăng nhập Google. Node chạy thẳng file `.ts`                                                                                                        |
| `server/google-auth.ts` | Đăng nhập Google (`/api/google/*`), dùng chung cho `serve.ts` và `npm run dev`                                                                                                            |

Quy tắc giao diện (màu, chữ, bố cục, i18n, accessibility) nằm ở skill [prep-ui](../.claude/skills/prep-ui/SKILL.md).

Thêm component shadcn: `npx shadcn@latest add <tên>`, rồi đổi `import { cn } from "cn"` trong file mới thành `import { cn } from "@/lib/utils"` (bản này biết các cỡ chữ riêng của app như `text-13`).
