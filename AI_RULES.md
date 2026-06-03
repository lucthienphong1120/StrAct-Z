# 🧠 AI Coding Rules & Project Context - StrAct Z

This file serves as a persistent memory and rulebook for AI coding assistants working on the **StrAct Z** platform. Follow these guidelines strictly.

## 🎨 Theme Standards (v1.50.31+)
- **Fallback (Initial State)**: Default theme (via `:root`) uses a **Grey/Neutral** tone (`#6b7280`). This prevents the "orange flash" for VIP users before their role is identified.
- **Normal User**: Distinguished by the **Strava Orange** theme (`#fc4c02`). Applied via `document.body.classList.add('is-normal')`.
- **VIP User**: Distinguished by the **Gold/Amber** theme (`#f59e0b`). Applied via `document.body.classList.add('is-vip')`.
- **Implementation**: The role-based class is applied in `loadStats()` (dashboard.js) or `initTheme()`.
- **Design System**: Use variables like `--strava-orange`, `--gradient-primary`, and `--body-glow` instead of hardcoded hex/rgba values to ensure theme consistency.
- **Form Layout Consistency**: Settings input fields (such as 'Daily Upload Limit') must occupy the full width of their card wrapper (100% width) for layout harmony. Avoid wrapping single-input groups in `.form-row` grid templates which limits their width to 50% and causes visual mismatch.

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
- **Walking**: Distance x0.55 / Pace x1.4.
- **Running**: Distance x1.0 / Pace x0.8.
- **Cycling (Ride)**: Distance x2.4 / Pace x0.33.
- These weights are applied in `gpx-generator.js` to ensure realistic pace and duration based on the activity type.

### 3. Duplicate Protection (Safe Time)
- **Concept**: Prevents new activities from being generated too close to existing ones (already uploaded or in Strava Cloud).
- **Calculation**: Blocked intervals = `[Start - SafeTime, End + SafeTime]`. Selected random time must fall outside these intervals.
- **SafeTime**: Default 30 minutes (configurable via `overlap_protection_minutes`).

### 4. Map Persistence (v1.51.5+)
- **Storage**: `map_lat`, `map_lng`, and `map_zoom` are saved in the `user_config` table whenever "Activity Areas" are saved.
- **UI Persistence**:
  - **Refresh (Global)**: Restores the last saved map view (position/zoom) and all activity areas.
  - **Reset (Global)**: Resets the map view (position/zoom) to defaults, but **PRESERVES** the saved Home and Work locations (`activity_areas`).
- **Initialization**: The map restores its last saved center and zoom level upon page load via `window.savedMapState`.

### 5. Knowledge Management
- **Read Documentation**: AI assistants MUST read the files in the `docs/` directory (e.g., `ARCHITECTURE.md`, `USER_GUIDE.md`) to understand the system's design and intent before proposing major architectural changes.
- **Preserve Memory**: Always update this `AI_RULES.md` file after significant logic changes.
- **Version Headers**: Do NOT update version numbers in the titles/headers/first section of `AI_RULES.md`, `docs/ARCHITECTURE.md`, or `docs/SETUP_GUIDE.md` unless there is a specific, valid issue. (Lưu ý quan trọng: các file `AI_RULES.md`, `ARCHITECTURE.md`, `SETUP_GUIDE.md` nếu không có vấn đề gì thì không cần tự ý cập nhật version vào phần đầu file).

### 6. Log Preservation (v1.50.40+)
- **Soft-Delete Only**: Never hard-delete records from the `activities` table.
- **Status Change**: 
  - If deleted locally (before upload): `upload_status = 'deleted'`.
  - If deleted from cloud (or detected missing): `upload_status = 'removed'`.
- **Reset Config**: The "Reset to Default" action ONLY resets configuration settings. It MUST NOT clear the activity history.

## 🛠️ Developer Rules

### v1.52.3 (2026-06-03)
- **Feature: Realistic Activity Type Multipliers**:
  - Adjusted distance and pace multipliers for Walking (`Walk`) and Cycling (`Ride`) in generator and configs to match realistic athletic performance ratios.
  - Walk: Distance x0.55 / Pace x1.4.
  - Cycling (Ride): Distance x2.4 / Pace x0.33.

### v1.52.2 (2026-06-03)
- **Feature: Enriched Insights Chart & Hardened Limit Checks & Role-based Scheduler Colors**:
  - Implemented visual split in Activity Insights chart: activities created by StrAct-Z are shown in orange, and other activities from Strava cloud are shown in purple. Added "StrAct Z" and "Strava Cloud" to the chart legend, and updated tooltips to display detailed splits.
  - Simplified insights chart by removing the duration/time line chart and changing the distance line chart color to yellow (gold/amber) to avoid visual clutter.
  - Hardened daily upload limit checks in the scheduler and API routes by bypassing cache (`forceRefresh = true` parameter) to ensure calculations are based on live cloud data.
  - Standardized next auto-run display styling in scheduler card: neutral grey by default/fallback, Strava Orange for normal users and preview normal theme, and VIP Gold for active VIP users.

### v1.52.1 (2026-06-01)
- **Fix: Restored lastUploaded Variable & Cleanup Stale Migrations**:
  - Restored missing `lastUploaded` query definition inside `/api/generate` and `/api/generate-and-upload` API endpoints.
  - Optimized new version update popup responsive styling on mobile (flex-direction column, full-width button).
  - Cleaned up one-time token salt migration and stale `v1.51.43` `district_key` migration blocks from `sqlite-db.js` and `encryption.js`.

### v1.52.0 (2026-06-01)
- **Feature: Comprehensive System Hardening & Performance Fixes**:
  - Fixed undeclared variable `lastActivity` in auto scheduler causing reference errors in strict mode.
  - Removed duplicate `getActivities` export from Strava API helper.
  - Secured Strava OAuth flow by appending the account ID as the state parameter to prevent CSRF.
  - Enhanced API security by removing the global TLS verification bypass.
  - Hardened sqlite-db operations by adding a whitelist validation check to `updateActivity` parameters to block SQL injection.
  - Replaced hardcoded cryptographic salt with a dynamic environment-based salt configuration, featuring automatic on-startup token migration to re-encrypt existing database tokens with the new salt.
  - Configured auth token cookies with the `SameSite=Lax` attribute.
  - Refactored generation parameters across API endpoints and scheduler into a unified utility helper `buildGeneratorConfig`.
  - Added a scheduled GPX file cleanup cron task running weekly on Sunday at 03:00 AM.
  - Enforced a maximum entries capacity limit (500 items) on local in-memory caches to prevent unbounded growth memory leaks.
  - Optimized PWA service worker with a network-first strategy for dynamic HTML/JS/CSS assets and cache-first for fonts/media/CDNs.
  - Removed duplicate require and double ALTER TABLE migration script.
  - Read Google Fit application version dynamically from `package.json`.
  - Implemented graceful shutdown handles for SIGTERM/SIGINT signals to wait for active scheduler jobs.
  - Added `offset` query parameter for query pagination support.
  - Enabled SQLite WAL (Write-Ahead Logging) journal mode for better concurrency performance.
  - Introduced a public `/health` endpoint for uptime monitoring.
  - Restricted CORS origin matching the configured `BASE_URL`.

### v1.51.56 (2026-06-01)
- **Feature: Adjusted District Weighting Coefficients**:
  - Re-calibrated district selection weights based on Strava Year in Sport and Strava Metro user behaviors (targeting ~60% Home, ~25% City, and ~15% Work in a standard 10-district configuration).
  - Updated Home coefficients to +4.5 (Fully), +3.2 (Mostly), and +1.8 (Partially).
  - Updated Work coefficients to +2.5 (Fully), +1.2 (Mostly), and +0.8 (Partially).
  - Adjusted Adjacent Boost to +1.2 (from +0.8) and aligned system configurations.

### v1.51.55 (2026-06-01)
- **Feature: Updated Supported Devices List**:
  - Added a popular Amazfit watch ('Amazfit T-Rex 3') to the configuration choices, mapping its GPX creator/short description metadata to 'Zepp App'.
  - Removed one of the Coros watches ('Coros Vertix 2S') from the choices, keeping 'Coros Pace 3'.
  - Removed Xiaomi watches from the choices entirely.

### v1.51.54 (2026-05-31)
- **Fix: Restructured Daily Limit Violation to Record FAILED Activities Instead of Early Exit**:
  - Restructured `POST /api/generate-and-upload` daily limit check to run after GPX file generation. If the daily upload limit is exceeded, the activity is still saved to the local database with `upload_status: 'failed'` containing the limit details inside `error_message`, and returns a `403` status.
  - Updated auto scheduler (`scheduler.js`) daily limit checks to run inside the loop after activity generation. If the limit is exceeded, it saves the generated activity as `failed` with the limit error message in the local database and continues loop execution, ensuring users have system history logs that the scheduler executed.

### v1.51.53 (2026-05-30)
- **Fix: Daily Limit Errors, Limit Separation for Offline/Online Generation & Cache Sync**:
  - Modified frontend API helper to return full response metadata on failure, allowing the UI to display the exact backend limit message instead of generic "Upload failed".
  - Exempted local GPX generation route (`/api/generate`) from daily upload limits so users can generate local activities without constraint.
  - Enforced daily limits on manual uploads (`/api/upload/:id`) and background scheduler jobs (`scheduler.js`) to prevent bypassing daily quotas.
  - Resolved cache synchronization issue by invalidating all cached queries for a user during a force refresh of Strava activities.

### v1.51.52 (2026-05-30)
- **Fix: Timezone-Aware Activity Overlap Checking & Safety/Rest Math**:
  - Fixed database activity retrieval in `getActivitiesByDate` to query using absolute UTC intervals matching the local Vietnam (+07:00) day, preventing morning activities (00:00 - 06:59 AM local time) from being ignored during overlap checks.
  - Updated Strava activity filters in API routes and scheduler to filter based on `start_date_local` instead of UTC `start_date` to prevent overlap failures.
  - Corrected overlap calculation formulas in `gpx-generator.js` by subtracting the existing activity's rest duration from the starting boundary of the blocked range, and updated `isOverlap` check to correctly verify the start-time forbidden range `[aStart - safeMs - aRestMs, aEnd + safeMs + aRestMs]`.

### v1.51.51 (2026-05-30)
- **Feature: Device Choices, App Sync Source Customization & Manual Badge Fix**:
  - Dynamically mapped GPX creator parameter to respective device brand application (e.g. "Garmin Connect", "Huawei Health", "Samsung Health", "COROS") to restore native sync source icons/labels at the bottom of Strava.
  - Simplified Strava description text box to display only the specific watch device name, avoiding the redundant two-line description.
  - Updated Device Name choices: removed Garmin Enduro 3, updated Apple Watch Series 10 to 11, Samsung Galaxy Watch 7 to 8, Huawei Watch GT 5 Pro to Watch GT 6 Pro, Huawei Watch Fit 3 to Watch Fit 5 Pro, and added Coros Pace 3 and Coros Vertix 2S (with COROS sync source mapping).
  - Fixed missing `created_by: 'Manual'` field in `/generate-and-upload` API route so that manually created activities correctly display the `MANUAL` badge in local history.
  - Adjusted Hanoi district weights: Work place Partially coverage boost to +0.3 (from +0.2), Boost Adjacent to +0.8 (from +0.5), Home Fully to +1.5 (from +1.0), and Work Fully to +1.0 (from +0.8).

### v1.51.50 (2026-05-30)
- **Feature: Output Realism & Upload Metadata Optimization**:
  - Resolved activity categorization bug: Returned resolved `activityType` from generator and passed it to Strava upload to prevent resolved random activities from defaulting to "Workout" (Tập luyện). This automatically restores Pace (Nhịp độ) in min/km and the Pace chart on Strava for Run/Walk activities.
  - Added short activity descriptions mapped to chosen device (e.g. "Garmin Connect", "Huawei Health", "Samsung Health", etc.).
  - Added Garmin TrackPointExtension schema location in GPX XML header to ensure Strava successfully parses heart rate and cadence extensions.
  - Optimised elevation generator to clamp within 2m-20m and smoothed out high-frequency noise to yield a realistic 1m-5m elevation gain on Strava.
  - Fixed responsive layout wrapping of the Avoid Workhours time inputs by implementing a CSS flexbox wrapping container to stack items automatically on narrow settings cards.

### v1.51.49 (2026-05-29)
- **UI & Debug: Responsive Layout Fixes & Console Log Formatting**:
  - Filtered out unselected/disallowed districts (0% probability) and formatted the allowed districts weight ratios debug log as a clean table using `console.table()` to save console space.
  - Resolved responsive layout cramping of the Activity Areas Map card by wrapping header action buttons and stacking the 2-column map info grid into a single column at viewport widths under 1100px.

### v1.51.48 (2026-05-29)
- **Feature: Frontend District Weight Ratios Debug Utility**: Added `debugDistrictWeightRatios()` helper function on the client dashboard. It automatically runs on page load/refresh and prints out a detailed analysis of Hanoi districts, their allowed status, calculated weight values (with Home/Work and Adjacent boost breakdowns), and their final selection percentages to the browser console.

### v1.51.47 (2026-05-29)
- **Debug: District Weight Ratios Logs**: Added console log statements to display calculated weight values and percentage distributions of allowed Hanoi districts prior to performing the weighted selection in GPX generator.

### v1.51.46 (2026-05-28)
- **Fix: Live District Borders (Activity Areas) Map Color Update**: Resolved issue where map borders (District highlights) did not change color when user used "Preview Normal Theme" or "Restore to VIP Theme". Changed `getDistrictStyle` in `map.js` to dynamically determine the VIP status using body classes instead of `window.userRole` (which doesn't change on preview). Restored original static colors for Home (#ff7800) and Work (#3b82f6) circles and legend text.

### v1.51.45 (2026-05-28)
- **Fix: Live Activity Area Circles Color Update**: Updated Leaflet maps' Activity Areas (Home/Work) circle colors to dynamically update style using CSS variables when toggling themes (VIP Gold vs. Normal) or previewing. Also updated the frontend legend text colors in `index.html` to reflect theme variable changes properly.

### v1.51.44 (2026-05-28)
- **Clean: Removed Stale Configurations**: Cleaned up the deprecated `district_key` configuration parameters completely across the frontend configuration panel (`config.js`), the backend endpoint (`api.js`), and the scheduled runner (`scheduler.js`) to prevent any potential storage of unused parameters in `user_config` database table.
- **Fix: Live Map Color Update**: Ensured the Leaflet maps' polygon colors update immediately when switching themes between VIP Gold and Normal without requiring a page refresh.

### v1.51.43 (2026-05-28)
- **Fix: Weighted District Selection Bug**: Fixed root cause of all activities generating in Hoàn Kiếm. The `districtKey` parameter in `gpx-generator.js` had a hardcoded default of `'hoan_kiem'` which bypassed the entire weighted random selection algorithm whenever `district_key` was not set in the user's DB config. Changed default to `null` so the code correctly falls into the weighted probability path. Also fixed the unknown-key fallback to use random from `allowedDistricts` instead of hardcoded `'hoan_kiem'`.
- **UI: Refactor Daily Upload Limit to static HTML**: Moved the Daily Upload Limit input from a dynamically generated JS template string in `auth.js` to a static HTML element in `index.html`. The JS (`renderAccountInfo`) now only injects athlete-specific dynamic data (avatar, name, ID, VIP badge) into `#accountProfile`.

### v1.51.42 (2026-05-28)
- **UI: Expanded Daily Upload Limit Width**: Removed the wrapping `.form-row` from the Daily Upload Limit input field in `renderAccountInfo` within `auth.js`, allowing it to span the full card width (100%) to match other settings input layouts.
- **UI: Form Layout Consistency Rule**: Established a design rule under Theme Standards requiring all standalone settings inputs to occupy the full card width (100%) and avoid single-child `.form-row` containers.

### v1.51.41 (2026-05-28)
- **Database: Thread-safe DB Initialization**: Wrapped `getDb()` initialization inside a cached Promise pattern. If multiple endpoints query the session/database concurrently on startup, it will open the SQLite database, execute table creation, and run migrations exactly once, resolving concurrent SQLITE_BUSY / locked database issues.
- **Middleware: Authorization Header Fallback**: Re-added support for the `Authorization` header fallback in both `authenticateToken` and `requirePageAuth` middleware for full API client compatibility.
- **UI: Robust Dashboard Error Handling**: Updated the dashboard frontend to handle non-array error responses gracefully from `/api/strava-activities` and `/api/insights`, avoiding client-side runtime crashes. Added detailed server-side logs to API catch blocks.

### v1.51.40 (2026-05-28)
- **Security: BAC (Broken Access Control) Prevention**: Updated authentication middleware to query the SQLite database on each request to fetch the fresh, latest user role instead of trusting stale/manipulated JWT cookie payloads.
- **Security: Server-Side Parameter Overrides Validation**: Enforced `validateConfig` on overrides passed via body parameters to manual GPX generation endpoints (`POST /api/generate` and `POST /api/generate-and-upload`). This prevents normal users from using custom HTTP clients to bypass VIP limits.
- **Security: Time Parameters Validation**: Added server-side validation checks for all custom time settings (e.g. format and boundary checks for `min_time`, `max_time`, and work hours) to prevent malformed values from bypassing safety restrictions.
- **Security: GPX Ownership Validation**: Secured the GPX file download endpoint (`GET /api/gpx/:filename`) by validating file ownership in the SQLite activities database, preventing IDOR (Insecure Direct Object Reference) file disclosure.

### v1.51.39 (2026-05-23)
- **Config: Safe Time Range Bounds**: Expanded the allowable range for safe time buffer (`overlap_protection_minutes`) to 15-45 minutes for Normal accounts and 15-90 minutes for VIP accounts (updated in `limits.js`).
- **Logic: Rest Time Pass-Through & Persistence**: Fixed a bug where `rest_time_percent` was not properly persisted and passed down to the GPX generator engine. Updated the `/generate` and `/generate-and-upload` route handlers to pass correct override configurations down to the generator.
- **Maintenance: Client-Side Version Mapping**: Bumped version to v1.51.39 to align frontend version checking with the `/api/version` endpoint.

### v1.51.38 (2026-05-23)
- **Logic: Robust Toggle Override Evaluations**: Fixed boolean toggle overrides (such as `use_osrm`, `sim_weather`, `sim_redlights`, `heart_rate_enabled`, and `boost_adjacent`) in route handlers to robustly check both boolean and string values. Fixed bug where disabled `sim_weather` and `sim_redlights` parameters were ignored and always active during GPX generation by properly passing these options from config to route-engine generator functions.

### v1.51.37 (2026-05-23)
- **Feature: 2025-2026 Sports Watch Devices**: Updated device name configuration choices in both frontend select list and backend database/generator validation options to contemporary 2025-2026 models (such as Garmin Forerunner 975, Garmin Fenix 8 Solar, Garmin Enduro 3, Apple Watch Ultra 3, Apple Watch Series 10, Samsung Galaxy Watch Ultra, Samsung Galaxy Watch 7, Huawei Watch GT 5 Pro, Huawei Watch Fit 3, Xiaomi Watch S4 Sport, Strava Android App). Set `Garmin Forerunner 975` as the new system-wide fallback/default device name.

### v1.51.36 (2026-05-23)
- **UI: Separate Time Configuration Card**: Extracted Safe Time and Time Configuration into its own "Time Configuration" panel. Added an editable Rest Time (%) slider/input (range 0-100), and left-aligned the Custom Time toggle switch. Relocated Daily Limit into the Strava Account panel.
- **Logic: Rest Time Buffer**: Incorporated rest time buffer (percentage of preceding activity duration) into the Safe Time interval spacing check within `gpx-generator.js`.
- **Logic: Heart Rate Prevention**: Ensured heart rate data is fully stripped from GPX points when Heart Rate Data is disabled.

### v1.51.35 (2026-05-23)
- **Feature: Customizable Device Name**: Added configuration choice to set GPX creator device metadata (such as Garmin, Apple Watch, Samsung, Huawei Fit, Xiaomi, Strava Android App).
- **Logic: Target Time Fallback**: Handled `00:00` Target Time by falling back to the user's global random bounds.
- **UI: Tooltip Fixes and Relocations**: Fixed incorrect tooltip displays for heart rate zones, avoid workhours, random bounds, history lists, and relocated map/schedule icons.

### v1.51.34 (2026-05-19)
- **UI: Recolor Chart Series**: Adjusted Activity Insights chart colors:
  - **Activities** (stacked bar): Orange (`rgba(252, 76, 2, 1)`).
  - **Distance** (line): Blue (`rgba(59, 130, 246, 1)`).
  - **Duration** (line): Yellow (`rgba(234, 179, 8, 1)`).

### v1.51.33 (2026-05-19)
- **UI: Insights Color Palette Shift**: Swapped series colors on the Activity Insights chart:
  - **Activities** (stacked bar): Orange (`rgba(252, 76, 2, 1)`).
  - **Distance** (line): Blue (`rgba(59, 130, 246, 1)`).
  - **Duration** (line): Yellow (`rgba(234, 179, 8, 1)`).

### v1.51.32 (2026-05-19)
- **UI: Remove Line Charts Background Fill**: Disabled gradient fill for Distance and Duration line datasets (set `fill: false`) to show clean boundary lines.

### v1.51.31 (2026-05-19)
- **Config: Default Max Schedule Count**: Set default value of `schedule_count_max` to `1` (previously `2`) in both backend db schema configuration (`sqlite-db.js`) and validation rules (`limits.js`).
- **UI: Color Palette Swapping**: Updated Activity Insights chart color scheme:
  - **Activities** is now blue (`rgba(59, 130, 246, 1)`).
  - **Distance** is now green (`rgba(16, 185, 129, 1)`).
  - **Duration** is now orange (`rgba(252, 76, 2, 1)`).

### v1.51.30 (2026-05-19)
- **UI: Stacked Bar Chart for Activities**: Refactored the Activity Insights count dataset into stacked bar sub-datasets so that each activity is represented as a single block segment (1 activity = 1 box).
- **UI: Scaled Down Axes**: Hidden the 3rd y-axis (`y2`) to clean up chart layout. Chart only displays `km` on the left axis and `min` on the right axis. Legend filters out sub-datasets to show a single clean "Activities" item.
- **UI: Tooltip Optimization**: Consolidated tooltip output for stacked sub-datasets into a single hover value displaying `Activities: X`.
- **UI: Reverted Card Subtitles**: Changed Vietnamese source tags on the 4 stats cards back to their original `(Generated & stored in local DB)` English captions.

### v1.51.29 (2026-05-19)
- **Logic: Database Stats Calculation**: Reverted client-side calculations for the 4 dashboard stats cards. Calculated `Total Activities` (all-time, all statuses in DB), `Uploaded` (strictly status is `uploaded`), `Total Distance`, and `Total Duration` (sum of `distance_km` and `duration_min` for `uploaded` and `generated` statuses only) directly in backend SQL database stats query.
- **UI: Label Data Sources**: Sourced descriptions of 4 cards from `Local DB` and Activity Insights from `Strava Cloud` in `index.html`.
- **UI: Insights Chart 3-Series**: Refactored `updateActivityChart` to render 3 series: Activity Count (bar, `y2` axis right offset), Distance (line, `y` axis left), and Duration (line, `y1` axis right).

### v1.51.28 (2026-05-19)
- **Logic: Auto-schedule Quota & Limit Separation**: Removed `daily_upload_limit` checking from automated scheduler. Daily limits now only apply to manual generations. Capped `taskCount` safely against system max but independent of daily counts.
- **Config: Max Schedule Count Limit**: Hardcoded `schedule_count_max.max` to `2` for both Normal and VIP roles, preventing VIP users from spawning 3 events per schedule slot.
- **Feature: Client Version Checker**: Added `/api/version` endpoint to return version from `package.json`. Frontend performs periodic checks. If client version (retrieved from UI small tag) differs from backend, shows a popup modal requesting reload. Click-to-update unregisters service workers, clears cache keys, and performs a hard reload.
- **UI: Grammar & Table Fixes**: Updated weight description table in `index.html` to match actual backend weights (+1.0/+0.8/+0.5 for Home, +0.8/+0.5/+0.2 for Work). Corrected English grammar on VIP card banner ("✨ VIP Account Active!").

### v1.51.27 (2026-05-19)
- **Feature: FAILED Activity Status**: Added a 5th activity status `failed` (alongside uploaded/generated/deleted/removed). Saved to DB with `error_message` when generation is impossible.
- **Logic: NO_VALID_TIME_SLOT Guard**: `gpx-generator.js` now throws a named error (`err.code = 'NO_VALID_TIME_SLOT'`) instead of silently falling back to `Date.now()` when all time slots are blocked by workhours + existing activities.
- **API: 409 Response**: Both `/generate` and `/generate-and-upload` routes catch `NO_VALID_TIME_SLOT`, save a `failed` DB record, and return HTTP 409 with a user-friendly Vietnamese message.
- **Scheduler: Graceful Handling**: Scheduler catches `NO_VALID_TIME_SLOT` per-slot, saves a failed record, then `break`s the retry loop instead of crashing or retrying.
- **UI: FAILED Badge**: New `.status-badge.failed` CSS class (bold red, higher opacity than deleted). Badge shows error_message as tooltip title.
- **UI: Toast Warning**: Frontend shows ⏰ warning toast (not error) when 409 is received from generate actions.

### v1.51.26 (2026-05-17)
- **Cleanup: Remove Google Fit Sync**: Completely removed the "Sync to Google Fit" activity upload feature from UI (`cfgSyncGoogleFit` toggle) and backend (`scheduler.js`, `api.js`). Google Fit now only reads/displays step counts.
- **UI: Tooltip Fallback**: All `data-tooltip` attributes in `index.html` are now set to `"?"` as fallback. Full tooltip content is declared exclusively in JS (`config.js`) to avoid duplication.

### v1.51.25 (2026-05-17)
- **Fix: Mobile Responsive**: Comprehensive mobile layout fixes. `.form-row` stacks to 1-col at ≤768px. Map card buttons wrap via `.map-card-actions`. History controls stack via `.history-card-controls`. District checkboxes: 2-col at 600px, 1-col at 500px. Quick actions: 2×2 grid.

### v1.51.24 (2026-05-17)
- **Logic: Adjacent District Boost**: Auto-adds +0.5 weight to districts adjacent to the most recent uploaded/removed activity's district. Toggle `boost_adjacent` (default: enabled). `ADJACENT_DISTRICTS` mapping in `src/config/districts.js`.
- **Logic: Reduced Home/Work Weights**: Home: Fully+1.0/Mostly+0.8/Partially+0.5. Work: Fully+0.8/Mostly+0.5/Partially+0.2.
- **DB: `getLastUploadedActivity`**: New helper in `sqlite-db.js` to fetch the most recent uploaded or removed activity.

### v1.51.23 (2026-05-17)
- **Logic: Activity Areas Coverage**: Cập nhật thuật toán tính toán mức độ bao phủ giữa khu vực ưu tiên và các quận. Thay vì dùng khoảng cách tâm, thuật toán mới sử dụng công thức tính diện tích giao nhau (Intersection Area) chia cho diện tích của vòng tròn nhỏ hơn.
- **Fairness**: Giải quyết triệt để sự bất cân xứng do diện tích các quận khác nhau, đảm bảo mọi quận đều được xét ưu tiên một cách công bằng (Ratio >= 0.85 cho Fully, >= 0.35 cho Mostly).

### v1.51.22 (2026-05-13)
- **UI: Activity Source Style**: Updated the source badge color to neutral grey (`var(--text-secondary)`) to match the district labels.

### v1.51.21 (2026-05-13)
- **UI: Refined Schedule Labels**: Renamed slots to "Mốc thời gian 1" and "Mốc thời gian 2".
- **UX: Unified Tooltip**: Moved schedule documentation to a single common tooltip in the card header.

### v1.51.17 (2026-05-13)
- **Feature: Dual-Slot Scheduling**: Added support for configuring up to two independent daily schedule times.
- **UI: Dynamic Slots**: Introduced "+ Add Time Slot" and "Remove" buttons to toggle the second schedule slot.
- **Logic: Multi-Cron Support**: Refactored the backend scheduler to manage multiple cron jobs per account simultaneously.

### v1.51.16 (2026-05-13)
- **Fix: CSS Compatibility**: Added standard `background-clip` properties to resolve warnings in `components.css` and `theme.css`.

### v1.51.15 (2026-05-13)
- **UX: Mobile Responsiveness**: Implemented a comprehensive responsive design. Grids now stack vertically on small screens, the header supports wrapping, and activity list items are optimized for narrow displays.
- **UI: Utility Classes**: Introduced `.grid-responsive` to standardize layout behavior across devices.

### v1.51.14 (2026-05-13)
- **Fix: Layout Corruption**: Resolved an issue in `index.html` where Avoid Workhours inputs were duplicated and corrupted.
- **Fix: JS Null Pointer**: Fixed a crash in `loadConfig` caused by attempts to set values on non-existent UI elements (`cfgCustomMaxTime`).
- **Logic: Safe UI Updates**: Introduced `setVal` and `setChecked` helpers in `config.js` to prevent future null pointer errors when UI elements are missing.

### v1.51.12 (2026-05-13)
- **Standard: 24h Time Format**: Standardized all time inputs and displays to use the 24-hour format (`HH:mm`).
- **UI: 24h Enforcement**: Added `lang="en-GB"` to time inputs to encourage 24h rendering in browsers and updated all tooltips/labels to emphasize the 24:00 format.

### v1.51.11 (2026-05-13)
- **Map UI Restoration**: Restored the "count/max" format and specific colors (red/green/orange/blue) for the Activity Areas info display.
- **State Persistence Fix**: Ensured map position, zoom, and lock state are correctly loaded from the database on page refresh.
- **Save Logic Update**: The `Save` button now persists the latest map view and auto-locks the map as intended.

### v1.51.10 (2026-05-13)
- **UI: Full-width Workhours**: Reorganized the Avoid Workhours layout to occupy the full row width, with each time range taking up exactly 50%.
- **Logic: 24h Time Format**: Standardized time formatting across the entire application to use 24-hour notation (hour12: false), ensuring consistency in both UI and server logs.

### v1.51.9 (2026-05-13)
- **UI: Refined Time Config**: Streamlined the Time Configuration interface by making Random Time Bounds standard-sized, removing redundant borders from Avoid Workhours, and simplifying Target Time to a single input for precise scheduling.
- **Logic: Fixed-Time Scheduling**: Enhanced GPX generation to support exact-time scheduling (Custom Time mode) while maintaining safety checks against work hours and overlapping activities.

### v1.51.8 (2026-05-13)
- **UI: Time Configuration Overhaul**: Separated "Random Time Bounds" into a global setting that remains visible regardless of the "Custom Time" toggle.
- **UI: Target Time Validation**: Renamed "Time Range" to "Target Time" for GPX generation and added validation to ensure it stays within the global "Random Time Bounds".
- **Logic: Weekday-Only Workhours**: Updated "Avoid Workhours" logic to only apply on weekdays (Mon-Fri). Weekend activities are no longer restricted by work hour settings.

### v1.51.7 (2026-05-13)
- **UX: Auto-Lock Map**: Implemented automatic map locking when saving "Activity Areas". This secures the map view immediately after configuration and persists the locked state to the database.

### v1.51.6 (2026-05-13)
- **Fix: Config Validation**: Resolved a bug in `getLimits` that caused fields without explicit `max` limits (like `map_lat`) to default to a maximum of `0`, leading to "400 Bad Request" errors during save.

### v1.51.5 (2026-05-13)
- **Feature: Map View Persistence**: Enabled saving of map position (lat/lng) and zoom level when saving Activity Areas.
- **Logic: Persistence Rules**: Refined the behavior of "Refresh" (restores saved view) vs "Reset" (resets view to default but keeps markers).
- **Documentation**: Updated `ARCHITECTURE.md` and added a "Read Documentation" rule to `AI_RULES.md`.

### v1.51.4 (2026-05-13)
- **UI: Logic Refinement**: Hidden the "View" button for activities in the `REMOVED` state. The button is now only visible for `UPLOADED` activities that exist on Strava Cloud.

### v1.51.3 (2026-05-13)
- **Fix: Config Persistence**: Resolved a critical issue where Route Configuration (Allowed Districts) changes were not saved because of a key mismatch (`selected_districts` vs `allowed_districts`) between the frontend and backend validation logic.
- **Consistency**: Standardized the district selection key to `selected_districts` across `limits.js`, `validation.js`, and the frontend.

### v1.51.2 (2026-05-13)
- **Activity Area Limits**: Refined limits for preferred activity areas on map.
  - **Home Point**: Max 1 for all accounts (VIP and Normal).
  - **Work Point**: Max 2 for VIP, Max 1 for Normal.
- **Dynamic Radius**: Circle radius slider in UI now dynamically respects the `scale_radius` limits (3000m for Normal, 4000m for VIP).

### v1.51 (2026-05-13)
- **Major Logic Refinement**: Completed the overhaul of data synchronization and log preservation logic.
- **Sync**: Improved cross-check accuracy using a 200-item cloud activity buffer.
- **Privacy & Logs**: Transitioned to mandatory soft-delete for all activity records to maintain permanent history.
- **Reliability**: Fixed `Reset` function crash by implementing missing backend methods.

### v1.50.40 (2026-05-13)
- **Feature: Log Preservation**: Removed `clearActivities` from the configuration reset flow. History is now preserved during reset.
- **Logic: Soft-Delete**: Updated `deleteActivity` and API routes to ensure activities are only soft-deleted (status changed to `deleted` or `removed`) to maintain a persistent log.
- **UI UX**: Reverted Reset confirmation message to exclude history clearing.

### v1.50.39 (2026-05-13)
- **Fix: Data Asynchrony**: Improved the cross-check logic for "Local Generated History" status mapping. It now uses a 200-item buffer from Insights data instead of paged Cloud Activities (10 items), preventing false "REMOVED" status for older activities.
- **Fix: Reset Function**: Implemented missing `clearActivities` backend method in `sqlite-db.js` to prevent crashes when resetting configuration.
- **UI UX**: Updated Reset confirmation message to be more explicit about clearing local history.
- **Cache Management**: Unified cloud activity reset logic in `loadDashboard`.

### v1.50.38 (2026-05-13)
- **Bug Fix**: Fixed a validation error where `activity_type` could not be saved because its limit defaulted to 0.
- **Limit Synchronization**: Added `min: 1` and `max: 1` to `activity_type` in `limits.js` to ensure proper validation for single-choice selections.
- **VIP Perk Update**: Increased the `home_count` limit for VIP users to 2, matching the previously updated `work_count` limit.

### v1.50.37 (2026-05-13)
- **Bug Fix**: Resolved `ReferenceError: center is not defined` in `addActivityCircle` function (map.js).
- **Dynamic Limits**: Replaced hardcoded activity area limits with dynamic values from `sysLimits` (allowing up to 2 areas for VIP).
- **Localization**: Updated map interaction toasts to Vietnamese for consistency with the rest of the UI.

### v1.50.36 (2026-05-13)
- **Google Fit Sync Optimization**: Refactored the Google Fit integration to use more reliable data aggregation and simplified the dataset patching logic.
- **Role Management Guide**: Finalized the documentation for manual VIP role downgrades.
- **UI & Logic Cleanup**: Removed legacy Google Fit clear-queue endpoints and consolidated frontend dashboard logic.

### v1.50.35 (2026-05-12)
- **Manual Role Management**: Added documentation to `README.md` for manual account role downgrades (VIP to Normal) via Node.js CLI.
- **Testing Standard**: Established a pattern for manual database overrides during the testing phase.

### v1.50.34 (2026-05-12)
- **VIP Logo Fix**: Corrected issue where the VIP logo text appeared solid orange and the icon box was empty.
- **Text Clipping Isolation**: Moved `background-clip: text` from the `.logo` container to the inner `span` for VIP users to prevent it from clipping the icon box and making inner text transparent.
- **Variable Sync**: Updated `--gradient-premium` for VIP users to ensure the gold icon box matches the theme.

### v1.50.33 (2026-05-12)
- **Normal Theme Refinement**: Removed text gradients from `.logo` (title) and `.stat-value` (stats) in Normal/Fallback themes, using solid colors instead for better readability.
- **Button Gradient Restoration**: Restored the original bright orange/grey gradients for buttons (`--gradient-primary`) to maintain UI consistency.
- **Icon Premium Logic**: Introduced `--gradient-premium` specifically for icon boxes to keep the dark-start "VIP-like" aesthetic without affecting text clarity.

### v1.50.32 (2026-05-12)
- **Darker Grey Fallback**: Darkened the fallback grey variables (`#4b5563`) for a more "Stealth" and premium feel.
- **Premium Gradients Overhaul**: Updated `--gradient-primary` for both Fallback and Normal themes to use multi-stop gradients (starting from deep dark) mimicking the VIP aesthetic.
- **UI Depth**: Enhanced `--shadow-glow` and `--body-glow` intensity for better visual depth in non-VIP themes.

### v1.50.31 (2026-05-12)
- **Theme Fallback Overhaul**: Changed default CSS variables to grey/neutral to prevent orange flash for VIP users.
- **Role-Based Classes**: Implemented `.is-normal` class for the Strava Orange theme and updated logic to toggle between `.is-normal` and `.is-vip`.
- **Variable Synchronization**: Replaced hardcoded orange hex/rgba values in `layout.css` and `components.css` with CSS variables (`--strava-orange`, `--strava-orange-glow`, etc.).
- **Improved Initial Load**: Neutral fallback ensures a premium feel during the brief authentication/stats fetching phase.

### v1.50.30 (2026-05-11)
- **Capitalization Fixes**: Standardized all tooltips and UI labels to Sentence Case.
- **Inheritance Fix**: Added `text-transform: none` to `.tooltip-icon` to prevent tooltips from inheriting uppercase styling from parent containers.
- **Localized Labels**: Updated Map Info grid labels to Vietnamese sentence case ('Khóa bản đồ', 'Điểm Nhà', etc.).
- **Consistent Roles**: Standardized role names to capitalized 'Normal' and 'VIP' in tooltips.

### v1.50.29 (2026-05-11)
- **Map Info Structure**: Separated map stats into a 2-row grid for better readability.
- **Section Headers & Hints**: Added dedicated titles ('Hoạt động ưu tiên', 'Trọng số tác dụng') and hint icons for all 4 map configuration items.
- **Metadata Documentation**: Unified hints for Map Locked, Home/Work points, and Scale Radius via the dynamic configuration system.
- **UI Polish**: Improved spacing and alignment for the Activity Areas card body.

### v1.50.28 (2026-05-11)
- **Map Hint Refinement**: Updated Activity Areas tooltip to explain the 1:1 base ratio and additive boost system.
- **UI Optimization**: Removed redundant limit lists from the Map tooltip as they are now prominently displayed in the stats grid and boost table.
- **Educational Context**: Improved examples in hints to clearly demonstrate the mathematical priority calculation for districts.

### v1.50.27 (2026-05-11)
- **Map Activity UI Overhaul**: Added a dedicated stats grid and boost table to the Activity Areas card.
- **Enhanced Status Monitoring**: Real-time display for Map Lock status, marker counts (Home/Work), and current radius limits.
- **Boost Logic Documentation**: Integrated a visual table explaining the additive boost system (+2.0/1.5/1.0 for Home, +1.2/0.8/0.4 for Work) based on coverage.
- **Logic Sync**: Ensured UI values reflect the underlying additive boost system for better user transparency.

### v1.50.26 (2026-05-11)
- **Map Activity Documentation**: Enhanced Activity Areas Map hint with weight and limit details (Home/Work points, Radius).
- **Dynamic Tooltips**: Integrated Activity Areas metadata into the unified dynamic tooltip system in `config.js`.
- **Role-Based Scaling**: Updated limits for map markers (Normal: 1, VIP: 2) and radius (Normal: 3km, VIP: 4km) to reflect premium features.

### v1.50.25 (2026-05-11)
- **UI Documentation**: Added informational tooltips to History and Cloud Activities headers to explain status mapping and activity types.
- **Enhanced Transparency**: Clear definitions for UPLOADED, GENERATED, DELETED, and REMOVED states now visible via UI hints.

### v1.50.24 (2026-05-11)
- **Status Logic Optimization**: Simplified history status to a single badge system (Uploaded, Generated, Deleted, Removed).
- **Cross-Check Optimization**: Status mapping now leverages cached Strava data, reducing redundant API calls.
- **Backend Persistence**: Modified `getActivities` to include soft-deleted activities in fetch results, ensuring full history logging as requested.
- **Improved UI/UX**: Tooltips now provide clear explanations for each of the 4 unified states.

### v1.50.23 (2026-05-11)
- **Local History Overhaul**: Added time filter (Last 3/5/7/14/30/90 days) to Local Generated History.
- **Two-Status Event Logic**: Implemented "Tình trạng" (Generated/Deleted) and "Đồng bộ" (Uploaded/Not Uploaded) badges for each local activity.
- **Strava Cross-Mapping**: Local activities now cross-check against Strava Cloud data to identify activities deleted from Strava while maintaining local logs.
- **Enhanced Status UI**: Redesigned status badges with semantic colors (Yellow for Active, Red for Deleted, Green for Uploaded, Blue for Local Only).

### v1.50.22 (2026-05-11)
- **Range Logic Fix**: Optimized `buildRangeString` to display single values instead of ranges (e.g., "2" instead of "2-2") when min and max are equal for a specific user role.
- **Improved Information Density**: Tooltips now accurately reflect fixed limits versus variable ranges, reducing user confusion.

### v1.50.21 (2026-05-11)
- **UI UX Polish**: Moved Daily Upload Limit tooltip to the right for better visibility on small screens.
- **Improved Metadata**: Updated `daily_upload_limit` with detailed "Tác dụng" description and localized label.
- **Heart Rate Education**: Enhanced HR Zone examples with more descriptive, person-centric scenarios.

### v1.50.20 (2026-05-11)
- **Syntax Fix**: Restored missing `user_age` key in `limits.js` that caused "Type annotations" errors in JavaScript.
- **UI Finalization**: All tooltips are now fully dynamic and follow the improved map-based hint format.

### v1.50.19 (2026-05-11)
- **Centralized Tooltip Architecture**: Successfully migrated all UI tooltips to a dynamic system powered by `limits.js`.
- **Special Format for Map Multipliers**: Implemented a cleaner format for Multiplier and HR Zone tables (Label/Tác dụng/Ví dụ) without technical jargon.
- **Improved Semantic Labels**: Updated labels for User Age and Heart Rate Data to include English and Vietnamese descriptions.

### v1.50.18 (2026-05-11)
- **Metadata Synchronization**: Updated simulation and activity metadata in `limits.js` to ensure tooltips correctly reflect detailed effects on metrics (HR, Pace, Time).
- **Tooltips Polish**: Fixed a bug where manual UI tooltips were overwritten by the dynamic configuration loader.

### v1.50.17 (2026-05-11)
- **Advanced UI Polish**: Finalized Activity Settings layout with Min/Max Distance on the same row and Activity Type full-width.
- **Detailed Simulation Hints**: Updated tooltips for Weather Sim and Red Lights to explain specific effects on Heart Rate, Elapsed Time, and Pace.
- **Improved Transparency**: Added titles and hints for all reference tables (Distance/Pace Multipliers, HR Zones) to explain their functional impact.

### v1.50.16 (2026-05-11)
- **Advanced UI Layout**: Reorganized Activity Settings with dedicated multiplier tables for Distance and Pace, mimicking the HR Zones format.
- **Improved Hierarchy**: Grouped Min/Max inputs into single rows for better vertical density.
- **Consistency Fix**: Reverted labels to uppercase (WALK, RUN, RIDE) for better visibility across all reference tables.

### v1.50.15 (2026-05-11)
- **UI Refinement**: Reorganized Activity Settings by moving Distance inputs near Activity Type and adding a readonly multipliers reference.
- **Visual Polish**: Standardized Heart Rate Zones with lowercase labels and cleaner typography (non-bold).
- **Metadata Update**: Fixed tooltips for Heart Rate Zones and Activity Type to show correct default values.

### v1.50.14 (2026-05-11)
- **Fix Safe Time Logic**: Improved activity overlap prevention by accounting for the estimated duration of new activities during time randomization.
- **Scheduler Update**: Fixed a bug where auto-generated activities in the same job could overlap because they weren't aware of each other's schedules.
- **Improved Validation**: Standardized time selection to avoid working hours and existing activities more robustly.

### v1.50.13 (2026-05-11)
- **AI Rule Update**: Updated versioning rules to exclude `README.md`'s first line from automatic version bumps.
- **Documentation Policy**: Standardized `README.md` as a feature/setup guide rather than a strict version tracker.

### v1.50.12 (2026-05-11)
- **Google Fit UI Polish**: Integrated the official Google Fit logo and refined the status display text for a more premium look.
- **Visual Branding**: Updated both connection and connected states to use consistent Google Fit branding.
- **Maintenance**: Updated Service Worker cache version.

### v1.50.11 (2026-05-11)
- **Fix Scheduler Bug**: Resolved an issue where "Min Count" would reset from 0 to 1 after a page reload due to incorrect falsy value handling in the UI.
- **Improved Logic**: Updated scheduler initialization to properly handle numeric 0 values.

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
- **CRITICAL**: Do NOT update the version number at the first line of `README.md`.
- **README.md Usage**: This file is primarily for feature descriptions, setup instructions, and user guides. Only add to its `Changelog` for major feature changes.
- Format: `v1.x.y` (e.g., `v1.44.0`).

### 2. Project Structure
- `server.js`: Main entry point.
- `src/db/sqlite-db.js`: Database operations (SQLite).
- `src/services/strava-api.js`: Strava API integration.
- `src/services/gpx-generator.js`: Core logic for GPX generation.
- `public/js/app.js`: Frontend logic.
- `src/config/limits.js`: System constraints and defaults.
