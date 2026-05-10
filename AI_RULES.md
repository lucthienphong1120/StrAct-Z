# 🧠 AI Coding Rules & Project Context - StrAct Z

This file serves as a persistent memory and rulebook for AI coding assistants working on the **StrAct Z** platform (v1.44.3). Follow these guidelines strictly.

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
