# DSA Roadmap — app Android

Đóng gói app web trong [../web](../web/README.md) thành file APK bằng Capacitor. Thư mục này không có code giao diện:
lúc build, `npm run build:web` build app trong `web/` rồi `scripts/build-web.js` copy `web/dist/` vào `www/`; Capacitor đưa `www/` vào APK.

## Công cụ

Cần JDK 21 và Android SDK. Trên máy này đã cài sẵn ở `%LOCALAPPDATA%\Android\jdk-21` và `%LOCALAPPDATA%\Android\Sdk`,
`scripts/build-android.js` tự tìm ở đó. Máy khác thì cài Android Studio là đủ (script cũng tự tìm JDK đi kèm Android Studio).

## Build và cài

```bash
npm install                  # lần đầu, trong thư mục này (và cả trong ../web)
npm run android:build        # tạo android/app/build/outputs/apk/debug/app-debug.apk
```

Cài lên điện thoại, chọn 1 trong 2 cách:

- Copy file `app-debug.apk` sang điện thoại, mở nó, cho phép "cài ứng dụng không rõ nguồn gốc".
- Hoặc bật **USB debugging** trong *Tùy chọn nhà phát triển*, cắm cáp, chạy `npm run android:install`.

Mở app, bấm **Kết nối Google Drive**, chọn tài khoản, cho phép.
Trước đó phải tạo client Android trên Google Cloud, xem [README.md](../README.md) ở thư mục gốc.

Sửa gì trong `web/` (giao diện, `data/*.json`) thì chạy lại `npm run android:build` và cài đè. Cài đè vẫn giữ tiến độ trong app.

## SHA-1 cho Google Cloud

Client Android trên Google Cloud nhận ra app qua package name `dev.kienpt.dsaroadmap` và SHA-1 của khoá ký APK.
Bản debug ký bằng khoá do lần build đầu tạo ra ở `~/.android/debug.keystore`. Lấy SHA-1 (Git Bash):

```bash
"$LOCALAPPDATA/Android/jdk-21/bin/keytool" -list -v -alias androiddebugkey \
  -keystore ~/.android/debug.keystore -storepass android -keypass android | grep SHA1
```

Build trên máy khác thì khoá khác: thêm SHA-1 của máy đó vào client Android, và gỡ app cũ trước khi cài bản mới.

## File

| File | Vai trò |
| --- | --- |
| `capacitor.config.json` | Tên app, package name, thư mục web (`www/`) |
| `scripts/build-web.js` | Copy bản build `web/dist/` vào `www/` |
| `scripts/build-android.js` | Build APK (và cài qua USB với `--install`) |
| `android/` | Project Android do Capacitor tạo |
| `android/app/src/main/java/dev/kienpt/dsaroadmap/GoogleDrivePlugin.java` | Lấy quyền Google Drive qua Google Play services, vì Google chặn đăng nhập trong WebView |
