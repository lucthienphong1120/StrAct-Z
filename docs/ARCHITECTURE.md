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
    Start(["⚡ Start Generation"]) --> Trigger
    
    subgraph Triggers ["⚡ Trigger, Schedule & Limits Evaluation"]
        Trigger{"Trigger Type?"}
        ReadUI["Read Request Parameters<br/>(Target distance, type, format, custom time toggle, etc.)"]
        ReadSettings["Fetch User Config from DB"]
        
        ReadSettings --> RandSchedules["Read count limits (min/max config)<br/>Randomize activity count for today<br/>Register schedule time slots (Schedule 1 / Schedule 2)"]
        RandSchedules --> SyncCache["Fetch & Sync activities cache with Strava Cloud<br/>Soft-delete missing local 'uploaded' activities as 'removed'"]
        
        SyncCache --> CheckLimit{"Daily Activity Limit Reached?<br/>(Active Local DB + Cached Strava Cloud today)"}
        CheckLimit -->|Yes| SaveFailedLimit["Create DB Activity with Status: FAILED<br/>(Exit scheduler loop)"]
        CheckLimit -->|No| AcquireLock["Acquire Concurrency Lock<br/>(Placeholder: 'generating')"]
    end
    
    AcquireLock --> TimingMode
    ReadUI --> TimingMode
    
    %% 2. Timing & Date
    subgraph Timing ["⏰ Time Selection & Avoid Workhours"]
        TimingMode{"Custom Time Enabled?"}
        CustomTime["Use Exact Custom Date & Time<br/>Bypass Global Random Bounds"]
        RandomTime["Select Random Time within Bounds<br/>Check Avoid Workhours (T2-T6)"]
        
        TimingMode -->|Yes| CustomTime
        TimingMode -->|No| RandomTime
    end
    
    CustomTime --> DistanceMode
    RandomTime --> DistanceMode
    
    %% 3. Distance & Overlap
    subgraph DistanceOverlap ["📏 Distance Selection & Overlap Protection"]
        DistanceMode{"Is Scheduler & Last Run of Day & Target Distance Enabled?"}
        TargetDistance["Calculate Remaining Target Distance today<br/>Set Distance to Remaining -100m to min_distance and +100m to max_distance"]
        StdDistance["Select Random Distance & Pace within limits<br/>Apply Activity Type Multiplier (Walk x0.7, Run x1.0, Ride x1.5)"]
        
        CheckOverlap["Check Overlaps against active activities today<br/>Using active overlap buffers:<br/>- Safe Time (Fixed minutes buffer)<br/>- Rest Time (% of activity duration)<br/>(User can configure either, both, or none)"]
        
        OverlapConflict{"Conflict?<br/>(Falls inside [aStart - SafeTime - RestTime(a),<br/>aEnd + SafeTime + RestTime(a)] or new activity's rest overlaps)"}
        SaveFailedOverlap["Set status to FAILED / Show UI Error"]
        
        DistanceMode -->|Yes| TargetDistance
        DistanceMode -->|No| StdDistance
        
        TargetDistance --> CheckOverlap
        StdDistance --> CheckOverlap
        
        CheckOverlap --> OverlapConflict
    end
    
    OverlapConflict -->|Yes| SaveFailedOverlap
    OverlapConflict -->|No| SelectDistrict
    
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
    subgraph ReturnProbabilities ["🔄 Return & Stopping Probability Logic"]
        ReturnCheck{"Determine Return / P2P Mode"}
        PoiToPoiReturn{"Roll Return Probability"}
        StopPoi["Stop at second POI (outbound path only)"]
        LoopBack["Loop back to starting POI"]
        
        RandToPoiReturn{"Roll Return Probability"}
        StdReturn{"Roll Return Probability"}
        StopRand["Stop at random point (outbound only)"]
        
        RouteShape --> ReturnCheck
        
        ReturnCheck -->|POI-to-POI| PoiToPoiReturn
        PoiToPoiReturn -->|70% Stop P2P| StopPoi
        PoiToPoiReturn -->|30% Return| LoopBack
        
        ReturnCheck -->|Random-to-POI| RandToPoiReturn
        RandToPoiReturn -->|85% Stop P2P| StopPoi
        RandToPoiReturn -->|15% Return| LoopBack
        
        ReturnCheck -->|Home/Work or No POI| StdReturn
        StdReturn -->|50% P2P| StopRand
        StdReturn -->|50% Return| LoopBack
    end
    
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

---

## 🔄 Centralized Cache & Cloud Sync Flowchart

This diagram explains the synchronization layer between local SQLite DB and Strava Cloud. It maps out how the in-memory cache behaves, when updates are fetched, and how "ghost" activities (removed from Strava) are soft-deleted locally.

```mermaid
graph TD
    %% Cache Check
    StartSync(["⚡ Request User Activities / Daily Limit Check"]) --> CacheCheck{"Cache Valid?<br/>(Within 30-min TTL)"}
    
    %% Cache Hit
    CacheCheck -->|Yes| ServingCached["Serve from In-Memory Cache<br/>(userRecentActivities Map)"]
    
    %% Cache Miss
    CacheCheck -->|No| FetchStrava["Fetch latest 50 activities from Strava API"]
    
    %% Update Cache & DB Sync
    FetchStrava --> UpdateCache["Update userRecentActivities Map<br/>Set TTL timestamp = Now"]
    UpdateCache --> DBCheck["Get local activities from SQLite DB"]
    
    %% Sync Loop
    DBCheck --> SyncLoop["Loop through local DB activities in time window"]
    SyncLoop --> FindStatus{"Is activity marked as 'uploaded'<br/>but missing on Strava Cloud?"}
    
    FindStatus -->|Yes| MarkRemoved["Soft-delete: Update status to 'removed' in local DB<br/>(Deduplicates 'ghost' activities)"]
    FindStatus -->|No| CheckDiff{"Found on Strava: Any fields differ?<br/>(Start time, Name, Distance, Duration)"}
    
    CheckDiff -->|Yes| UpdateLocal["Update local DB activity fields to match Strava Cloud"]
    CheckDiff -->|No| ContinueLoop["No action needed"]
    
    MarkRemoved --> ServingCacheCombined["Combine cached Cloud list with active local DB drafts"]
    UpdateLocal --> ServingCacheCombined
    ContinueLoop --> ServingCacheCombined
    
    ServingCached --> ServingCacheCombined
    ServingCacheCombined --> EndSync(["Return Cached & Synced Activity List"])
```

