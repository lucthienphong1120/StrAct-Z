# 🧠 AI Coding Rules & Project Context - StrAct Z
2: 
3: This file serves as a persistent memory and rulebook for AI coding assistants working on the **StrAct Z** platform (v1.43.2). Follow these guidelines strictly.
4: 
5: ## 🎨 VIP GOLD Theme
6: - VIP users (detected via `userRole === 'vip'`) are distinguished by a **Gold/Amber** theme (`#f59e0b`).
7: - Implementation: `document.body.classList.add('is-vip')` is called in `app.js`.
8: - CSS variables like `--strava-orange` and `--gradient-primary` are overridden inside the `.is-vip` scope in `style.css`.
9: - Use `var(--gradient-vip)` for VIP-specific badges and highlights.
10: 
11: ## 🚀 Workflow & Deployment
12: - **Repository**: The `StrAct-Z` workspace is a public Git repository.
13:   - `.gitignore` is used to exclude secrets (`.env`), data (`data/`), and database files.
14: - **Update Process**:
15:   - After completing every feature or update, **COMMIT** and **PUSH** to the Git repo. (Lưu ý: Luôn nhớ thực hiện việc này để đồng bộ hóa mã nguồn).
16:   - Ensure versioning is bumped correctly (see Developer Rules).
17: - **Production Deployment**:
18:   - Code is deployed to the production server via `git pull` in the SSH terminal.
19:   - Production URL: [https://strava.crfnetwork.com/](https://strava.crfnetwork.com/)
20:   - Test UI changes using the production URL in the browser tool if needed.
21: 
22: ## 🏗️ Technical Architecture
23: - **Backend**: Node.js (Express), SQLite (Key-Value & Activity logging).
24: - **Frontend**: Single-page application (Vanilla HTML/CSS/JS).
25: - **Maps**: Leaflet.js with OpenStreetMap.
26: - **Routing**: OSRM (Open Source Routing Machine) for road-snapping.
27: - **Visualization**: Chart.js for Activity Insights (Cloud-based). Supports dual-metrics: Bar (Distance/km) and Line (Duration/min) with dual Y-axes.
28: - **Storage**: GPX files stored in `data/gpx/`.
29: - **VIP System**: Multi-user codes (stored in `vip_codes`). Usage logged per user in `vip_code_usage`. Brute-force protection enabled.
30: - **Strava Cloud Caching**: Data from Strava is cached for 5 minutes (`CACHE_TTL_MS`). Use `?refresh=true` to bypass/clear cache for specific queries.
31: - **Data Assets**:
32:   - `public/geo/hanoi_urban_districts.geojson`: Extracted administrative boundaries for 12 urban districts of Hanoi. Used for visual map highlights. Source: `dvhcvn` GIS data.
33: 
34: 
35: ## 📏 Core Logic & Weighting
36: 
37: ### 1. Heart Rate (HR) Simulation
38: - **Formula**: `MHR = 220 - Age`.
39: - **Intensity Zones**: Defined in `src/config/limits.js` per role.
40: - **Pause Behavior (Red Lights)**: 1.5% chance per GPS point. Pause 15-60s. HR must decay towards `restingHR` (65 bpm) during pauses.
41: - **Heat Stress**:
42:   - Hot weather (30% chance): `+3~8 BPM`.
43:   - Peak Sun (11:00 - 16:00): Additional `+2~5 BPM`.
44: 
45: ### 2. Activity Multipliers
46: Base distance and pace are randomized from config, then scaled by sport (x: multiplier):
47: - **Walk**: `0.7x` distance, `1.25x` pace.
48: - **Run**: `1.0x` distance, `0.8x` pace.
49: - **Ride**: `1.5x` distance, `0.5x` pace.
50: 
51: ### 3. VIP & Security
52: - **VIP Codes**: Stored in `vip_codes`. Can be multi-user (tracked via `vip_code_usage`).
53: - **Activation**: If user is already a VIP, the activation UI is hidden/replaced by a status message.
54: - **Anti-Bruteforce**: Max 5 failed activation attempts per hour per account (enforced via `security_logs`).
55: 
56: ### 4. Location Weighting (Hanoi Districts)
57: - **Visual Highlights**: Actual administrative boundaries are rendered via `public/data/hanoi_urban_districts.geojson`.
58: - **Logic Weights**: Still use circular proximity for backend efficiency (`haversineDistance` check against district centers).
59: - **Weights**:
60:   - Inside Home circle: `+2.0` (full), `+1.2` (center), `+0.5` (overlap).
61:   - Inside Work circle: `1.2` (full), `0.8` (center), `0.4` (overlap).
62: - **Map Persistence**: Center (lat/lng) and Zoom level are saved alongside activity areas to maintain the same view across sessions.
63: 
64: ### 5. Overlap Protection
65: - **Safe Time**: Default `30 minutes`.
66: - **Logic**: Random activity generation must NOT overlap with existing activities (Strava Cloud + Local DB).
67: - **Calculation**: Blocked intervals = `[Start - SafeTime, End + SafeTime]`. Selected random time must fall outside these intervals.
68: 
69: ## 🛠️ Developer Rules

### v1.43.2 (2026-05-10)
- **Fix: Strava Sorting**: Resolved an issue where time filtering caused results to be returned in oldest-first order.
- **Fix: Filter Logic**: Corrected dashboard range filter mapping.
70: 
71: ### 1. Versioning
72: - ALWAYS update the version string in the following 3 locations:
73:   1. `public/index.html` (Header `small` tag).
74:   2. `package.json` (`version` field).
75:   3. `README.md` (Header and Changelog).
76: - Use Semantic Versioning (e.g., `v1.25.0`).
77: 
78: ### 2. UI/UX Standards
79: - **Design**: Premium, dark-themed, glassmorphism.
80: - **Toasts**: Use `showToast(msg, type)` for all feedback.
81: - **Tooltips**: All configuration labels should have a `?` icon with a descriptive `data-tooltip`.
82: - **Navigation**: Prev/Next buttons must be dimmed (`opacity: 0.4`) and `disabled` at boundaries.
83: 
84: ### 3. Code Integrity
85: - Preserve existing comments and architecture.
86: - Use `api()` wrapper in `app.js` for all fetch calls.
87: - Keep `route-engine.js` as the source of truth for simulation math.
88: - All validation ranges and VIP limits must be defined in `src/config/limits.js`.
89: 
90: ## 📂 File Map
91: - `public/js/app.js`: Main frontend controller.
92: - `src/services/gpx-generator.js`: Activity orchestrator.
93: - `src/services/route-engine.js`: The "brain" (Math, Physics, OSRM).
94: - `src/config/limits.js`: System limits, validation ranges, and VIP features.
95: - `src/routes/api.js`: API endpoints.
96: - `db/database.js`: Persistence layer.
