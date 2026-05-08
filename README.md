# 🏃 StrAct Z v1.16.0

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
