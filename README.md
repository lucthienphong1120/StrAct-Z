# 🏃 StrAct Z v1.27.1

**StrAct Z** (Strava Auto Activity Generator) is a robust, multi-tenant backend platform that automatically generates hyper-realistic GPS running, walking, and cycling activities and syncs them to Strava.

It intelligently uses **OSRM (Open Source Routing Machine)** to snap routes to real-world roads in Hanoi, simulates human heart rate variability, weather effects, red light stops, and pace fluctuations to make the activities virtually indistinguishable from real workouts.

## ✨ Key Features

- **🏢 Multi-Tenant Architecture:** Supports multiple independent users on a single server instance. Each user has their own secure login, Strava connection, configuration, and scheduled jobs.
- **🗺️ Realistic GPS Tracks:** Uses OSRM to snap routes to actual streets across 12 inner districts of Hanoi. Toggle off for faster straight-line fallback routes.
- **🤖 Advanced Simulations:**
  - **🌤️ Weather Sim:** 30% chance of hot weather, adding +3~8 BPM to heart rate.
  - **🚦 Red Light Stops:** 1.5% chance per GPS point to pause for 15-60 seconds, during which heart rate naturally drops.
  - **🏔️ Elevation & Cadence:** Generates realistic elevation profiles and stride cadences.
- **⏰ Smart Auto-Scheduler:** Configure background cron jobs to auto-generate and upload 1-2 activities daily within specific time windows, strictly avoiding configured work hours.
- **🔒 Secure Architecture:** Built with Express, JWT HttpOnly cookies, bcryptjs, and rate-limiting to prevent unauthorized access. First-time setup is handled via an intuitive UI wizard.
- **👤 Account Management:** Users can update their passwords directly from the dashboard.

## 📚 Documentation

For detailed information, please refer to our documentation guides:

1. [**System Architecture**](docs/ARCHITECTURE.md) - Deep dive into the backend design, database schema, and GPX generation engine.
2. [**Setup & Deployment Guide**](docs/SETUP_GUIDE.md) - Instructions on how to install, configure, and run StrAct Z using `npm` and Node.js.
3. [**User Guide**](docs/USER_GUIDE.md) - How to use the dashboard, configure activities, link Strava, and interpret the generated data.

## 🚀 Quick Start (Development)

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Copy the `.env.sample` to `.env` and configure your Strava API keys:
   ```bash
   cp .env.sample .env
   ```
3. Start the application:
   ```bash
   npm start
   ```
4. Visit `http://localhost:3000`. If this is the first run, you will be redirected to the Setup Wizard to create your Admin account.

## 📋 Changelog

### v1.27.1
- 🐛 **Bug Fixes:**
  - Fixed a critical bug in Strava upload polling where the account ID was missing from the status check request (causing 404/invalid ID errors).
  - Fixed configuration persistence issues for "User Age" and district settings.
  - Corrected VIP validation logic to allow 3 districts per route as intended.
  - Enabled **Long Biên** by default in the system's global configuration.

### v1.27.0
- 💎 **Multi-User VIP Codes:** VIP codes can now be configured for multiple users. 
  - Added `vip_code_usage` table to log exactly which account used which code.
  - Improved UI: Users already having VIP status will see a "You already VIP account!" message instead of the activation input.
- 🎨 **UI Cleanup:** Removed redundant support email from the site footer.

### v1.26.0
- 💎 **VIP Activation System:** Added a secure method to activate VIP status using one-time codes.
  - **Security:** Integrated anti-bruteforce protection (max 5 fails/hour) and security logging.
  - **UI:** New VIP activation section in Account Settings and distinctive VIP badges for users.
- 🦶 **UI Refinements:** Added a site footer and direct support contact information.

### v1.25.0
- 🧠 **AI-Assisted Coding Context:** Created `AI_RULES.md` to store persistent project context, architectural decisions, and logic rules for AI coding assistants.
- 📝 **Rule Enforcement:** Standardized versioning and UI/UX rules for all future developments.

### v1.24.0
+- 🌦️ **Enhanced HR Realism:** 
+  - Heart Rate now realistically drops during "Red Light" pauses towards your resting rate.
+  - Added time-of-day HR influence: Workouts between 11 AM and 4 PM (peak heat) will now show a +2~5 bpm increase to simulate heat stress.
+- 📍 **District Defaults:** "Long Biên" is now enabled by default for all new configurations.
+- 🧭 **UI Navigation:** Pagination buttons (Prev/Next) now automatically dim and disable when you reach the first or last page of your activity history.
+- ℹ️ **Tooltip Updates:** Refined tooltips for Weather and Red Lights to accurately describe HR behavior (heat stress and pause decay).
+
+
+
+### v1.23.0
+- 🎂 **Age-based MHR:** Added "User Age" field. Max Heart Rate (MHR) is now automatically calculated using the standard formula `220 - Age`.
+- 🔒 **Read-only MHR:** MHR field is now read-only and updates instantly when Age changes.
+- ✅ **Intensity Verification:** Verified HR intensity zones for all activity types (Walk 50-60%, Ride 60-70%, Run 70-85%).
+
+
+### v1.22.0
+- ❤️ **Smart Heart Rate Logic:** Simplified HR settings by removing "Min HR". HR ranges are now automatically calculated based on your **Max Heart Rate (MHR)** and activity type:
+  - **Walk:** 50% - 60% MHR
+  - **Ride:** 60% - 70% MHR
+  - **Run:** 70% - 85% MHR
+- ℹ️ **HR Tooltips:** Added formula `MHR = 220 - Age` and intensity zone info to tooltips.
+- 🛠️ **Bug Fixes:** Unified internal HR calculation logic.
+
+
+### v1.20.0
+- ⚖️ **Activity Type Multipliers:** Introduced automatic distance scaling based on the sport type:
+  - **Walk:** 0.7x target distance.
+  - **Run:** 1.0x target distance.
+  - **Ride:** 1.5x target distance.
+- 🐛 **Logic Fix:** Resolved an issue where activities were generated with excessive distances (30km+) regardless of user settings.
+- 📊 **Activity Insights Prep:** Starting migration of insights to use cloud data instead of local history.
+
+
+### v1.19.0
+- ⚖️ **Refined Weighting Logic:** Transitioned from distance-decay to a precise additive boost system based on circle coverage.
+  - **Base Weight:** 1.0 for all enabled districts.
+  - **Home (Orange) Boosts:** +2.5 (Fully Inside), +2.0 (Mostly Inside), +1.0 (Partially Inside).
+  - **Work (Blue) Boosts:** +1.5 (Fully Inside), +1.0 (Mostly Inside), +0.5 (Partially Inside).
+- 📍 **UI Simplification:** Replaced the "General Area" marker with a focused Home/Work system.
+- ❔ **Map Tooltips:** Added a detailed hint explaining the weighting math to the Map card.
+
+
+### v1.18.0
+- 📍 **Activity Areas Map:** Integrated a Leaflet-based map to visually configure activity zones. Drag and resize circles to define your preferred generation areas.
+- ⚖️ **Weighted District Selection:** The generation engine now uses your configured Map Areas to prioritize nearby districts, making random routes more localized.
+- 📊 **Activity Insights Chart:** Added a dynamic bar chart using Chart.js to visualize your activity distance over the last 14 days.
+- ⚡ **Strava API Caching:** Implemented an in-memory caching layer for Strava activity lists (5-minute TTL) to optimize performance and respect API rate limits.
+
+
+### v1.17.0
+- 👥 **Multi-User Registration:** Opened up registration for all users. The "First-Time Setup" lock has been removed to allow a true multi-tenant experience.
+- 🎖️ **User Roles (VIP vs Normal):** Introduced role-based restrictions. Default users are `normal`, with limits on district span (max 2) and daily scheduled activities (max 2). `vip` users can extend these limits.
+- 🛡️ **Backend Role Enforcement:** Added server-side validation to prevent non-VIP users from exceeding their quota via API.
+- ❔ **UI Tooltips:** Added interactive `(?)` icons next to all configuration fields. Hovering reveals detailed information about field purpose, units, and min/max ranges.
+- 🔄 **Improved Dashboard Refresh:** The refresh button now reloads all statistics, configurations, schedules, and activity lists simultaneously.
+

### v1.16.0
- 🔔 **Unified Toast Notifications:** Fully redesigned toast system with colored borders, slide-in animation, per-type auto-dismiss durations (error stays longer), and manual dismiss button. Applied consistently across all UI actions.
- 📏 **Max Distance default changed to 8km** (from 10km) for more realistic urban route generation.
- ℹ️ **OSRM description note** added below the toggle explaining what it does and its fallback behavior.

### v1.15.0
- 📚 Documentation split into `docs/ARCHITECTURE.md`, `docs/SETUP_GUIDE.md`, `docs/USER_GUIDE.md`.
- 🐛 Fixed delete button silently failing when browser pop-up dialogs were blocked.
- 👤 Added Account Settings card for changing password.
- 🗺️ **Hà Đông** district set as ON by default; auto-migration script for existing configs.
- 🔢 Version badge displayed in UI header.

### v1.14.0
- 🏢 Full multi-tenant architecture: per-user database, config, Strava tokens, and schedulers.
- 🔒 JWT + bcrypt authentication; IP rate-limiting on login (brute-force protection).
- 🧙 First-time Admin registration wizard at `/register.html`.
- 🗺️ Added 4 new districts: Long Biên, Hà Đông, Bắc Từ Liêm, Nam Từ Liêm (3-column layout).
- 🌤️ Weather Simulation & 🚦 Red Light Stops toggles added to UI.
- ⏰ Multi-user Scheduler with independent cron jobs per account.

---
*Disclaimer: This project is intended for educational purposes and testing API integrations. Please adhere to Strava's API terms of service.*
