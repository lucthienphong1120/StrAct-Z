# 📖 StrAct Z - End-User Features & Configuration Manual

Welcome to the configuration manual for **StrAct Z**, the automatic daily activity generator and synchronizer for Strava. This document outlines the application settings, account roles, auto-scheduler features, map-based priority routing, and verification guidelines.

---

## 👥 Account Roles & Limits

StrAct Z classifies users into two access tiers: **Basic Account** (Standard) and **VIP Account**. The features and constraints for each role are governed by `src/config/limits.js`.

| Feature / Limit | ⚪ Basic Account | 🟡 VIP Account |
| :--- | :--- | :--- |
| **Theme / Accent Color** | Strava Orange (`#fc4c02`) | Amber / Gold (`#f59e0b`) |
| **Daily Upload Limit (Strava)** | 3 activities | 6 activities |
| **Daily Max Activity (Settings)** | Up to 2 | Up to 5 |
| **Custom Device Names** | Choices from list only | Free-text input (max 100 chars) |
| **Auto-Scheduler Time Slots** | 1 slot (fixed) | Up to 2 slots |
| **Daily Target Distance** | 5km to 15km | 5km to 30km |
| **Map Priority Areas** | 1 Home, 1 Work area | 3 Home, 3 Work areas |
| **Map Circle Radius Range** | 2,000m to 3,000m | 2,000m to 4,000m |
| **Safe Time overlap range** | 15 to 45 minutes | 15 to 90 minutes |

---

## 📍 Map & Priority Areas (Vùng ưu tiên)

Priority areas guide the routing engine to prefer starting coordinates and tracks near your configured locations:
1.  **Map Controls**:
    *   **🔒 Map Locked / Unlocked**: Protects markers from accidental drags. The map must be unlocked to add or reposition markers.
    *   **🏠 Home / 💼 Work Circle Buttons**: Adds an area centered on your current map view (if within your role limits).
2.  **Radius Configuration**: Click on a marker to reveal its popup slider. Drag the slider to adjust the search radius.
3.  **District Selection Algorithm**: The weights of districts overlapping with these areas are dynamically boosted during generator execution, giving you realistic commutes or neighborhood routes.

---

## ⏱️ Time Configuration & Custom Time

### Global Random Time
Defines the window in which activities are allowed to be generated (e.g. `04:30` to `21:30`).

### Avoid Workhours
If enabled, the scheduler will not generate activities during Monday-Friday working periods (`08:00 - 11:30` and `13:30 - 17:30`).

### 📌 Custom Time (Date & Time Override)
When you need to manually schedule a run for a specific past date/time, toggle **Custom Time**:
*   **Manual Generate**: Enforces the selected target date and target time exactly for the next run.
*   **Auto Scheduler**: If Custom Time is enabled, the first generated activity of the day uses the target date and time. Subsequent runs on that same day fall back to standard random times.
*   **Automatic Toggle-Off**: Immediately after a successful run utilizing the custom time, the database resets `custom_time_enabled` to `false` to avoid unintentional duplicates.

---

## ⏰ Auto Scheduler & Daily Target Distance

### Schedule Time Slots
*   **Time Slot 1**: Standard scheduling slot (active for all users).
*   **Time Slot 2 (VIP only)**: Adds a second cron job to generate a second distinct run later in the day.

### 🎯 Daily Target Distance
Designed for marathon training or weekly goal tracking.
*   **How it works**: For the last scheduled run of the day (e.g., Slot 1 if 1 slot is enabled, Slot 2 if 2 are enabled), the scheduler checks if target distance is active.
*   **Deduplication**: Calculates the sum of all distances covered today by querying local DB activities (uploaded status) and Strava Cloud activities (matching timestamps within a 10-minute tolerance).
*   **Remaining Distance Execution**: If the daily total is less than your target, the final run's distance is set to:
    $$\text{Generated Distance} = \text{Target} - \text{Done} \pm \text{Random variance (50m - 200m)}$$
    This calculated override is strictly clamped to your role's maximum distance constraints.

---

## ⚙️ Device Presets Autocomplete

StrAct Z embeds realistic metadata into binary `.fit` files. In the **Device Name** field:
*   Users can choose from verified presets (e.g., `Garmin Forerunner 965`, `Apple Watch Ultra 3`, `Suunto Race S`).
*   **LTS Mapping**: Each brand retrieves its specific LTS software version (such as `19.18` for Garmin) and a unique device serial hashed dynamically.
*   **App Sync Badges**: Short description strings (e.g., `COROS`, `Samsung Health`) are written in the FIT file header, allowing Strava to display corresponding device icon badges on user feeds.
