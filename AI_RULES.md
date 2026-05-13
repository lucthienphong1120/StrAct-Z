# 🧠 AI Coding Rules & Project Context - StrAct Z (v1.50.37)

This file serves as a persistent memory and rulebook for AI coding assistants working on the **StrAct Z** platform (v1.50.37). Follow these guidelines strictly.

## 🎨 Theme Standards (v1.50.31+)
- **Fallback (Initial State)**: Default theme (via `:root`) uses a **Grey/Neutral** tone (`#6b7280`). This prevents the "orange flash" for VIP users before their role is identified.
- **Normal User**: Distinguished by the **Strava Orange** theme (`#fc4c02`). Applied via `document.body.classList.add('is-normal')`.
- **VIP User**: Distinguished by the **Gold/Amber** theme (`#f59e0b`). Applied via `document.body.classList.add('is-vip')`.
- **Implementation**: The role-based class is applied in `loadStats()` (dashboard.js) or `initTheme()`.
- **Design System**: Use variables like `--strava-orange`, `--gradient-primary`, and `--body-glow` instead of hardcoded hex/rgba values to ensure theme consistency.

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
