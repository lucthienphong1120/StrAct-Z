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

## 🚀 Activity Generation & Routing Flowchart

This comprehensive flowchart details the entire execution flow from trigger to the final output of a signed Garmin `.fit` or `.gpx` activity file, including concurrency lock, daily limit checks, overlap protection, weighted district selection, favorite place start points, smart POI-to-POI routing, return probability rules, and biometrics simulation.

```mermaid
graph TD
    %% 1. Trigger & Limits
    Start(["⚡ Start Generation"]) --> Trigger{"Trigger Type?"}
    Trigger -->|Manual| ReadUI["Read UI Overrides (Target Date, Custom Time, etc.)"]
    Trigger -->|Scheduler| ReadSettings["Fetch User Config & Slots from DB"]
    
    ReadSettings --> CheckLimit{"Daily Activity Limit Reached?<br/>(Local DB + Strava Cloud)"}
    CheckLimit -->|Yes| SaveFailedLimit["Create DB Activity with Status: FAILED<br/>(Exit scheduler loop)"]
    CheckLimit -->|No| AcquireLock["Acquire Concurrency Lock<br/>(Placeholder: 'generating')"]
    
    AcquireLock --> TimingMode
    ReadUI --> TimingMode{"Custom Time Enabled?"}
    
    %% 2. Timing & Date
    TimingMode -->|Yes| CustomTime["Use Exact Custom Date & Time<br/>Bypass Global Random Bounds"]
    TimingMode -->|No| RandomTime["Select Random Time within Bounds<br/>Check Avoid Workhours (Mon-Fri only)"]
    
    CustomTime --> DistanceMode
    RandomTime --> DistanceMode{"Is Scheduler & Last Run of Day & Target Distance Enabled?"}
    
    %% 3. Distance & Overlap
    DistanceMode -->|Yes| TargetDistance["Calculate Remaining Target Distance today<br/>Set Distance to Remaining +/- 50-200m variation<br/>Clamp to min_distance and max_distance"]
    DistanceMode -->|No| StdDistance["Select Random Distance & Pace within limits<br/>Apply Activity Type Multiplier (Walk x0.7, Run x1.0, Ride x1.5)"]
    
    TargetDistance --> OverlapCheck{"Overlap Protection Enabled?"}
    StdDistance --> OverlapCheck
    
    OverlapCheck -->|Yes| CheckOverlap["Check Overlaps against active activities in<br/>(Start-SafeTime-RestTime to End+SafeTime+RestTime)"]
    CheckOverlap --> OverlapConflict{"Conflict?"}
    OverlapConflict -->|Yes| SaveFailedOverlap["Set status to FAILED / Show UI Error"]
    OverlapConflict -->|No| SelectDistrict
    OverlapCheck -->|No| SelectDistrict
    
    %% 4. District & Coordinate Selection
    subgraph Selection ["🎯 District & Start Coordinate Selection"]
        SelectDistrict["Calculate District Weights:<br/>- Base Weight = 1.0<br/>- Home Boost (Fully +20, Mostly +14, Partially +7)<br/>- Work Boost (Fully +12, Mostly +7.5, Partially +3)<br/>- Adjacent Boost (Same starting district +2.1, Neighbor +1.4)"]
        SelectDistrict --> RollDistrict["Select District via Weighted Random Selection"]
        RollDistrict --> FavorCheck{"Start Near Favorite Place Enabled?"}
        
        FavorCheck -->|Yes| RollFavorite{"Roll Start Point Type"}
        RollFavorite -->|55% Home/Work| HomeWorkStart["Start near Home or Work coordinate<br/>(+ random 100m-300m offset)"]
        RollFavorite -->|35% POI| POIStart["Start near Scenic POI coordinate<br/>(+ random 0m-200m offset)"]
        RollFavorite -->|10% Random| PolygonStart["Start at true random point in district polygon<br/>(Rejection sampling with bbox fallback)"]
        
        FavorCheck -->|No| PolygonStart
    end
    
    HomeWorkStart --> RoutingEngine
    POIStart --> RoutingEngine
    PolygonStart --> RoutingEngine
    
    %% 5. Waypoint & Routing Engine
    subgraph Routing ["🚲 Route Generation & POI Targeting"]
        RoutingEngine{"Is Start Point a POI?"}
        
        RoutingEngine -->|Yes| POILoopCheck{"Roll POI-to-POI Routing?"}
        POILoopCheck -->|30% Yes| TargetPOI["Target neighboring POI within 1.5km"]
        POILoopCheck -->|70% No| GeometricLoop["Generate Classic Loop/Out-Back Route around start"]
        
        RoutingEngine -->|No| TargetPoiNear{"POI within 1.5km?"}
        TargetPoiNear -->|Yes| CheckPoiDist{"Is target distance >= 2.5 * d?"}
        CheckPoiDist -->|Yes| TargetPOI
        CheckPoiDist -->|No| GeometricLoop
        TargetPoiNear -->|No| GeometricLoop
        
        TargetPOI --> RouteShape{"Generate Route Points"}
        GeometricLoop --> RouteShape
    end
    
    %% 6. Return & Stopping Probabilities
    RouteShape --> ReturnCheck{"Determine Return / P2P Mode"}
    ReturnCheck -->|POI-to-POI| PoiToPoiReturn{"Roll Return Probability"}
    PoiToPoiReturn -->|70% Stop P2P| StopPoi["Stop at second POI (outbound path only)"]
    PoiToPoiReturn -->|30% Return| LoopBack["Loop back to starting POI"]
    
    ReturnCheck -->|Random-to-POI| RandToPoiReturn{"Roll Return Probability"}
    RandToPoiReturn -->|85% Stop P2P| StopPoi
    RandToPoiReturn -->|15% Return| LoopBack
    
    ReturnCheck -->|Home/Work or No POI| StdReturn{"Roll Return Probability"}
    StdReturn -->|50% P2P| StopRand["Stop at random point (outbound only)"]
    StdReturn -->|50% Return| LoopBack
    
    StopPoi --> RoadSnapping
    StopRand --> RoadSnapping
    LoopBack --> RoadSnapping
    
    %% 7. Snapping & Simulation
    subgraph Simulation ["🛣️ Road Snapping & Biometrics Simulation"]
        RoadSnapping{"Use Snap OSRM Routing?"}
        RoadSnapping -->|Yes| OSRMCall["Fetch real road points from OSRM API"]
        RoadSnapping -->|No| FallbackLine["Fetch straight-line GPS points"]
        
        OSRMCall --> Resampling["Resample coordinates to uniform 10m spacing"]
        FallbackLine --> Resampling
        
        Resampling --> HRZone["Calculate Target Heart Rate Zone by Activity Type:<br/>- Walk: 50-60% MHR<br/>- Ride: 60-70% MHR<br/>- Run: 70-85% MHR"]
        HRZone --> SimulationRuns["Simulate Pace & biometrics:<br/>- 30% Hot Weather (+3 to 8 BPM)<br/>- 1.5% Red Light Stop (rest 15-60s, HR drops)<br/>- Elevation grade clamped to max 8%"]
    end
    
    SimulationRuns --> BuildFormat
    
    %% 8. File Encoding & Export
    subgraph Export ["💾 File Generation & Device Mapping"]
        BuildFormat{"Export Format?"}
        BuildFormat -->|FIT| FitWriter["Encode binary FIT format"]
        BuildFormat -->|GPX| GpxWriter["Encode GPX format"]
        
        FitWriter --> DeviceMapping["Map Device Details:<br/>- Garmin: Set Manufacturer (1) & Product ID Enum<br/>- Non-Garmin: Set Manufacturer, Product (undefined), product_name in device_info<br/>- Serial: Hash serial string to uint32 (DJB2)"]
        GpxWriter --> DeviceMapping
        
        DeviceMapping --> SaveActivity["Save to SQLite DB with status: generated / uploaded"]
        SaveActivity --> ClearCustomTime["Disable Custom Time in user_config"]
    end
    
    ClearCustomTime --> End(["🎉 Output Activity Ready"])
    SaveFailedLimit --> End
    SaveFailedOverlap --> End
```
