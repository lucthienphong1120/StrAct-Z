# 🧠 AI Coding Rules & Project Context - StrAct Z

This file serves as a persistent memory and rulebook for AI coding assistants working on the **StrAct Z** platform (v1.50.10). Follow these guidelines strictly.

## 🎨 VIP GOLD Theme
- VIP users (detected via `userRole === 'vip'`) are distinguished by a **Gold/Amber** theme (`#f59e0b`).
- Implementation: `document.body.classList.add('is-vip')` is called in `app.js`.
- CSS variables like `--strava-orange` and `--gradient-primary` are overridden inside the `.is-vip` scope in `style.css`.
- Use `var(--gradient-vip)` for VIP-specific badges and highlights.

## 🚀 Workflow & Deployment
- **Repository**: The `StrAct-Z` workspace is a public Git repository.
  - `.gitignore` is used to exclude secrets (`.env`), data (`data/`), and database files.
- **Update Process**:
  - After completing every feature or update, **COMMIT** and **PUSH** to the Git repo. (Lưu ý: Luôn nhớ thực hiện việc này để đồng bộ hóa mã nguồn).
  - Ensure versioning is bumped correctly (see Developer Rules).
- **Production Deployment**:
  - Code is deployed to the production server via `git pull` in the SSH terminal.

## ⚙️ Project Logic & Calculations

### 1. Max Heart Rate (MHR)
- **Formula**: `MHR = 220 - Age`.
- **User Age**: Default is 25 (stored in DB as `user_age`).
- **Generator Integration**: Generator uses this MHR to scale intensity (Pace vs HR correlation).

### 2. Activity Type Multipliers
- **Walking**: Distance x0.7 / Pace x1.25.
- **Running**: Distance x1.0 / Pace x0.8.
- **Cycling (Ride)**: Distance x1.5 / Pace x0.5.
- These weights are applied in `gpx-generator.js` to ensure realistic pace and duration based on the activity type.

### 3. Duplicate Protection (Safe Time)
- **Concept**: Prevents new activities from being generated too close to existing ones (already uploaded or in Strava Cloud).
- **Calculation**: Blocked intervals = `[Start - SafeTime, End + SafeTime]`. Selected random time must fall outside these intervals.
- **SafeTime**: Default 30 minutes (configurable via `overlap_protection_minutes`).

### 4. Map Persistence (v1.43.0+)
- **Storage**: `map_lat`, `map_lng`, and `map_zoom` are saved in the `config` table.
- **UI**: The map restores its last saved center and zoom level upon page load.

## 🛠️ Developer Rules

### v1.50.10 (2026-05-11)
- **UI Cleanup**: Removed the redundant "Logout System" button from the Strava Account card.
- **Visual Consistency**: Standardized the "Disconnect Strava" button style to match the Google Fit disconnect button (outline-danger).
- **Maintenance**: Updated Service Worker cache version.

### v1.50.9 (2026-05-11)
- **Unified Caching & Refresh**: Implemented a backend cache layer for Google Fit stats and unified it with Strava Cloud activities.
- **Consolidated UI**: Removed individual refresh buttons in favor of a single global Refresh button that force-updates all cloud and fit data.
- **Improved Reset Logic**: The Reset button now explicitly clears all backend caches to ensure a completely fresh state.

### v1.50.8 (2026-05-11)
- **Reliable Parent Reload**: Implemented `BroadcastChannel` API for high-reliability cross-window notifications. This ensures the main dashboard reloads even if the popup window reference is lost or isolated.
- **Popup Flow Fix**: Prevented the dashboard from accidentally loading inside the OAuth popup window.

### v1.50.7 (2026-05-11)
- **Auto-Refresh Fix**: Improved Google Fit OAuth flow to explicitly reload the parent window upon completion, ensuring the dashboard updates immediately.
- **Improved Reliability**: Added a fallback redirect mechanism for OAuth callbacks in case of popup block or lost window references.

### v1.50.6 (2026-05-11)
- **Fix Google Fit READ Permissions**: Added `.read` scopes for activities, body, and location to allow fetching step counts.
- **Improved Compatibility**: Simplified the Google Fit aggregation query by removing specific `dataSourceId` requirements.
- **Maintenance**: Updated the Service Worker cache version.

### v1.50.5 (2026-05-11)
- **Fix Service Worker Cache**: Resolved a crash (`Failed to execute 'addAll' on 'Cache'`) caused by a missing `style.css` in the cache list.
- **PWA Enhancements**: Updated the asset list in `sw.js` to include all modern CSS and JS components for better offline support.

### v1.50.4 (2026-05-11)
- **Proper Deauthorization**: Fixed Strava and Google Fit disconnect functions to properly revoke tokens via their respective APIs (Deauthorize/Revoke).
- **Token Refresh on Disconnect**: Ensured Strava token is refreshed before revoking to guarantee API success.

### v1.50.3 (2026-05-11)
- **Detailed Google Fit Stats**: Added today's total step count display and manual refresh button.
- **Improved Auth Flow**: Fixed a bug where the dashboard didn't automatically update after Google Fit connection.
- **Backend Analytics**: Added `/api/google-fit/stats` endpoint to fetch real-time data from Google Fit API.

### v1.50.2 (2026-05-11)
- **Improved Google Fit Callback**: Replaced the blank redirect page with a full HTML status page and fallback "Close" button.
- **Enhanced Auth Debugging**: Added console logging for cross-window messages.

### v1.50.1 (2026-05-11)
- **Fix Disconnect Bug**: Corrected the API call format in `disconnectGoogleFit` that was causing CORS errors.
- **Fix Config Validation**: Added `sync_google_fit` to system limits to prevent it from being stripped during save.

### v1.50.0 (2026-05-10)
- **Google Fit Integration**: Added direct sync support for Google Fit (Sessions, Distance, Speed, Steps, HR).
- **External Tokens Architecture**: Implemented a generalized storage for third-party OAuth2 tokens.
- **Estimated Steps Logic**: Added automatic step count estimation (~1250-1400 steps/km) during generation.

### v1.48.0 (2026-05-10)
- **Generalized Validation System**: Implemented a robust, data-driven validation system that synchronizes frontend and backend with `limits.js`.
- **Real-time Feedback**: Added real-time input validation with visual indicators (red borders) and toast notifications.
- **Backend Security**: Centralized configuration validation in `src/utils/validation.js` to protect against invalid API updates.

### v1.47.6 (2026-05-10)
- **Fix: Auto Schedule Logic**: Resolved an issue where random activity counts (e.g., 1-2 or 0-2) often defaulted to the maximum.
- **Improved Persistence**: Fixed a bug that prevented saving `0` as a valid activity count.
- **Default Refinement**: Standardized fallback values for scheduler min/max activities to match system defaults.

### v1.47.3 (2026-05-10)
- **District Registry Update**: Refined the suburban district list by removing Ứng Hòa, Thạch Thất, Mê Linh, and Sóc Sơn, and adding Huyện Đan Phượng.
- **Geographic Precision**: Added specific centroid and radius for Đan Phượng.

### v1.47.2 (2026-05-10)

### v1.45.1 (2026-05-10)

### v1.44.0 (2026-05-10)
- **Config Overhaul**: Centralized all system and UI limits into `src/config/limits.js`.
- **Dynamic UI**: Constraints and tooltips now update automatically based on user role (Normal vs VIP).

### v1.43.2 (2026-05-10)
- **Fix: Strava Sorting**: Resolved an issue where time filtering caused results to be returned in oldest-first order.
- **Fix: Filter Logic**: Corrected dashboard range filter mapping.

### 1. Versioning
- ALWAYS update the version string in the following 3 locations:
  1. `AI_RULES.md` (top header)
  2. `package.json`
  3. `index.html` (header small tag)
  4. `README.md` (header and changelog)
- Format: `v1.x.y` (e.g., `v1.44.0`).

### 2. Project Structure
- `server.js`: Main entry point.
- `src/db/sqlite-db.js`: Database operations (SQLite).
- `src/services/strava-api.js`: Strava API integration.
- `src/services/gpx-generator.js`: Core logic for GPX generation.
- `public/js/app.js`: Frontend logic.
- `src/config/limits.js`: System constraints and defaults.
