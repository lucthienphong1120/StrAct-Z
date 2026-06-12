# 🏗️ StrAct Z - System Architecture

This document presents the system components, database schema, and core algorithms of StrAct Z in a fully visualized format.

---

## 🗺️ High-Level System Architecture

This diagram shows how the client browser, Node.js server components, SQLite database, and external APIs interact.

```mermaid
graph TB
    subgraph Client ["🌐 Client Interface (Browser)"]
        UI["Dashboard / Setup UI"]
        Storage["HttpOnly JWT Cookie"]
    end

    subgraph Server ["💻 StrAct Z Server (Node.js)"]
        Router["Express Router & Auth Middleware"]
        Engine["FIT/GPX Generation Engine"]
        Scheduler["Background Scheduler"]
    end

    subgraph DB ["💾 Database Layer"]
        SQLite[("SQLite Database")]
    end

    subgraph External ["☁️ External Services"]
        OSRM["OSRM API - Map Matching"]
        Strava["Strava API - OAuth & Upload"]
    end

    %% Client to Server
    UI -->|HTTP Requests| Router
    Storage -->|JWT Authentication| Router
    
    %% Server Components
    Router -->|Read/Write User Settings & History| SQLite
    Router -->|Manual Generate / Upload| Engine
    Scheduler -->|Read Active Schedules| SQLite
    Scheduler -->|Auto Generate / Upload| Engine
    
    %% FIT Engine Actions
    Engine -->|Request Road Matching| OSRM
    Engine -->|Save Activity History| SQLite
    Engine -->|OAuth Token Exchange & Upload File| Strava
```

---

## 💾 Database ER Diagram

StrAct Z uses a multi-tenant SQLite database structure configured as follows:

```mermaid
erDiagram
    ACCOUNTS ||--o{ USERS : "links one"
    ACCOUNTS ||--o{ USER_CONFIG : "defines configs"
    ACCOUNTS ||--o{ ACTIVITIES : "owns activities"
    
    ACCOUNTS {
        int id PK
        string username
        string password_hash
        string role
    }
    USERS {
        int id PK
        int account_id FK
        string access_token
        string refresh_token
        int expires_at
        int athlete_id
        string athlete_name
        string athlete_avatar
        string scope
    }
    USER_CONFIG {
        int account_id PK, FK
        string key PK
        string value
    }
    ACTIVITIES {
        int id PK
        int account_id FK
        string created_at
        string activity_name
        float distance_km
        float duration_min
        float pace_min_km
        string fit_file
        string strava_activity_id
        string upload_status
        string error_message
        float route_start_lat
        float route_start_lng
        string route_start_time
        string district_keys
        string deleted_at
        string created_by
    }
```

---

## 🚀 Activity Generation Flowchart

The execution flow of the generation engine from trigger to the final output of a signed Garmin `.fit` or `.gpx` activity file.

```mermaid
graph TD
    %% Trigger Phase
    Start(["⚡ Trigger Activity Generation"]) --> InputCheck{"Manual or Scheduler?"}
    
    %% Setup & Custom Time Phase
    InputCheck -->|Manual| BuildManualConfig["Read UI parameters / Overrides"]
    InputCheck -->|Scheduler| BuildSchedulerConfig["Fetch DB User Settings & Check Slots"]
    
    BuildManualConfig --> TimingCheck{"Custom Time Active?"}
    BuildSchedulerConfig --> TimingCheck
    
    TimingCheck -->|Yes| SetCustomTime["Use Custom Date & Time<br/>Bypass random bounds"]
    TimingCheck -->|No| SetRandomTime["Select random time within bounds<br/>Check Avoid Workhours"]
    
    %% Target Distance Phase
    SetCustomTime --> TargetDistCheck{"Scheduler & Last Run of Day?"}
    SetRandomTime --> TargetDistCheck
    
    TargetDistCheck -->|Yes| CheckTargetDistance["Calculate distance done today<br/>Set target override +/- random variance"]
    TargetDistCheck -->|No| StandardDistance["Select random distance & pace<br/>Scale by activity type multiplier"]

    %% Overlap Protection Phase
    CheckTargetDistance --> OverlapCheck{"Overlap Protection Enabled?"}
    StandardDistance --> OverlapCheck
    
    OverlapCheck -->|Yes| QueryOverlap["Check conflict range:<br/>[Start - SafeTime - RestTime, End + SafeTime + RestTime]"]
    OverlapCheck -->|No| RoutingInit
    
    QueryOverlap --> OverlapConflict{"Conflict found?"}
    OverlapConflict -->|Yes| ErrorExit(["❌ Failed: Overlap Conflict"])
    OverlapConflict -->|No| RoutingInit
    
    %% Geography Phase
    RoutingInit["🎯 Determine Starting Coordinates"] --> FavorPOI{"Start Near Favorite POI?"}
    FavorPOI -->|Yes (70%)| PickPOI["Select coordinate from Scenic POIs in Hanoi"]
    FavorPOI -->|No (30%)| WeightedDistrict["Weighted Random District Selection"]
    
    PickPOI --> RouteGen
    WeightedDistrict --> PickRandomInPolygon["Select random coordinate inside district polygon"]
    PickRandomInPolygon --> RouteGen
    
    %% Routing Engine Phase
    RouteGen["🚲 Generate Route"] --> OSRMRoute{"Use OSRM Routing?"}
    OSRMRoute -->|Yes| CallOSRM["Fetch real road points from OSRM API"]
    OSRMRoute -->|No| FallbackGPS["Generate straight-line fallback nodes"]
    
    CallOSRM --> Resampling["Resample route coordinates to uniform 10m segments"]
    FallbackGPS --> Resampling
    
    %% Generation Phase
    Resampling --> SpeedCalcs["Determine pace & elevation grade"]
    SpeedCalcs --> TimestampGen["Generate timestamps rounded to nearest second<br/>Clamp grade slope to max 8%"]
    
    %% Device & Serialization Phase
    TimestampGen --> DeviceSelection["Resolve Watch Preset and Brand"]
    DeviceSelection --> SerialHash["Generate serial string & hash to uint32 via DJB2"]
    SerialHash --> LTSVersion["Lookup brand LTS software version"]
    LTSVersion --> WriteFIT["Write binary FIT or GPX file"]
    
    %% Save Phase
    WriteFIT --> SaveDB["Save local activity to DB as generated"]
    SaveDB --> DisableCustom["Turn off Custom Time in DB if enabled"]
    DisableCustom --> SuccessExit(["🎉 Output Activity File Ready"])
```

---

## 🏡 Weighted District Selection & Boost Logic

When selecting random starting coordinates outside Scenic POIs, districts are chosen using weights calculated from Home/Work coverage overlays and the starting district of the last uploaded/removed activity.

```mermaid
graph TD
    Start(["Start District Selection"]) --> BaseWeight["Set base weight for all districts = 1.0"]
    
    BaseWeight --> HomeCheck{"Has Home Area?"}
    HomeCheck -->|Yes| ApplyHome["Calculate Home Overlap Ratio<br/>Fully (>=85%): +20.0<br/>Mostly (>=35%): +14.0<br/>Partially (>0%): +7.0"]
    HomeCheck -->|No| WorkCheck{"Has Work Area?"}
    
    ApplyHome --> WorkCheck
    WorkCheck -->|Yes| ApplyWork["Calculate Work Overlap Ratio<br/>Fully (>=85%): +12.0<br/>Mostly (>=35%): +7.5<br/>Partially (>0%): +3.0"]
    WorkCheck -->|No| AdjacentCheck{"Adjacent to starting district of last activity?"}
    
    ApplyWork --> AdjacentCheck
    AdjacentCheck -->|Same District| BoostSame["Add boost +2.1"]
    AdjacentCheck -->|Neighbor District| BoostNeigh["Add boost +1.4"]
    AdjacentCheck -->|Otherwise| WeightedRandom["Run Weighted Random Choice"]
    
    BoostSame --> WeightedRandom
    BoostNeigh --> WeightedRandom
    WeightedRandom --> End(["District Selected"])
```

---

## ⚙️ Device Metadata Hashing

String serial numbers are converted to 32-bit unsigned integers using the DJB2 hashing algorithm to comply with Garmin FIT binary requirements.

```mermaid
flowchart LR
    StringSerial["String Serial:<br/>'grmn_sn_4982_xxxxxx'"] --> DJB2["DJB2 Hashing Algorithm"]
    DJB2 --> UInt32Serial["Unsigned 32-bit Integer Serial"]
    UInt32Serial --> FITHeader["Embedded into FIT File Header"]
```
