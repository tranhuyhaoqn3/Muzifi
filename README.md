# 🎵 Muzifi - Music & Video Streaming PWA

Ứng dụng web tiến bộ (PWA) nghe nhạc và phát video đa nền tảng, hỗ trợ stream trực tuyến, lưu trữ offline chất lượng cao, phát nhạc nền liên tục khi tắt màn hình và tương thích hoàn hảo với hệ thống điều khiển màn hình khóa (Lock Screen Controls) trên cả iOS và Android.

![Muzifi Banner](web/logo.png)

---

## ✨ Tính Năng Nổi Bật

* **🎧 Phát nhạc nền & Điều khiển màn hình khóa (Lock Screen / Background Playback):**
  * Tích hợp chuẩn **Media Session API**: Nhận diện đầy đủ bài hát, nghệ sĩ, ảnh bìa độ phân giải cao và các nút điều khiển (*Phát/Tạm dừng*, *Bài trước*, *Bài tiếp theo*, *Kéo tua trên thanh tiến trình*).
  * Hỗ trợ **WebKit Audio Session** (`navigator.audioSession.type = 'playback'`): Đảm bảo nhạc tiếp tục phát liên tục khi khóa màn hình hoặc chuyển sang ứng dụng khác trên iPhone / iPad và Android.

* **📥 Nghe Offline & Lưu Trữ Độc Lập:**
  * Lưu trữ bài hát trực tiếp vào **IndexedDB** và **Cache Storage** của thiết bị.
  * Nghe lại trọn vẹn toàn bộ thư viện khi mất mạng hoặc ngắt kết nối Internet.

* **🎤 Lời Bài Hát Đồng Bộ (Synced Lyrics):**
  * Tự động tìm kiếm và đồng bộ lời bài hát chạy chữ theo thời gian thực (chuẩn LRC).

* **🎛️ Bộ Điều Khiển Đầy Đủ:**
  * **Chế độ phát:** Xáo trộn danh sách (Shuffle), Lặp lại 1 bài / tất cả (Loop mode).
  * **Tốc độ phát:** Tùy chỉnh tốc độ từ `0.25x` đến `3.0x`.
  * **Hẹn giờ ngủ (Sleep Timer):** Tự động tắt nhạc sau số phút định sẵn hoặc khi hết bài.

* **📑 Quản Lý Danh Sách Phát (Playlists):**
  * Tạo playlist cá nhân, kéo thả đổi thứ tự bài hát mượt mà (SortableJS).
  * Tùy chỉnh ảnh đại diện cho playlist từ danh sách bài hát hoặc upload avatar.

* **📱 Chuẩn PWA (Progressive Web App):**
  * Cài đặt vào màn hình chính (Add to Home Screen) trên iOS Safari và Android Chrome chạy như ứng dụng Native toàn màn hình, không có thanh địa chỉ trình duyệt.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

* **Frontend:**
  * Vanilla JavaScript (ES Modules, Không phụ thuộc framework nặng).
  * Vanilla CSS3 (Custom Properties, Glassmorphism, Responsive Mobile-first).
  * Service Worker, Cache API & IndexedDB Storage.
  * Vite (Bộ đóng gói client tốc độ cao).

* **Backend:**
  * **Runtime:** Node.js (ES Modules).
  * **Framework:** Express.js.
  * **Database:** SQLite (thông qua `better-sqlite3` hiệu năng cao).
  * **Media Services:** `ffmpeg` và `yt-dlp` cho việc trích xuất và tối ưu hóa luồng âm thanh.

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Yêu cầu hệ thống
* **Node.js** phiên bản 18+ trở lên.
* **FFmpeg** đã cài đặt trong PATH hệ thống.

### 2. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 3. Cấu hình môi trường
Tạo file `.env` từ file mẫu:
```bash
cp .env.example .env
```
Chỉnh sửa cấu hình cổng (PORT), thư mục lưu trữ (DATA_DIR) và secret key nếu cần.

### 4. Build mã nguồn Client
```bash
npm run build
```

### 5. Khởi chạy Server
```bash
npm start
```
Ứng dụng sẽ hoạt động tại: **`http://localhost:3000`**

---

## 📱 Hướng Dẫn Cài Đặt Lên Điện Thoại (PWA)

* **Trên iPhone / iPad (iOS Safari):**
  1. Mở trang web trong trình duyệt Safari.
  2. Bấm vào nút **Chia sẻ (Share)** ở thanh công cụ dưới cùng.
  3. Chọn **"Thêm vào Màn hình chính" (Add to Home Screen)**.
* **Trên Android (Chrome):**
  1. Mở trang web trong trình duyệt Chrome.
  2. Nhấp vào menu 3 chấm ở góc phải.
  3. Chọn **"Cài đặt ứng dụng"** hoặc **"Thêm vào Màn hình chính"**.

---

## 📄 Bản Quyền & Giấy Phép
Dự án được xây dựng và phát triển bởi [tranhuyhaoqn3](https://github.com/tranhuyhaoqn3).
Phát hành dưới giấy phép MIT License.
