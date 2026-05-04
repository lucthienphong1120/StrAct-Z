/**
 * JSON File-based Database - No native dependencies required
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULT_DB = {
  config: {
    schedule_enabled: 'false',
    schedule_cron: '0 6 * * *',
    schedule_time: '06:00',
    min_distance_km: '0.5',
    max_distance_km: '10',
    min_pace: '8.0',
    max_pace: '12.0',
    min_time: '04:30',
    max_time: '21:30',
    work_start1: '08:00',
    work_end1: '11:30',
    work_start2: '13:30',
    work_end2: '17:30',
    start_lat: '21.0285',
    start_lng: '105.8542',
    district_key: 'random',
    max_district_span: '1',
    selected_districts: 'hoan_kiem,hai_ba_trung,hoang_mai,dong_da,ba_dinh,thanh_xuan,cau_giay,tay_ho',
    activity_type: 'Random',
    variation_enabled: 'true',
    heart_rate_enabled: 'true',
    min_heart_rate: '80',
    max_heart_rate: '160',
    use_osrm: 'true',
  },
  tokens: null,
  activities: [],
  nextActivityId: 1,
};

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      // Merge with defaults for any missing keys
      return { ...DEFAULT_DB, ...data, config: { ...DEFAULT_DB.config, ...(data.config || {}) } };
    }
  } catch (err) {
    console.error('[DB] Error loading database, using defaults:', err.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_DB));
}

function saveDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getConfig(key) {
  const db = loadDb();
  return db.config[key] || null;
}

function setConfig(key, value) {
  const db = loadDb();
  db.config[key] = String(value);
  saveDb(db);
}

function getAllConfig() {
  return loadDb().config;
}

function saveTokens(data) {
  const db = loadDb();
  db.tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_id: data.athlete_id,
    athlete_name: data.athlete_name,
    athlete_avatar: data.athlete_avatar || null,
    scope: data.scope || '',
  };
  saveDb(db);
}

function getTokens() {
  return loadDb().tokens;
}

function deleteTokens() {
  const db = loadDb();
  db.tokens = null;
  saveDb(db);
}

function saveActivity(data) {
  const db = loadDb();
  const id = db.nextActivityId++;
  const activity = {
    id,
    created_at: new Date().toISOString(),
    activity_name: data.activity_name,
    distance_km: data.distance_km,
    duration_min: data.duration_min,
    pace_min_km: data.pace_min_km,
    gpx_file: data.gpx_file,
    strava_activity_id: data.strava_activity_id || null,
    upload_status: data.upload_status || 'pending',
    error_message: null,
    route_start_lat: data.route_start_lat,
    route_start_lng: data.route_start_lng,
  };
  db.activities.unshift(activity); // newest first
  saveDb(db);
  return id;
}

function updateActivity(id, data) {
  const db = loadDb();
  const idx = db.activities.findIndex(a => a.id === id);
  if (idx !== -1) {
    Object.assign(db.activities[idx], data);
    saveDb(db);
  }
}

function getActivities(limit = 50) {
  const db = loadDb();
  return db.activities.slice(0, limit);
}

/**
 * Mark activity as deleted (soft delete) or remove fully
 */
function deleteActivity(id, hard = false) {
  const db = loadDb();
  const idx = db.activities.findIndex(a => a.id === id);
  if (idx === -1) return false;
  if (hard) {
    db.activities.splice(idx, 1);
  } else {
    db.activities[idx].upload_status = 'deleted';
    db.activities[idx].deleted_at = new Date().toISOString();
  }
  saveDb(db);
  return true;
}

function getActivityStats() {
  const db = loadDb();
  const all = db.activities;
  const uploaded = all.filter(a => a.upload_status === 'uploaded');
  const failed = all.filter(a => a.upload_status === 'failed');
  const today = new Date().toISOString().slice(0, 10);
  const todayActivities = all.filter(a => a.created_at && a.created_at.slice(0, 10) === today);

  return {
    total: all.length,
    uploaded: uploaded.length,
    failed: failed.length,
    totalDistanceKm: Math.round(uploaded.reduce((s, a) => s + (a.distance_km || 0), 0) * 10) / 10,
    totalDurationMin: Math.round(uploaded.reduce((s, a) => s + (a.duration_min || 0), 0)),
    todayCount: todayActivities.length,
  };
}

module.exports = {
  getConfig,
  setConfig,
  getAllConfig,
  saveTokens,
  getTokens,
  deleteTokens,
  saveActivity,
  updateActivity,
  getActivities,
  getActivityStats,
  deleteActivity,
};
