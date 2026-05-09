# 🏃 StrAct Z v1.38.0

**StrAct Z** (Strava Auto Activity Generator) is a robust, multi-tenant backend platform that automatically generates hyper-realistic GPS running, walking, and cycling activities and syncs them to Strava.

It intelligently uses:
- **Routing**: OSRM (Open Source Routing Machine) for road-snapping in Hanoi.
- **Visualization**: Chart.js for Activity Insights (Cloud-based). Supports dual-axis (Bar for Distance, Line for Duration).

It simulates human heart rate variability, weather effects, red light stops, and pace fluctuations to make the activities virtually indistinguishable from real workouts.

## ✨ Key Features

- **🏢 Multi-Tenant Architecture:** Supports multiple independent users on a single server instance. Each user has their own secure login, Strava connection, configuration, and scheduled jobs.
- **🗺️ Realistic GPS Tracks:** Uses OSRM to snap routes to actual streets across 12 inner districts of Hanoi. Toggle off for faster straight-line fallback routes.
- **🤖 Advanced Simulations:**
  - **🌤️ Weather Sim:** 30% chance of hot weather, adding +3~8 BPM to heart rate.
  - **🚦 Red Light Stops:** 1.5% chance per GPS point to pause for 15-60 seconds, during which heart rate naturally drops.
  - **🏔️ Elevation & Cadence:** Generates realistic elevation profiles and stride cadences.
- **⏰ Smart Auto-Scheduler:** Configure background cron jobs to auto-generate and upload 1-2 activities daily within specific time windows, strictly avoiding configured work hours.
- **🔒 Secure Architecture:** Built with Express, JWT HttpOnly cookies, bcryptjs, and rate-limiting to prevent unauthorized access. First-time setup is handled via an intuitive UI wizard.
- **👤 Account Management:** Users can update their passwords directly from the dashboard.

## 📚 Documentation

For detailed information, please refer to our documentation guides:

1. [**System Architecture**](docs/ARCHITECTURE.md) - Deep dive into the backend design, database schema, and GPX generation engine.
2. [**Setup & Deployment Guide**](docs/SETUP_GUIDE.md) - Instructions on how to install, configure, and run StrAct Z using `npm` and Node.js.
3. [**User Guide**](docs/USER_GUIDE.md) - How to use the dashboard, configure activities, link Strava, and interpret the generated data.

## 🚀 Quick Start (Development)

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Copy the `.env.sample` to `.env` and configure your Strava API keys:
   ```bash
   cp .env.sample .env
   ```
3. Start the application:
   ```bash
   npm start
   ```
4. Visit `http://localhost:3000`. If this is the first run, you will be redirected to the Setup Wizard to create your Admin account.

## 📋 Changelog

### v1.38.0 (2026-05-09)
- **Map Interaction Control**: Added a "Lock Map" feature to prevent accidental zooming and panning. Map is locked by default for a smoother experience.
- **Customizable Activity Areas**: Introduced a radius slider for Home and Work areas.
  - Constraints: Minimum 2000m (default), Maximum 4000m (2x).
  - Improved UI with real-time radius display in the marker popup.

### v1.37.2 (2026-05-09)
- **UI Consistency**: Updated the tooltip in the activity history list to match the global "hint" style (blue circle with '?').


### v1.37.1 (2026-05-09)
- **Refinement**: Further reduced Home location weights to **+2.0 / +1.2 / +0.5** as requested.
- **Robustness**: Improved the `api` helper and `saveConfig` function with try-catch blocks and better error handling to ensure the "Save" toast always appears.

### v1.37.0 (2026-05-09)
- **UI Optimization**: Moved `Min/Max Pace` settings below `User Age/MHR` for better ergonomic layout.
- **Location Logic**: Reduced weights for Home and Work locations to balance route generation.
  - Home: +2.0 / +1.5 / +1.0
  - Work: +1.2 / +0.8 / +0.4
- **Bug Fix**: Fixed a critical issue where the "Save" button in Activity Settings was non-functional due to a missing heart rate input field in the frontend script.

### v1.36.0 (2026-05-09)
- **Settings Reorganization**: Moved `Min Pace` and `Max Pace` settings to the **Activity Settings** card for better logical grouping.
- **Conditional UI Logic**: Added automatic disabling and dimming of `User Age` and `Max Heart Rate` inputs when `Heart Rate Data` is disabled.

### v1.35.0 (2026-05-09)
- **Tooltip Refinement**:
  - Fixed clipping issues by changing card overflow to visible.
  - Increased tooltip z-index to ensure visibility above all UI elements.
  - Improved text wrapping with fixed width and word-wrap.
  - Added smart alignment (`tooltip-left`/`tooltip-right`) for tooltips near screen edges.

### v1.34.0 (2026-05-09)
- **Theme Refinement**:
  - Restored **Orange** hover shadow for the Normal theme.
  - Normal users can now preview the VIP Gold theme (unsaved).
  - VIP users' theme choices are now persistent across sessions.
  - Fixed hover shadow bugs during theme preview for VIP users.

### v1.33.0 (2026-05-09)
- **Theme Switcher (VIP)**: VIP users can now preview the Normal (Orange) theme and switch back to Gold. Added a "Theme Preview" button in Account Settings.
- **UI Enhancements**: Added neutral gray hover shadows for all cards for non-VIP users to match the premium feel.
- **Security**: Theme switching is gated by server-side role validation to prevent abuse.

### v1.32.0 (2026-05-09)
- **PWA Support**: StrAct Z is now a Progressive Web App! You can install it as an app on Windows (Chrome) and Android for a native-like experience.
- **Manifest & Icons**: Added `manifest.json` and high-quality premium icons with VIP Gold aesthetic.
- **Service Worker**: Integrated a service worker for basic offline asset caching and installability.

### v1.31.6 (2026-05-09)
- **Maintenance**: Minor bug fixes and version alignment.

### v1.31.5 (2026-05-09)
- **VIP GOLD Refinement**: Finalized the mysterious Gold-Black theme. Removed brown tones, enhanced contrast with bright yellow highlights, and added a VIP badge in the header.
- **UI Polish**: Stabilized hover effects (removed lift/scaling for a sleeker feel) and standardized card borders.
- **Bug Fixes**: Resolved local history refresh synchronization and Strava cloud sorting order.

### v1.31.0 (2026-05-09)
- **VIP GOLD Theme**: Added dynamic UI branding for VIP accounts. VIP users now enjoy a premium Gold/Amber theme across the dashboard (similar to premium bank apps).
- **Stat Card Redesign**: Compacted statistic cards with horizontal layout for better space efficiency.
- **Strava Cloud Sync v2**: Restored time-range filtering and implemented a robust sorting mechanism to ensure newest-first activities.
- **Bug Fixes**: Resolved Activity Insights timezone grouping and synchronization issues.

### v1.30.1 (2026-05-09)
- **Merge Refresh**: Combined "Refresh All" (Cloud) into the main "Refresh" dashboard button.
- **Sorting Fix**: Guaranteed newest-to-oldest sorting for Strava Cloud Activities by removing problematic date filters.
- **Timezone Fix**: Fixed Activity Insights chart grouping for early morning activities (Hanoi time).
- **Deletion Policy**: Restricted deletion of activities already uploaded to Strava.
- **Workflow**: Updated `AI_RULES.md` with deployment and Git repository guidelines.

### v1.30.0 (2026-05-09)
- ⚙️ **Centralized Config:** Chuyển toàn bộ các giới hạn validate và đặc quyền VIP vào hệ thống cấu hình tập trung (`src/config/limits.js`).
- 🛠️ **Dynamic UI Limits:** Giao diện tự động cập nhật các ràng buộc (min/max), thông báo lỗi và **Tooltips** dựa trên vai trò của người dùng (Normal/VIP) lấy từ server.
- 🧪 **GPX Engine Refactor:** Bộ máy tạo GPX giờ đây sử dụng các trọng số xác suất và dải nhịp tim động từ file cấu hình, cho phép tùy chỉnh nhanh trên production server.
- 🚀 **Increased VIP Limits:** Nâng giới hạn upload hàng ngày cho VIP lên 10 hoạt động/ngày.

### v1.29.1
- 🐛 **Bug Fixes:** Sửa lỗi ReferenceError trong `app.js` và vấn đề lưu trữ cấu hình.

### v1.29.0
- 📊 **Dual Metric Insights:** Cải tiến biểu đồ **Activity Insights (Cloud)** thành dạng kết hợp (Dual Metrics):
  - **Bar Chart (Orange):** Thống kê tổng quãng đường (km).
  - **Line Chart (Blue):** Thống kê tổng thời gian vận động (min).
  - Hỗ trợ trục Y kép (Y-axis) để quan sát hai thông số có thang đo khác nhau.
- 🕒 **Default Range:** Thiết lập mặc định cho phần Insights là **7 ngày** gần nhất.

### v1.28.0
- 🔄 **Realtime Cloud Sync:** Added "Refresh" buttons to both **Strava Cloud Activities** and **Activity Insights** cards.
  - Những nút này cho phép người dùng bỏ qua bộ nhớ đệm (cache 5 phút) để lấy dữ liệu mới nhất trực tiếp từ Strava.
- 🎨 **UI Improvements:** Thêm biểu tượng 🔄 vào các nút Refresh để dễ nhận diện.

### v1.27.1
- 🐛 **Bug Fixes:**
  - Fixed a critical bug in Strava upload polling where the account ID was missing from the status check request.
  - Fixed configuration persistence issues for "User Age" and district settings.
  - Corrected VIP validation logic to allow 3 districts per route.
  - Enabled **Long Biên** by default in the system's global configuration.

### v1.27.0
- 💎 **Multi-User VIP Codes:** VIP codes can now be used by multiple users with detailed usage logging.
- ✨ **VIP UI Status:** Added "You already VIP account!" message for activated users.
- 🎨 **UI Cleanup:** Removed redundant support email from footer.

### v1.26.1
- 📧 **Support Contact Update:** Updated support email to `stract-z@crfnetwork.com`.
- 🔑 **VIP Seed:** Added default VIP activation code `CRF@2026`.

### v1.25.0
- 🧠 **AI-Assisted Coding Context:** Created `AI_RULES.md` for persistent project context.
- 📝 **Rule Enforcement:** Standardized versioning and UI/UX rules.

### v1.24.0
+- 🧭 **UI Navigation:** Pagination buttons (Prev/Next) now automatically dim and disable when you reach the first or last page of your activity history.
+- ℹ️ **Tooltip Updates:** Refined tooltips for Weather and Red Lights to accurately describe HR behavior (heat stress and pause decay).
+
+
+
+### v1.23.0
+- 🎂 **Age-based MHR:** Added "User Age" field. Max Heart Rate (MHR) is now automatically calculated using the standard formula `220 - Age`.
+- 🔒 **Read-only MHR:** MHR field is now read-only and updates instantly when Age changes.
+- ✅ **Intensity Verification:** Verified HR intensity zones for all activity types (Walk 50-60%, Ride 60-70%, Run 70-85%).
+
+
+### v1.22.0
+- ❤️ **Smart Heart Rate Logic:** Simplified HR settings by removing "Min HR". HR ranges are now automatically calculated based on your **Max Heart Rate (MHR)** and activity type:
+  - **Walk:** 50% - 60% MHR
+  - **Ride:** 60% - 70% MHR
+  - **Run:** 70% - 85% MHR
+- ℹ️ **HR Tooltips:** Added formula `MHR = 220 - Age` and intensity zone info to tooltips.
+- 🛠️ **Bug Fixes:** Unified internal HR calculation logic.
+
+
+### v1.20.0
+- ⚖️ **Activity Type Multipliers:** Introduced automatic distance scaling based on the sport type:
+  - **Walk:** 0.7x target distance.
+  - **Run:** 1.0x target distance.
+  - **Ride:** 1.5x target distance.
+- 🐛 **Logic Fix:** Resolved an issue where activities were generated with excessive distances (30km+) regardless of user settings.
+- 📊 **Activity Insights Prep:** Starting migration of insights to use cloud data instead of local history.
+
+
+### v1.19.0
+- ⚖️ **Refined Weighting Logic:** Transitioned from distance-decay to a precise additive boost system based on circle coverage.
+  - **Base Weight:** 1.0 for all enabled districts.
+  - **Home (Orange) Boosts:** +2.5 (Fully Inside), +2.0 (Mostly Inside), +1.0 (Partially Inside).
+  - **Work (Blue) Boosts:** +1.5 (Fully Inside), +1.0 (Mostly Inside), +0.5 (Partially Inside).
+- 📍 **UI Simplification:** Replaced the "General Area" marker with a focused Home/Work system.
+- ❔ **Map Tooltips:** Added a detailed hint explaining the weighting math to the Map card.
+
+
+### v1.18.0
+- 📍 **Activity Areas Map:** Integrated a Leaflet-based map to visually configure activity zones. Drag and resize circles to define your preferred generation areas.
+- ⚖️ **Weighted District Selection:** The generation engine now uses your configured Map Areas to prioritize nearby districts, making random routes more localized.
+- 📊 **Activity Insights Chart:** Added a dynamic bar chart using Chart.js to visualize your activity distance over the last 14 days.
+- ⚡ **Strava API Caching:** Implemented an in-memory caching layer for Strava activity lists (5-minute TTL) to optimize performance and respect API rate limits.
+
+
+### v1.17.0
+- 👥 **Multi-User Registration:** Opened up registration for all users. The "First-Time Setup" lock has been removed to allow a true multi-tenant experience.
+- 🎖️ **User Roles (VIP vs Normal):** Introduced role-based restrictions. Default users are `normal`, with limits on district span (max 2) and daily scheduled activities (max 2). `vip` users can extend these limits.
+- 🛡️ **Backend Role Enforcement:** Added server-side validation to prevent non-VIP users from exceeding their quota via API.
+- ❔ **UI Tooltips:** Added interactive `(?)` icons next to all configuration fields. Hovering reveals detailed information about field purpose, units, and min/max ranges.
+- 🔄 **Improved Dashboard Refresh:** The refresh button now reloads all statistics, configurations, schedules, and activity lists simultaneously.
+

### v1.16.0
- 🔔 **Unified Toast Notifications:** Fully redesigned toast system with colored borders, slide-in animation, per-type auto-dismiss durations (error stays longer), and manual dismiss button. Applied consistently across all UI actions.
- 📏 **Max Distance default changed to 8km** (from 10km) for more realistic urban route generation.
- ℹ️ **OSRM description note** added below the toggle explaining what it does and its fallback behavior.

### v1.15.0
- 📚 Documentation split into `docs/ARCHITECTURE.md`, `docs/SETUP_GUIDE.md`, `docs/USER_GUIDE.md`.
- 🐛 Fixed delete button silently failing when browser pop-up dialogs were blocked.
- 👤 Added Account Settings card for changing password.
- 🗺️ **Hà Đông** district set as ON by default; auto-migration script for existing configs.
- 🔢 Version badge displayed in UI header.

### v1.14.0
- 🏢 Full multi-tenant architecture: per-user database, config, Strava tokens, and schedulers.
- 🔒 JWT + bcrypt authentication; IP rate-limiting on login (brute-force protection).
- 🧙 First-time Admin registration wizard at `/register.html`.
- 🗺️ Added 4 new districts: Long Biên, Hà Đông, Bắc Từ Liêm, Nam Từ Liêm (3-column layout).
- 🌤️ Weather Simulation & 🚦 Red Light Stops toggles added to UI.
- ⏰ Multi-user Scheduler with independent cron jobs per account.

---
*Disclaimer: This project is intended for educational purposes and testing API integrations. Please adhere to Strava's API terms of service.*
