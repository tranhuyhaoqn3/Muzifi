# Muzifi 🎵

> Ứng dụng Web / PWA nghe nhạc offline, phát video cá nhân, tìm kiếm và phát nhạc nền liên tục với đầy đủ tính năng điều khiển trên màn hình khóa iOS & Android.

---

## ✨ Tính Năng Nổi Bật

- 📱 **Tối ưu PWA & Màn hình khóa (Lock Screen Controls)**:
  - Hỗ trợ Media Session API đầy đủ: Phát, Tạm dừng, Bài trước, Bài tiếp theo và thanh trượt tua bài (Timeline Scrubber) trực tiếp từ màn hình khóa iOS (iOS 15+) và Android Notification Shade.
  - Cấu hình WebKit Audio Session (`playback`) ngăn ngừa Safari bị dừng khi tắt màn hình.
  - Thêm vào Màn hình chính (Add to Home Screen) hoạt động độc lập như Native App.

- 🎧 **Trình Phát Nhạc Toàn Diện**:
  - Giao diện Full Player & Mini Player hiện đại, mượt mà (Glassmorphism, Dark Mode).
  - Đầy đủ chế độ phát: Xáo trộn (Shuffle), Lặp lại (Tắt / Lặp tất cả / Lặp 1 bài).
  - Tùy chỉnh tốc độ phát (0.25x – 3.0x), hẹn giờ ngủ (Sleep Timer) theo thời gian hoặc khi hết bài.
  - Hỗ trợ lời bài hát đồng bộ thời gian thực (Synced Lyrics) và danh sách bài tiếp theo (Up Next).

- ⚡ **Lưu Trữ & Nghe Offline Độc Lập**:
  - Lưu trữ trực tiếp file âm thanh và ảnh bìa vào IndexedDB client-side.
  - Nghe nhạc mượt mà ngay cả khi không có mạng Internet.
  - Tải bài hát trực tiếp về thiết bị với chất lượng cao.

- 🗂️ **Quản Lý Thư Viện & Playlist**:
  - Tạo playlist không giới hạn, sắp xếp thứ tự bài hát bằng thao tác kéo thả (Drag & Drop).
  - Tùy chỉnh ảnh bìa playlist từ ảnh bài hát hoặc upload từ máy tính.
  - Phân loại thư viện thông minh (Bài hát, Video, Playlist, Thư viện Offline).

- 🚀 **Hiệu Năng Cao & Nhẹ Nhàng**:
  - Xây dựng bằng Vanilla JavaScript và Vanilla CSS, không phụ thuộc framework UI cồng kềnh.
  - Backend Node.js Express kết hợp cơ sở dữ liệu siêu nhanh Better-SQLite3.
  - Cache stream thông minh, quản lý hàng đợi tải ngầm.

---

## 🛠️ Công Nghệ Sử Dụng

- **Frontend**: Vanilla JavaScript (ES Modules), Vanilla CSS, Vite, Service Worker, IndexedDB API, Media Session API.
- **Backend**: Node.js, Express.js, Better-SQLite3, yt-dlp, FFmpeg.
- **Kiến trúc**: RESTful API, PWA (Progressive Web App).

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy

### Yêu cầu hệ thống:
- [Node.js](https://nodejs.org/) (phiên bản 18+ trở lên)
- [FFmpeg](https://ffmpeg.org/) (đã cấu hình biến môi trường PATH)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (nếu dùng tính năng stream trực tuyến)

### Các bước cài đặt:

1. **Clone repository:**
   ```bash
   git clone https://github.com/tranhuyhaoqn3/Muzifi.git
   cd Muzifi
   ```

2. **Cài đặt các gói phụ thuộc:**
   ```bash
   npm install
   ```

3. **Cấu hình môi trường:**
   Tạo file `.env` từ file mẫu:
   ```bash
   cp .env.example .env
   ```
   Chỉnh sửa các thông số cần thiết trong `.env` (Cổng PORT, DATA_DIR, JWT_SECRET...).

4. **Build giao diện người dùng:**
   ```bash
   npm run build
   ```

5. **Khởi chạy máy chủ:**
   ```bash
   npm start
   ```

Ứng dụng sẽ hoạt động tại địa chỉ: `http://localhost:3000`

---

## 📂 Cấu Trúc Thư Mục

```text
├── server/                 # Mã nguồn backend (Express, SQLite, Services)
│   ├── routes/             # API routes (tracks, playlists, youtube, auth...)
│   ├── services/           # Services (ffmpeg, yt-dlp, storage, queue...)
│   ├── db.js               # Khởi tạo SQLite database
│   └── index.js            # Entry point của server
├── web/                    # Mã nguồn frontend client
│   ├── src/                # JavaScript components, styles, state management
│   ├── index.html          # Trang chính ứng dụng (PWA)
│   └── sw.js               # Service Worker quản lý offline cache
├── scripts/                # Scripts hỗ trợ (post-build sync...)
├── Dockerfile              # Docker container deployment
└── docker-compose.yml      # Docker Compose setup
```

---

## 📜 Giấy Phép (License)

Dự án được phát triển phục vụ mục đích học tập và giải trí cá nhân.
