# StrAct Z - Strava Activity Generator

A powerful, automated tool to generate realistic GPS activities (Run, Walk, Hike, etc.) and upload them directly to Strava. 

## Features
- **Realistic Routing:** Uses OSRM to snap generated routes perfectly to real roads and paths.
- **Smart Time & Naming:** Automatically generates realistic past activity times (04:30 - 21:30) while strictly avoiding configured working hours (08:00 - 11:30 and 13:30 - 17:30). A **Custom Time** toggle allows specifying exact target dates and time ranges. The activity name is automatically generated in Vietnamese based on the time of day and activity type (e.g., "Chạy bộ buổi sáng", "Đạp xe buổi tối").
- **Dynamic Activity Types:** Supports generating Random activities (prioritizing Run > Walk > Ride). Heart rate, pace, and distance are intelligently adjusted to match the selected activity type.
- **Multi-District Spanning:** You can choose multiple allowed districts in Hanoi. The generator can build a route spanning across up to 2 districts per activity (contact Admin for 3+).
- **Metrics Simulation & Limits:** Generates dynamic heart rate (Min: 60-120, Max: 120-200), cadence, and realistic elevation (0-8m). Configurable Pace (Min: 6-12 min/km, Max: 10-15 min/km) and Distance (Min: 0.2-4.0 km, Max: 1.0-15.0 km).
- **Limit Protections:** Includes built-in API protection limiting Strava uploads to 2 activities per day.
- **Security:** Built-in Basic Authentication protection, secure headers, and local-only DB keep your data safe.
- **Fully Automated:** Built-in scheduler allows you to run a daily generation task in the background.
- **Local DB:** Uses a simple JSON database, making it extremely portable and easy to deploy.

## Prerequisites
- **Node.js**: Version 18 or higher.
- **Strava API Credentials**: You need a Strava Developer account.
  1. Go to [Strava API Settings](https://www.strava.com/settings/api).
  2. Create a new App.
  3. Note your `Client ID` and `Client Secret`.
  4. Set the Authorization Callback Domain to `localhost` (or your hosting domain).

## Installation

1. Clone or download the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory based on the following template:
   ```env
   PORT=3000
   BASE_URL=http://localhost:3000
   STRAVA_CLIENT_ID=your_client_id_here
   STRAVA_CLIENT_SECRET=your_client_secret_here
   
   # Optional: Secure your web interface and API
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your_secure_password
   ```

## Running Locally

To run the application locally on your machine:

```bash
node server.js
```
Then open `http://localhost:3000` in your browser.

## Running on a NodeJS Hosting Server (VPS / Cloud)

This application is designed to be fully portable. Since it uses `db.json` for storage, you don't need a separate database service like MongoDB or MySQL.

### 1. Update Environment Variables
If you are deploying to a server, make sure to update your `BASE_URL` in the `.env` file to match your live domain or server IP:
```env
PORT=3000
BASE_URL=https://strava.crfnetwork.com
```

### 2. Deploying on iNET 1Panel (CloudLinux Node.js Selector)

If you manage your server via **iNET's 1Panel** (which uses CloudLinux's Node.js environment), the deployment is slightly different.

**Step 1: Upload Source Code**
Zip your project folder. 
**DO NOT INCLUDE:**
- ❌ `node_modules/` (Will be installed via the panel)
- ❌ `.node/` (Local Node.js binaries)
- ❌ `data/` (Exclude this if you want a fresh database)
- ❌ `.git/` (Version control)
- ❌ `start.bat` (Windows specific script, not needed)

Go to **Quản lý tập tin (File Manager)**, create a folder for your app (e.g., inside `applications/nodejs/strava.crfnetwork.com`), upload and extract the `.zip`.

**Step 2: DNS & Domain Setup**
*CRITICAL:* Make sure your domain (e.g., `strava.crfnetwork.com`) has an **A Record** pointing to the Server IP on your DNS manager. If you don't do this, the panel will throw an *"Invalid Data / Please check your A DNS record"* error.

**Step 3: Setup Node.js App**
1. Go to **Bộ chọn PHP / NodeJS (Node.js App Manager)** or **Quản lý Website -> NodeJS**.
2. Click **Cài đặt ứng dụng (Create Application)**.
3. **Node.js Version:** Select **22.x** (e.g., 22.22.0).
4. **Chế độ ứng dụng (Application Mode):** Production (or Development).
5. **Tên miền (Domain):** Choose your mapped domain (`strava.crfnetwork.com`).
6. **Tập tin khởi động (Startup File):** `server.js`
7. Click **Lưu / Cập nhật (Save / Update)**.

**Step 4: Install Dependencies & Config**
1. Click the **NPM Install** button (or Run script -> `npm install`). If it complains about `scripts` in `package.json`, you can simply open the **Terminal `>_`** icon for the app, type `npm install`, and press Enter.
2. Create or edit your `.env` file in the File Manager with your Strava API keys.
   *Note: You do NOT need to configure the PORT. The CloudLinux Passenger system automatically injects its own port/socket via environment variables, and `server.js` will automatically pick it up.*
3. Click the **Khởi động lại (Restart)** icon. The app should now be running!

### 2. Using PM2 (Recommended)
To keep the application running continuously in the background and automatically restart on server reboots, it's highly recommended to use `pm2`.

Install pm2 globally:
```bash
npm install -g pm2
```

Start the application:
```bash
pm2 start server.js --name "strava-auto-gen"
```

Save the pm2 process list so it starts on boot:
```bash
pm2 save
pm2 startup
```

### 3. Securing your App
If deploying publicly, consider putting the application behind an Nginx reverse proxy with SSL (Let's Encrypt). If your corporate network or firewall blocks SSL requests locally, the app already has a `NODE_TLS_REJECT_UNAUTHORIZED='0'` flag built into `strava-api.js` for bypasses, but in production, it is recommended to use valid certificates.

## Operating the App

1. **Connect to Strava:** Click the "Connect with Strava" button on the dashboard to authorize the app. Ensure you check ALL permission boxes (especially upload and delete).
2. **Route Configuration:** Choose the district, target date, distance, and pace.
3. **Generate:** You can either click "Generate & Upload" to test immediately, or turn on the "Auto Schedule" toggle to let the app generate runs automatically in the background at the specified time every day.
