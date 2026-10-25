# DSA Roadmap — web (máy tính)

App web và server chạy trên máy tính. App Android ở [../mobile](../mobile/README.md) cũng dùng chính code trong thư mục này.

## Chạy

1. Cần Node.js. Lần đầu chạy `npm install` trong thư mục này (để Tailwind build CSS).
2. Chạy `start.sh`, app mở ở `http://localhost:8080`.
3. Đồng bộ Google Drive: đặt `google-oauth.json` vào thư mục này (cách lấy: [README.md](../README.md) ở thư mục gốc), rồi bấm **Kết nối Google Drive** ở cuối trang.
   `server.js` lưu đăng nhập vào `progress/google-token.json` (đã gitignore), lần sau mở không phải đăng nhập lại.

Đổi sang tài khoản Google khác: xoá `progress/google-token.json` rồi kết nối lại.

`progress/progress.json` là file tiến độ của bản trước khi có Drive. App không ghi vào file này nữa; muốn lấy lại dữ liệu cũ thì dùng nút **Nhập tiến độ**.

## File

| File | Vai trò |
| --- | --- |
| `index.html`, `main.js`, `i18n.js`, `index.css` | App web. `build/app.css` do Tailwind build từ `index.css`, không sửa tay |
| `data/` | Nội dung lộ trình, xem [data/README.md](data/README.md) |
| `server.js` | Phục vụ file cho trình duyệt, giữ đăng nhập Google (`/api/google/*`) |
| `start.sh` | Chạy `server.js` và Tailwind (tự build lại CSS khi sửa class) |

Thêm file mới mà trang cần tải (script, ảnh...) thì thêm cả vào danh sách trong `mobile/scripts/build-web.js`, để app Android có file đó.
