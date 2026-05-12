# 🏃 StrAct Z

**StrAct Z** (Strava Auto Activity Generator) is a robust, multi-tenant backend platform that automatically generates hyper-realistic GPS running, walking, and cycling activities and syncs them to Strava and Google Fit.

It intelligently uses:
- **Routing**: OSRM (Open Source Routing Machine) for road-snapping in Hanoi.
- **Visualization**: Chart.js for Activity Insights (Cloud-based). Supports dual-axis (Bar for Distance, Line for Duration).
- **Google Fit Sync**: Native integration for pushing sessions, steps, and heart rate data.

## ✨ Key Features

- **🏢 Multi-Tenant Architecture:** Supports multiple independent users on a single server instance.
- **🗺️ Realistic GPS Tracks:** Uses OSRM to snap routes to actual streets across 12 inner districts of Hanoi.
- **🤖 Advanced Simulations:** Weather effects, red light stops, and human-like pace fluctuations.
- **⏰ Smart Auto-Scheduler:** Configure cron jobs to auto-generate and upload activities daily.
- **📉 Google Fit Integration:** Real-time synchronization of activity metrics and steps.

## 📚 Documentation

Detailed documentation is available in the `docs` folder:

1. [**System Architecture**](docs/ARCHITECTURE.md) - Deep dive into the backend design, database schema, and GPX generation engine.
2. [**Setup & Deployment Guide**](docs/SETUP_GUIDE.md) - Instructions on how to install, configure, and run StrAct Z, including Google Fit API setup.
3. [**User Guide**](docs/USER_GUIDE.md) - How to use the dashboard, configure activities, link accounts, and troubleshoot.
4. [**Changelog**](docs/CHANGELOG.md) - Track all version updates and historical changes.

## 🚀 Quick Start (Development)

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Copy the `.env.sample` to `.env` and configure your API keys:
   ```bash
   cp .env.sample .env
   ```
3. Start the application:
   ```bash
   npm start
   ```
4. Visit `http://localhost:3000`. If this is the first run, you will be redirected to the Setup Wizard.

---
*Disclaimer: This project is intended for educational purposes and testing API integrations. Please adhere to Strava and Google Fit API terms of service.*
