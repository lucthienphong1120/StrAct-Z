# 🏃 StrAct Z

**StrAct Z** (Strava Auto Activity Generator) is a robust, multi-tenant backend platform that automatically generates hyper-realistic GPS running, walking, and cycling activities and syncs them to Strava.

It intelligently uses:
- **Routing**: OSRM (Open Source Routing Machine) for road-snapping in Hanoi.
- **Visualization**: Chart.js for Activity Insights (Cloud-based). Supports dual-axis (Bar for Distance, Line for Duration).

It simulates human heart rate variability, weather effects, red light stops, and pace fluctuations to make the activities virtually indistinguishable from real workouts.

## ✨ Key Features

- **🏢 Multi-Tenant Architecture:** Supports multiple independent users on a single server instance. Each user has their own secure login, Strava connection, configuration, and scheduled jobs.
- **🗺️ Realistic GPS Tracks:** Uses OSRM to snap routes to actual streets across 12 inner districts of Hanoi. Toggle off for faster straight-line fallback routes.
- **🤖 Advanced Simulations:**
  - **🌤️ Weather Simulation:** 30% chance of hot weather, adding +3~8 BPM to heart rate.
  - **🚦 Red Light Stops:** 1.5% chance per GPS point to pause for 15-60 seconds, during which heart rate naturally drops.
  - **🏔️ Elevation & Cadence:** Generates realistic elevation profiles and stride cadences.
- **⏰ Smart Auto-Scheduler:** Configure background cron jobs to auto-generate and upload 1-2 activities daily within specific time windows, strictly avoiding configured work hours.
- **🔒 Secure Architecture:** Built with Express, JWT HttpOnly cookies, bcryptjs, and rate-limiting to prevent unauthorized access. First-time setup is handled via an intuitive UI wizard.
- **👤 Account Management:** Users can update their passwords directly from the dashboard.

## 💡 Configuration & Manual Overrides (Lưu ý về Cấu hình & Tạo thủ công)

StrAct Z hỗ trợ hai cơ chế cấu hình và chạy:

1. **Cấu hình Tự động (Scheduled Runs)**:
   - Các cài đặt trong các thẻ cấu hình (Time Configuration, Route Configuration, v.v.) chỉ được lưu cố định vào Database (cho tiến trình Scheduler chạy ngầm hàng ngày) khi người dùng bấm nút **Lưu cấu hình (Save Configuration)** tương ứng ở mỗi thẻ.
2. **Tạo thủ công & Ghi đè Tạm thời (Manual Overrides)**:
   - Khi bạn thay đổi các thông số trực tiếp trên giao diện UI (ví dụ: kéo thanh khoảng cách, chọn loại hoạt động, bật custom time...) rồi bấm nút **⚡ Generate** hoặc **🚀 Generate & Upload** *mà không bấm Lưu cấu hình*:
     - Client sẽ tự động đọc các giá trị đang hiển thị trên giao diện và gửi lên làm tham số ghi đè tạm thời (Overrides) trong body của request.
     - Server sẽ dùng các giá trị tạm thời này để sinh hoạt động tương ứng một lần duy nhất (One-off) mà không làm ảnh hưởng/lưu đè lên cấu hình lưu trong Database.
     - Nếu bạn F5 (tải lại trang), các giá trị tạm thời này sẽ mất và giao diện sẽ khôi phục lại cấu hình gốc từ Database.

## 🔑 Programmatic API & Access Tokens (v3.3.0)

StrAct Z supports programmatic endpoints under the `/api/public` routing namespace for integration with external automation tools (e.g. Home Assistant, Tasker, custom scheduling scripts).

### Authentication
API requests are authenticated against user-generated access tokens. The API accepts token inputs from strictly two sources:
1. **HTTP Authorization Header (Recommended):** `Authorization: Bearer <your_token>`
2. **URL Query Parameter:** `?token=<your_token>`

*Other input mechanisms (such as custom HTTP headers or request body parameters) are explicitly rejected to reduce parameter pollution vectors.*

### Endpoints
- **`GET /api/public/stats`**: Fetch account metadata, local activity stats, and third-party sync connectivity states.
- **`GET /api/public/activities`**: Retrieve lists of generated activities with support for paginated `limit` & `offset` values.
- **`POST /api/public/activities/generate`**: Triggers a manual generation based on coordinates (`lat`, `lon`/`lng`) and optional `upload` boolean flags.

## 📚 Documentation

For detailed information, please refer to our documentation guides:

1. [**System Architecture**](docs/ARCHITECTURE.md) - Deep dive into the backend design, database schema, and FIT/GPX generation engine.
2. [**Setup & Deployment Guide**](docs/SETUP_GUIDE.md) - Instructions on how to install, configure, and run StrAct Z using `npm` and Node.js.
3. [**Hanoi Running POIs Registry**](docs/HANOI_POIS.md) - Complete list of parks, gardens, lakes, university campuses, and residential areas in Hanoi used for route generation.
4. [**Premium Running Spaces**](docs/RUNNING_SPACES.md) - Evaluation criteria and spatial footprints of premier Hanoi running estates, lakes, and parks.
5. [**Device Integration Test Cases**](docs/DEVICE_TESTCASES.md) - FIT & GPX device mappings, compatibility matrix, and test cases.

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

- **v3.3.0 (2026-06-22)**: API token authentication security hardening and integrated documentation help modal.
- **v3.2.0 (2026-06-22)**: Redesigned token management UI with detailed details popup modal.
- **v3.1.0 (2026-06-22)**: Fine-grained rate limiters for write actions and public routes.
- **v3.0.0 (2026-06-22)**: Introduced secure Programmatic API access with token authentication and lookup/generation endpoints.
- **v2.0.0 (2026-06-10)**: Major update adding support for Garmin FIT binary format alongside GPX.
- **v1.52.0 (2026-06-01)**: Comprehensive security hardening, environment-based encryption salt, and WAL database mode.
- **v1.50.0 (2026-05-10)**: Google Fit integration for direct steps and stats sync.
- **v1.44.0 (2026-05-10)**: Centralized configuration parameters system under `limits.js` and role-based validations.
- **v1.32.0 (2026-05-09)**: PWA support with manifest and service worker caching.
- **v1.31.0 (2026-05-09)**: Premium VIP Gold UI theme switcher and compact stats cards.
- **v1.18.0 (2026-05-09)**: Activity Areas Leaflet Map and weighted district selection engine.
- **v1.14.0 (2026-05-07)**: Initial multi-tenant architecture release with JWT authentication and OSRM routing.

## 📊 Data & Assets

### Hanoi District Boundaries
The project uses high-quality administrative boundary data for Hanoi's 12 urban districts:
- **File**: `public/geo/hanoi_urban_districts.geojson`
- **Source**: [dvhcvn GIS Data](https://github.com/daohoangson/dvhcvn)
- **Usage**: Used in `public/js/app.js` to render bold, accurate red borders for districts on the Activity Areas Map.

## 🔒 Security
- **Theme switching** is gated by server-side role validation to prevent abuse.

---
*Disclaimer: This project is intended for educational purposes and testing API integrations. Please adhere to Strava's API terms of service.*

## 🛠️ Testing & Troubleshooting

### Removing VIP Status (Manual Override)
If you need to downgrade an account to 'Basic' for testing purposes, you can use the following Node.js command in your terminal (replace `YOUR_USERNAME` with the actual username):

```bash
node -e "require('./src/db/sqlite-db').getDb().then(db => db.run(\"UPDATE accounts SET role = 'basic' WHERE username = 'YOUR_USERNAME'\").then(() => { console.log('✅ Account downgraded to Basic'); process.exit(0); }))"
```
*Note: You must log out and log back in (or refresh the page) for the changes to take effect in your session.*

## Google Fit API Integration Guide

To enable Google Fit sync, follow these steps to obtain your credentials:

1.  **Create Google Cloud Project**: Go to [Google Cloud Console](https://console.cloud.google.com/), create a new project.
2.  **Enable Fitness API**: Search for "Fitness API" and click **Enable**.
3. **Configure OAuth Consent Screen**:
 * Go to **APIs & Services > OAuth consent screen**.
 * Create app, choose **External**.
 * Go to **Data access**, Add Scopes:
   - `fitness.activity.read`
   - `fitness.body.read`
   - `fitness.location.read`
   - `fitness.activity.write`
   - `fitness.body.write`
   - `fitness.location.write`
4. **Create Credentials**:
 * Go to **APIs & Services > Credentials**.
 * Click **+ Create Credentials > OAuth client ID**.
 * Application Type: **Web application**.
 * Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`.
 * **Important**: You must submit **Publish** app for verification on **Audience** before the "Connect with Google" button will work for other users. Until verified, only the developer (you) can connect their account at **Test users**.
5. **Update .env**: Copy the Client ID and Secret into your .env file.

`env
GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
`
