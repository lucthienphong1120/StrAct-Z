# 🧠 AI Coding Rules & Project Context - StrAct Z

This file serves as a persistent memory and rulebook for AI coding assistants working on the **StrAct Z** platform. Follow these guidelines strictly.

## 🏗️ Technical Architecture
- **Backend**: Node.js (Express), SQLite (Key-Value & Activity logging).
- **Frontend**: Single-page application (Vanilla HTML/CSS/JS).
- **Maps**: Leaflet.js with OpenStreetMap.
- **Routing**: OSRM (Open Source Routing Machine) for road-snapping.
- **Visualization**: Chart.js for Activity Insights (Cloud-based).
- **Storage**: GPX files stored in `data/gpx/`.

## 📏 Core Logic & Weighting

### 1. Heart Rate (HR) Simulation
- **Formula**: `MHR = 220 - Age`.
- **Intensity Zones**:
  - `Walk`: 50% - 60% MHR.
  - `Ride`: 60% - 70% MHR.
  - `Run`: 70% - 85% MHR.
- **Pause Behavior (Red Lights)**: 1.5% chance per GPS point. Pause 15-60s. HR must decay towards `restingHR` (65 bpm) during pauses.
- **Heat Stress**:
  - Hot weather (30% chance): `+3~8 BPM`.
  - Peak Sun (11:00 - 16:00): Additional `+2~5 BPM`.

### 2. Distance Multipliers
Base distance is randomized from config, then scaled by sport:
- **Walk**: `0.7x`.
- **Run**: `1.0x`.
- **Ride**: `1.5x`.

### 3. Location Weighting (Hanoi Districts)
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

## 📂 File Map
- `public/js/app.js`: Main frontend controller.
- `src/services/gpx-generator.js`: Activity orchestrator.
- `src/services/route-engine.js`: The "brain" (Math, Physics, OSRM).
- `src/routes/api.js`: API endpoints.
- `db/database.js`: Persistence layer.
