# StrAct Z - Strava Activity Generator

A powerful, automated tool to generate realistic GPS activities (Run, Walk, Hike, etc.) and upload them directly to Strava. 

## Features
- **Realistic Routing:** Uses OSRM to snap generated routes perfectly to real roads and paths. If OSRM is unavailable, it gracefully falls back to a **Manhattan-grid style (L-shape)** routing to maintain realism in city blocks.
- **Smart Time & Naming:** Automatically generates realistic past activity times (04:30 - 21:30) while strictly avoiding configured working hours (08:00 - 11:30 and 13:30 - 17:30). A **Custom Time** toggle allows specifying exact target dates and time ranges. The activity name is automatically generated in Vietnamese based on the time of day and activity type.
- **Dynamic Activity Types:** Supports generating Random activities (60% Run, 30% Walk, 10% Ride). Heart rate, pace, and distance are intelligently adjusted to match the selected activity type.
- **Multi-District Spanning:** You can choose multiple allowed districts in Hanoi. The generator can build a route spanning across up to 2 districts per activity (contact Admin for 3+).
- **Metrics Simulation & Limits:** Generates dynamic heart rate (Min: 60-120, Max: 120-200), cadence, and realistic elevation (0-8m). Includes advanced simulation for **Weather conditions** (hot weather increases HR) and **Red Light Pauses** (heart rate drops during 15-60s stops). Configurable Pace and Distance.
- **Limit Protections:** Includes built-in API protection plus intelligent **Strava API Rate Limit detection** to avoid being blocked.
- **Security & Database:** Uses a robust **SQLite Database** (auto-migrated). All sensitive Strava OAuth tokens are safely secured using **AES-256-CBC Encryption**. Basic Authentication protection and secure headers are also built-in.
- **Fully Automated:** Built-in scheduler allows you to run a daily generation task in the background (1-3 activities per schedule run).

---

## How the Backend Features Work

### 1. Weather Simulation & Red Light Stops
These features are **always active** and require no configuration.

- **Weather Simulation** (`src/services/route-engine.js`, `generateHeartRate`):
  There is a **30% chance** per activity that the weather factor kicks in. When it does, it adds **+3 to +8 BPM** to the heart rate throughout the entire activity, simulating hotter/more humid conditions. This makes the HR data look more varied across different days.

- **Red Light / Traffic Pauses** (`src/services/route-engine.js`, `generateTimestamps`):
  During the middle 80% of the route (skipping the warm-up and cool-down phases), there is a **1.5% chance per GPS point** of triggering a simulated stop. Each stop lasts **15-60 seconds** with multiple low-movement GPS points inserted. During a pause, the heart rate drops significantly (closer to resting HR), mimicking a real-world red light or crosswalk wait. This is visible in the GPX file as clustered timestamps at the same location.

### 2. OSRM Fallback (Manhattan-Style Routing)
- **Primary**: The app calls the public OSRM API (`router.project-osrm.org`) for each pair of route waypoints to get real road geometry (foot profile).
- **Fallback**: If any OSRM segment fails (timeout after 8s, network error, or no route found), that specific segment falls back to **Manhattan-grid interpolation** - an L-shaped path that follows latitude then longitude, with small random GPS jitter (~3m) to simulate real movement along city blocks.
- **Toggle**: The OSRM feature can be toggled on/off via the **"Use OSRM (Snap to roads)"** checkbox in Route Configuration. When disabled, all segments use the fallback.

### 3. Database Security (AES-256-CBC Encryption)
- **What's encrypted**: Strava OAuth `access_token` and `refresh_token` in the `users` table.
- **How**: Uses AES-256-CBC with a key derived from `APP_SECRET` via `scryptSync`. Each encryption generates a random IV for additional security.
- **Config**: Set `APP_SECRET` in your `.env` file. **Do not share or lose this key** - without it, existing tokens cannot be decrypted.
- **File**: `src/utils/encryption.js`

### 4. Multi-User Database Support
- The SQLite schema includes a `users` table with `id`, `access_token`, `refresh_token`, `expires_at`, `athlete_id`, `athlete_name`, `athlete_avatar`, and `created_at` columns.
- Currently optimized for **single-user** operation. The app always reads/writes to user ID 1.
- To support multiple users: refactor `getTokens()`/`saveTokens()` in `sqlite-db.js` to accept a user ID, and add session management in `server.js`.

### 5. Strava API Rate Limit Protection
- **Header Tracking** (`src/services/strava-api.js`): Every Strava API response is inspected for `x-ratelimit-usage` and `x-ratelimit-limit` headers. When usage reaches **95% of the limit** (either 15-minute or daily), a console warning is logged.
- **429 Handling**: If Strava returns HTTP 429, the app immediately rejects with a clear "Rate limit exceeded" error message.
- **Server-Level Rate Limiting** (`server.js`): Express `express-rate-limit` middleware limits each IP to **1000 requests per 15 minutes** globally, and **20 failed auth attempts per 15 minutes** for brute-force protection.

---

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
   
   # Mandatory: Encryption key for your tokens
   APP_SECRET=your_long_random_encryption_key_here
   
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

This application is designed to be fully portable. Since it uses a self-contained SQLite database (`database.sqlite`), you don't need a separate heavy database service like MongoDB or MySQL.

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
- `node_modules/` (Will be installed via the panel)
- `.node/` (Local Node.js binaries)
- `data/` (Exclude this if you want a fresh database)
- `.git/` (Version control)
- `start.bat` (Windows specific script, not needed)

Go to **File Manager**, create a folder for your app, upload and extract the `.zip`.

**Step 2: DNS & Domain Setup**
*CRITICAL:* Make sure your domain has an **A Record** pointing to the Server IP on your DNS manager.

**Step 3: Setup Node.js App**
1. Go to **Node.js App Manager**.
2. Click **Create Application**.
3. **Node.js Version:** Select **22.x**.
4. **Application Mode:** Production.
5. **Domain:** Choose your mapped domain.
6. **Startup File:** `server.js`
7. Click **Save / Update**.

**Step 4: Install Dependencies & Config**
1. Click the **NPM Install** button or run `npm install` in terminal.
2. Create or edit your `.env` file with your Strava API keys.
3. Click the **Restart** icon. The app should now be running!

### 3. Using PM2 (Recommended)
To keep the application running continuously:

```bash
npm install -g pm2
pm2 start server.js --name "strava-auto-gen"
pm2 save
pm2 startup
```

### 4. Securing your App
If deploying publicly, consider putting the application behind an Nginx reverse proxy with SSL (Let's Encrypt).

## Operating the App

1. **Connect to Strava:** Click the "Connect with Strava" button on the dashboard to authorize the app. Ensure you check ALL permission boxes (especially upload and delete).
2. **Route Configuration:** Choose the district, target date, distance, and pace.
3. **Generate:** Use "Generate GPX Only" to create locally, "Generate & Upload" for immediate Strava upload, or "Auto Schedule" for daily automated generation.

---

## Changelog

### v1.13.0
- **Pagination**: Local Generated History now supports pagination (10 per page) with Prev/Next buttons
- **Activity Type Hint**: Dropdown shows probability distribution (60% Run / 30% Walk / 10% Ride)
- **Time Config UI**: Both Random and Custom time panels always visible; inactive panel is dimmed/disabled
- **Consistent Generate Buttons**: "Generate GPX Only" and "Generate & Upload" use the same UI config (1 activity each)
- **Auto Schedule**: Max Count default changed to 2. Schedule uses its own random time + count logic
- **Toast Notifications**: All actions show colored toast notifications (green/red/blue/yellow)
- **Delete Fix**: Delete button works reliably with proper error handling
- **Version Badge**: Version number displayed in header next to logo
- **District Tags**: Activities show district location tags in the history view
- **Actual Start Time**: History displays real activity start time instead of schedule execution time
- **README**: Documented how Weather Simulation, Red Light Stops, OSRM Fallback, Encryption, and Rate Limiting work
