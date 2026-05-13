# 🏗️ System Architecture

StrAct Z v1.15.0 utilizes a lightweight, secure, multi-tenant architecture designed to run on a single Node.js instance backed by SQLite.

## Core Components

### 1. Multi-Tenant Database (SQLite)
The data layer is managed via a local `database.sqlite` file, providing low-latency persistence without external database dependencies. 
Key tables:
- `accounts`: Stores system users (`id`, `username`, `password_hash`, `role`).
- `users`: Stores Strava OAuth tokens mapped to an `account_id`.
- `user_config`: Stores individual settings (schedule time, pace, heart rate preferences) via a composite primary key (`account_id`, `key`).
- `activities`: Logs all generated and uploaded activities, linked to an `account_id`.

*Migration:* On startup, the system automatically checks for legacy global databases (`db.json` or pre-1.15.0 SQLite tables) and migrates them to the new multi-tenant structure under `account_id = 1`.

### 2. Authentication & Security
- **JWT & HttpOnly Cookies:** User sessions are managed via JSON Web Tokens stored in secure, `HttpOnly` cookies, preventing XSS attacks.
- **Bcrypt Hashing:** All passwords are hashed using `bcryptjs` with a cost factor of 10.
- **Rate Limiting:** The login endpoint is protected by `express-rate-limit` (max 5 failed attempts per 15 minutes per IP) to prevent brute-force attacks.
- **Strava OAuth Flow:** Strava tokens are tied to the active user's session. The OAuth state parameter ensures the callback correctly identifies the originating system account.

### 3. GPX Engine (`route-engine.js` & `gpx-generator.js`)
The engine generates activities in two phases:
1. **Spatial Generation:** Uses mathematical formulas and the public OSRM (Open Source Routing Machine) API to snap random waypoints to actual roads within defined Hanoi districts. If OSRM fails or is disabled, it falls back to a Manhattan-distance algorithm.
2. **Temporal & Biometric Simulation:** 
   - Generates timestamps based on target pace, injecting natural human micro-fluctuations.
   - **Simulation Events:** Injects random pauses (simulating red lights or traffic) and alters heart rate dynamically based on simulated weather conditions, elevation changes, and exertion over time.

### 4. Background Scheduler (`scheduler.js`)
- Uses `node-cron` to manage background tasks.
- On server boot, it queries all active accounts and spawns independent cron jobs for any user with `schedule_enabled = 'true'`.
- The jobs execute silently in the background, validating Strava limits (max 2 uploads per day) before generating and uploading routes.

### 5. Map State & Activity Area Persistence (v1.51.5+)
- **Map View:** The system persists the map's center coordinates (`map_lat`, `map_lng`) and zoom level (`map_zoom`) whenever "Activity Areas" are saved. This ensures a consistent user experience across sessions.
- **Activity Areas:** Stores user-defined circular zones (Home/Work) as JSON in the `activity_areas` key. 
- **Persistence Rules:**
  - **Refresh:** Restores all saved settings, including map view and activity areas.
  - **Reset:** Resets all general configuration and map view (position/zoom) to defaults, but **preserves** the user's saved Home and Work locations (`activity_areas`).
- **Additive Boost System:** Each activity area provides a mathematical "boost" to nearby districts during route generation, increasing the likelihood of routes starting or ending in preferred locations.
