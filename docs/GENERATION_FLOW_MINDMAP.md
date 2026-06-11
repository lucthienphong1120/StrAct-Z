# 🗺️ StrAct Z - Activity Generation Flow Mindmap

This document describes the step-by-step logic, routing algorithms, weighting rules, and device serialization flows inside the StrAct Z engine.

---

## 📊 High-Level Flowchart

Below is the execution flow from the trigger (Manual API call or Cron Scheduler) to the output of a signed Garmin `.fit` activity file.

```mermaid
graph TD
    %% Trigger Phase
    Start([⚡ Trigger Activity Generation]) --> InputCheck{Manual or Scheduler?}
    
    %% Setup & Custom Time Phase
    InputCheck -->|Manual| BuildManualConfig[Read UI parameters / Overrides]
    InputCheck -->|Scheduler| BuildSchedulerConfig[Fetch DB User Settings & Check Slots]
    
    BuildManualConfig --> TimingCheck{Custom Time Active?}
    BuildSchedulerConfig --> TimingCheck
    
    TimingCheck -->|Yes| SetCustomTime[Use Custom Date & Time<br/>Bypass random bounds]
    TimingCheck -->|No| SetRandomTime[Select random time within bounds<br/>Check Avoid Workhours]
    
    %% Target Distance Phase
    SetCustomTime --> TargetDistCheck{Scheduler & Last Run of Day?}
    SetRandomTime --> TargetDistCheck
    
    TargetDistCheck -->|Yes| CheckTargetDistance[Calculate distance done today<br/>Set target override +/- random variance]
    TargetDistCheck -->|No| StandardDistance[Select random distance & pace<br/>Scale by activity type multiplier]

    %% Overlap Protection Phase
    CheckTargetDistance --> OverlapCheck{Overlap Protection Enabled?}
    StandardDistance --> OverlapCheck
    
    OverlapCheck -->|Yes| QueryOverlap[Check conflict range:<br/>[Start - SafeTime - RestTime, End + SafeTime + RestTime]]
    OverlapCheck -->|No| RoutingInit
    
    QueryOverlap --> OverlapConflict{Conflict found?}
    OverlapConflict -->|Yes| ErrorExit([❌ Failed: Overlap Conflict])
    OverlapConflict -->|No| RoutingInit
    
    %% Geography Phase
    RoutingInit[🎯 Determine Starting Coordinates] --> FavorPOI{Start Near Favorite POI?}
    FavorPOI -->|Yes (70%)| PickPOI[Select coordinate from Scenic POIs in Hanoi]
    FavorPOI -->|No (30%)| WeightedDistrict[Weighted Random District Selection]
    
    PickPOI --> RouteGen
    WeightedDistrict --> PickRandomInPolygon[Select random coordinate inside district polygon]
    PickRandomInPolygon --> RouteGen
    
    %% Routing Engine Phase
    RouteGen[🚲 Generate Route] --> OSRMRoute{Use OSRM Routing?}
    OSRMRoute -->|Yes| CallOSRM[Fetch real road points from OSRM API]
    OSRMRoute -->|No| FallbackGPS[Generate straight-line fallback nodes]
    
    CallOSRM --> Resampling[Resample route coordinates to uniform 10m segments]
    FallbackGPS --> Resampling
    
    %% Generation Phase
    Resampling --> SpeedCalcs[Determine pace & elevation grade]
    SpeedCalcs --> TimestampGen[Generate timestamps rounded to nearest second<br/>Clamp grade slope to max 8%]
    
    %% Device & Serialization Phase
    TimestampGen --> DeviceSelection[Resolve Watch Preset and Brand]
    DeviceSelection --> SerialHash[Generate serial string & hash to uint32 via DJB2]
    SerialHash --> LTSVersion[Lookup brand LTS software version]
    LTSVersion --> WriteFIT[Write binary FIT file via @markw65/fit-file-writer]
    
    %% Save Phase
    WriteFIT --> SaveDB[Save local activity to DB as generated]
    SaveDB --> DisableCustom[Turn off Custom Time in DB if enabled]
    DisableCustom --> SuccessExit([🎉 Output FIT File Ready])
```

---

## 🧠 Details of Key Rules & Algorithms

### 1. Weighted District Selection
When generating coordinates, if the start point is not selected from the favorite Scenic POIs list, the engine selects a Hanoi district randomly based on weighted coefficients:
*   **🏡 Home Coverage Weight**:
    *   `Fully` overlapping: `+20.0`
    *   `Mostly` overlapping: `+14.0`
    *   `Partially` overlapping: `+7.0`
*   **💼 Work Coverage Weight**:
    *   `Fully` overlapping: `+12.0`
    *   `Mostly` overlapping: `+7.5`
    *   `Partially` overlapping: `+3.0`
*   **⚡ Adjacent Boost Rules**:
    *   **Same district**: If a district was the location of the user's last generated activity, it gets a `+2.1` weight boost.
    *   **Neighboring district**: If adjacent to the last activity's district, it gets a `+1.4` weight boost.

### 2. Time & Overlap Validation
*   **Avoid Workhours**: Skips time ranges matching Monday-Friday office hours (`08:00 - 11:30` and `13:30 - 17:30`) if enabled.
*   **Overlap Protection (Vietnamese Timezone aware)**: Enforces a block interval:
    $$\text{Blocked Interval} = [T_{\text{start}} - T_{\text{safe}} - T_{\text{rest}}, T_{\text{end}} + T_{\text{safe}} + T_{\text{rest}}]$$
    *   *Manual Actions*: Ignore local draft activities (`upload_status = 'generated'`) to allow quick regeneration.
    *   *Scheduler Actions*: Include local drafts to prevent sequential slots from overlapping.

### 3. OSRM Route Smoothness & Pace
*   **Resampling**: Interpolates road segments to precisely 10-meter increments. This prevents Strava's parser from creating unnatural pacing shifts.
*   **Elevation Clamping**: Restricts the maximum absolute grade to $8\%$ ($\pm 0.08$ vertical/horizontal) to avoid sudden speed spikes on short hills.

### 4. Device Metadata Hashing
Because FIT binary writers reject string values for serial numbers, realistic serials (e.g. `'grmn_sn_4982_s81f3d'`) are processed through the DJB2 algorithm:
```javascript
function hashDJB2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return hash >>> 0; // Return unsigned 32-bit integer
}
```
This numeric serial is embedded into the FIT file header along with the brand's LTS software version.
