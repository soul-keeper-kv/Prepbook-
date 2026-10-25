# DSA Roadmap — web (máy tính)

App React và server chạy trên máy tính. App Android ở [../mobile](../mobile/README.md) đóng gói chính bản build của thư mục này.

## Chạy

Cần Node.js 22.18 trở lên.

| Lệnh            | Dùng khi                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `./start.sh`    | Dùng hằng ngày. Lần đầu tự `npm ci`; mỗi lần chạy build lại rồi mở app ở `http://localhost:3303` |
| `npm run dev`   | Đang sửa code hoặc `data/`: cũng mở ở `http://localhost:3303`, lưu file là trang tự cập nhật     |
| `npm run check` | Trước khi commit: kiểm tra kiểu (TypeScript), lint, format và chạy test                          |

Cả 2 cách đều đồng bộ được Google Drive: đặt `google-oauth.json` vào thư mục này (cách lấy: [README.md](../README.md) ở thư mục gốc), rồi bấm **Kết nối Google Drive** ở cuối trang.
Đăng nhập được lưu vào `progress/google-token.json` (đã gitignore), lần sau mở không phải đăng nhập lại.
Đổi sang tài khoản Google khác: xoá `progress/google-token.json` rồi kết nối lại.

Cả 2 cách dùng chung cổng 3303 (đặt ở `server/config.ts`, đổi tạm bằng biến `PORT`), nên chỉ chạy được 1 cách mỗi lúc. Lợi ích: trình duyệt coi đó là cùng 1 trang và giữ chung 1 bản tiến độ.

Bản trước dùng cổng 8080. Tiến độ lưu trong trình duyệt gắn với địa chỉ trang, nên tiến độ cũ ở `localhost:8080` không tự hiện ở `localhost:3303`. Để chuyển sang: chạy 1 lần `PORT=8080 ./start.sh`, bấm **Xuất tiến độ**, rồi mở lại bằng `./start.sh` và **Nhập tiến độ**. Đã kết nối Google Drive thì không cần, tiến độ tự về từ Drive.

`progress/progress.json` là file tiến độ của bản trước khi có Drive. App không ghi vào file này nữa; muốn lấy lại dữ liệu cũ thì dùng nút **Nhập tiến độ**.

## Công nghệ

| Phần              | Thư viện                                                                     |
| ----------------- | ---------------------------------------------------------------------------- |
| Build, dev server | Vite 8                                                                       |
| Giao diện         | React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Radix), lucide-react        |
| Tô màu code mẫu   | Shiki với theme Light+ / Dark+ của VS Code (tải riêng từng ngôn ngữ khi cần) |
| State             | Zustand                                                                      |
| Kiểm tra dữ liệu  | Zod (nội dung `data/`, file tiến độ, phản hồi của Drive API)                 |
| Song ngữ          | i18next + react-i18next                                                      |
| Test              | Vitest, Testing Library, jsdom                                               |
| Chất lượng code   | ESLint, Prettier (+ plugin sắp xếp class Tailwind)                           |

## Thư mục

| Đường dẫn               | Vai trò                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `data/`                 | Nội dung lộ trình, xem [data/README.md](data/README.md). Được gom vào bản build và kiểm tra theo `src/content/schema.ts` |
| `src/content/`          | Schema và cách nạp nội dung, link lời giải, câu hỏi gửi AI                                                               |
| `src/progress/`         | Tiến độ: định dạng, logic (gộp, cần ôn), store, xuất/nhập file                                                           |
| `src/sync/`             | Đồng bộ Google Drive                                                                                                     |
| `src/components/ui/`    | Component của shadcn/ui (đã chỉnh lại cho giống VS Code)                                                                 |
| `src/components/`       | Component của app: trang chính, danh sách giai đoạn, màn hình chi tiết                                                   |
| `src/i18n/locales/`     | Chữ giao diện tiếng Việt / tiếng Anh. Thêm key thì thêm ở cả 2 file (có test kiểm tra)                                   |
| `src/index.css`         | Bảng màu VS Code (Light+ / Dark+), cỡ chữ, style gốc                                                                     |
| `server/serve.ts`       | Server cục bộ: phục vụ `dist/` và giữ đăng nhập Google. Node chạy thẳng file `.ts`                                       |
| `server/google-auth.ts` | Đăng nhập Google (`/api/google/*`), dùng chung cho `serve.ts` và `npm run dev`                                           |

Thêm component shadcn: `npx shadcn@latest add <tên>`, rồi đổi `import { cn } from "cn"` trong file mới thành `import { cn } from "@/lib/utils"` (bản này biết các cỡ chữ riêng của app như `text-13`).
