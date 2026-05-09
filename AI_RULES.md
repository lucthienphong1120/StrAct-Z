# 🧠 AI Coding Rules & Project Context - StrAct Z

This file serves as a persistent memory and rulebook for AI coding assistants working on the **StrAct Z** platform (v1.30.0). Follow these guidelines strictly.

## 🏗️ Technical Architecture
- **Backend**: Node.js (Express), SQLite (Key-Value & Activity logging).
- **Frontend**: Single-page application (Vanilla HTML/CSS/JS).
- **Maps**: Leaflet.js with OpenStreetMap.
- **Routing**: OSRM (Open Source Routing Machine) for road-snapping.
- **Visualization**: Chart.js for Activity Insights (Cloud-based). Supports dual-metrics: Bar (Distance/km) and Line (Duration/min) with dual Y-axes.
- **Storage**: GPX files stored in `data/gpx/`.
- **VIP System**: Multi-user codes (stored in `vip_codes`). Usage logged per user in `vip_code_usage`. Brute-force protection enabled.
- **Strava Cloud Caching**: Data from Strava is cached for 5 minutes (`CACHE_TTL_MS`). Use `?refresh=true` to bypass/clear cache for specific queries.


## 📏 Core Logic & Weighting

### 1. Heart Rate (HR) Simulation
- **Formula**: `MHR = 220 - Age`.
- **Intensity Zones**: Defined in `src/config/limits.js` per role.
- **Pause Behavior (Red Lights)**: 1.5% chance per GPS point. Pause 15-60s. HR must decay towards `restingHR` (65 bpm) during pauses.
- **Heat Stress**:
  - Hot weather (30% chance): `+3~8 BPM`.
  - Peak Sun (11:00 - 16:00): Additional `+2~5 BPM`.

### 2. Distance Multipliers
Base distance is randomized from config, then scaled by sport (see `limits.js`):
- **Walk**: `0.7x`.
- **Run**: `1.0x`.
- **Ride**: `1.5x`.

### 3. VIP & Security
- **VIP Codes**: Stored in `vip_codes`. Can be multi-user (tracked via `vip_code_usage`).
- **Activation**: If user is already a VIP, the activation UI is hidden/replaced by a status message.
- **Anti-Bruteforce**: Max 5 failed activation attempts per hour per account (enforced via `security_logs`).

### 4. Location Weighting (Hanoi Districts)
- Districts are selected based on proximity to **Home** (Orange) and **Work** (Blue) circles on the map.
- **Weights**:
  - Inside Home circle: `+2.5` (full), `+2.0` (center), `+1.0` (overlap).
  - Inside Work circle: `+1.5` (full), `+1.0` (center), `+0.5` (overlap).

## 🛠️ Developer Rules

### 1. Versioning
- ALWAYS update the version string in the following 3 locations:
  1. `public/index.html` (Header `small` tag).
  2. `package.json` (`version` field).
  3. `README.md` (Header and Changelog).
- Use Semantic Versioning (e.g., `v1.25.0`).

### 2. UI/UX Standards
- **Design**: Premium, dark-themed, glassmorphism.
- **Toasts**: Use `showToast(msg, type)` for all feedback.
- **Tooltips**: All configuration labels should have a `?` icon with a descriptive `data-tooltip`.
- **Navigation**: Prev/Next buttons must be dimmed (`opacity: 0.4`) and `disabled` at boundaries.

### 3. Code Integrity
- Preserve existing comments and architecture.
- Use `api()` wrapper in `app.js` for all fetch calls.
- Keep `route-engine.js` as the source of truth for simulation math.
- All validation ranges and VIP limits must be defined in `src/config/limits.js`.

## 📂 File Map
- `public/js/app.js`: Main frontend controller.
- `src/services/gpx-generator.js`: Activity orchestrator.
- `src/services/route-engine.js`: The "brain" (Math, Physics, OSRM).
- `src/config/limits.js`: System limits, validation ranges, and VIP features.
- `src/routes/api.js`: API endpoints.
- `db/database.js`: Persistence layer.
