# Allowed Devices Reference - StrAct Z

This document describes the list of supported devices, application connection sources, and how Strava extracts device information from activity files.

## 🛠️ How Strava Parses Device Information
Strava does **not** allow setting or updating the activity device name directly via its REST API parameters (`createActivity` or `updateActivityById`).
Instead, Strava parses device details strictly from the **creator metadata attribute** of the uploaded activity file (GPX, FIT, or TCX):
```xml
<gpx version="1.1" creator="Garmin fēnix 7x Pro" ...>
```
For the device to show a specific device badge or device name on the Strava activity, the `creator` string must match one of Strava's internally whitelisted device models. Non-matching or invalid names will result in blank slots.

---

## 📋 Device Lists & Verification Status

### ✅ Verified / OK Devices (Displayed with `★` in the UI)
These devices have been tested and verified to successfully display their device names/badges on Strava:
*   **Garmin Forerunner 945**
*   **Garmin fēnix 7x Pro**
*   **Garmin fēnix 8**
*   **Garmin Forerunner 255S**
*   **Garmin Venu 2**
*   **Amazfit T-Rex 3**

### ✅ Verified App Connection Sources (Displayed with `★` in the UI)
These connection app names successfully display their brand source badges on Strava:
*   **Garmin Connect**
*   **Zepp App**
*   **Huawei Health**
*   **Samsung Health**
*   **Apple Sport**
*   **COROS**
*   **Suunto**

### ⏳ Untested Devices (Keep for future testing)
These devices are valid preset suggestions but have not been tested yet:
*   **Garmin Forerunner 165**
*   **Garmin Instinct 3**
*   **Garmin Instinct 2X Solar**
*   **Garmin Epix Pro (Gen 2)**
*   **Garmin epix Pro (Gen 2) 47mm**
*   **Coros Pace 3**
*   **Coros Apex 2 Pro**
*   **Coros Vertix 2S**
*   **Suunto Race S**
*   **Suunto Vertical**
*   **Amazfit Balance 2**
*   **Amazfit Active 3 Premium**
*   **Huawei Watch GT 6 Pro**
*   **Huawei Watch Fit 5 Pro**
*   **Huawei Watch GT 4 Pro**
*   **Huawei Watch Fit 3**
*   **Huawei Watch Ultimate**
*   **Samsung Galaxy Watch Ultra**
*   **Samsung Galaxy Watch 8**
*   **Samsung Galaxy Watch 7**

### ❌ Failed Devices (Removed from system)
These models either resulted in blank slots or did not trigger the device badge on Strava:
*   **Garmin Forerunner 975**
*   **Garmin Forerunner 965**
*   **Garmin Forerunner 265**
*   **Garmin fēnix 8 Solar**
*   **Apple Watch Ultra 3**
*   **Apple Watch Ultra 2**
*   **Apple Watch Series 11**
*   **Apple Watch Series 10**
*   **Strava Android App**
*   **Strava iPhone App**
*   **Strava App**
