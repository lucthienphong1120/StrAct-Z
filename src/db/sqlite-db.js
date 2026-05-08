const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const encryption = require('../utils/encryption');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.sqlite');
const OLD_JSON_DB = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

let dbInstance = null;

const DEFAULT_CONFIG = {
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
  schedule_count_min: '1',
  schedule_count_max: '2',
};

async function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  });
  
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      access_token TEXT,
      refresh_token TEXT,
      expires_at INTEGER,
      athlete_id INTEGER,
      athlete_name TEXT,
      athlete_avatar TEXT,
      scope TEXT
    );
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT,
      activity_name TEXT,
      distance_km REAL,
      duration_min REAL,
      pace_min_km REAL,
      gpx_file TEXT,
      strava_activity_id TEXT,
      upload_status TEXT,
      error_message TEXT,
      route_start_lat REAL,
      route_start_lng REAL,
      route_start_time TEXT,
      district_keys TEXT,
      deleted_at TEXT
    );
  `);
  
  // Migrate from JSON if SQLite config is empty
  const configCount = await dbInstance.get('SELECT COUNT(*) as c FROM config');
  
  try {
    await dbInstance.exec('ALTER TABLE activities ADD COLUMN route_start_time TEXT');
    console.log('[SQLite] Added route_start_time column');
  } catch (e) {}

  try {
    await dbInstance.exec('ALTER TABLE activities ADD COLUMN district_keys TEXT');
    console.log('[SQLite] Added district_keys column');
  } catch (e) {}

  if (configCount.c === 0) {
    if (fs.existsSync(OLD_JSON_DB)) {
      try {
        const oldDb = JSON.parse(fs.readFileSync(OLD_JSON_DB, 'utf-8'));
        if (oldDb.config) {
          for (const [k, v] of Object.entries({ ...DEFAULT_CONFIG, ...oldDb.config })) {
            await dbInstance.run('INSERT INTO config (key, value) VALUES (?, ?)', [k, String(v)]);
          }
        }
        if (oldDb.tokens && oldDb.tokens.access_token) {
          await dbInstance.run(`INSERT INTO users (access_token, refresh_token, expires_at, athlete_id, athlete_name, athlete_avatar, scope) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
            [encryption.encrypt(oldDb.tokens.access_token), encryption.encrypt(oldDb.tokens.refresh_token), oldDb.tokens.expires_at, oldDb.tokens.athlete_id, oldDb.tokens.athlete_name, oldDb.tokens.athlete_avatar, oldDb.tokens.scope]);
        }
        if (oldDb.activities) {
          const acts = [...oldDb.activities].reverse();
          for (const a of acts) {
            await dbInstance.run(`INSERT INTO activities (id, created_at, activity_name, distance_km, duration_min, pace_min_km, gpx_file, strava_activity_id, upload_status, error_message, route_start_lat, route_start_lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [a.id, a.created_at, a.activity_name, a.distance_km, a.duration_min, a.pace_min_km, a.gpx_file, a.strava_activity_id, a.upload_status, a.error_message, a.route_start_lat, a.route_start_lng]);
          }
        }
        console.log('[SQLite] Migrated db.json to SQLite');
      } catch (e) {
        console.error('[SQLite] Migration failed', e);
      }
    } else {
      // Just seed default configs
      for (const [k, v] of Object.entries(DEFAULT_CONFIG)) {
        await dbInstance.run('INSERT INTO config (key, value) VALUES (?, ?)', [k, String(v)]);
      }
    }
  }
  
  return dbInstance;
}

async function getConfig(key) {
  const db = await getDb();
  const row = await db.get('SELECT value FROM config WHERE key = ?', [key]);
  return row ? row.value : (DEFAULT_CONFIG[key] || null);
}

async function setConfig(key, value) {
  const db = await getDb();
  await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, String(value)]);
}

async function getAllConfig() {
  const db = await getDb();
  const rows = await db.all('SELECT key, value FROM config');
  const conf = { ...DEFAULT_CONFIG };
  for (const r of rows) conf[r.key] = r.value;
  return conf;
}

async function saveTokens(data) {
  const db = await getDb();
  await db.run('DELETE FROM users'); // Multi-user placeholder: delete old user for now to maintain single-user behavior until UI supports multi-user login
  await db.run(`INSERT INTO users (access_token, refresh_token, expires_at, athlete_id, athlete_name, athlete_avatar, scope) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
    [encryption.encrypt(data.access_token), encryption.encrypt(data.refresh_token), data.expires_at, data.athlete_id, data.athlete_name, data.athlete_avatar, data.scope]);
}

async function getTokens() {
  const db = await getDb();
  const user = await db.get('SELECT * FROM users ORDER BY id DESC LIMIT 1');
  if (!user) return null;
  return {
    access_token: encryption.decrypt(user.access_token),
    refresh_token: encryption.decrypt(user.refresh_token),
    expires_at: user.expires_at,
    athlete_id: user.athlete_id,
    athlete_name: user.athlete_name,
    athlete_avatar: user.athlete_avatar,
    scope: user.scope
  };
}

async function deleteTokens() {
  const db = await getDb();
  await db.run('DELETE FROM users');
}

async function saveActivity(data) {
  const db = await getDb();
  const res = await db.run(`INSERT INTO activities (created_at, activity_name, distance_km, duration_min, pace_min_km, gpx_file, strava_activity_id, upload_status, error_message, route_start_lat, route_start_lng, route_start_time, district_keys) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [new Date().toISOString(), data.activity_name, data.distance_km, data.duration_min, data.pace_min_km, data.gpx_file, data.strava_activity_id || null, data.upload_status || 'pending', null, data.route_start_lat, data.route_start_lng, data.route_start_time || null, data.district_keys || null]);
  return res.lastID;
}

async function updateActivity(id, data) {
  const db = await getDb();
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(data)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return;
  vals.push(id);
  await db.run(`UPDATE activities SET ${sets.join(', ')} WHERE id = ?`, vals);
}

async function getActivities(limit = 50) {
  const db = await getDb();
  return await db.all(`SELECT * FROM activities WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ?`, [limit]);
}

async function deleteActivity(id, hard = false) {
  const db = await getDb();
  if (hard) {
    await db.run(`DELETE FROM activities WHERE id = ?`, [id]);
  } else {
    await db.run(`UPDATE activities SET upload_status = 'deleted', deleted_at = ? WHERE id = ?`, [new Date().toISOString(), id]);
  }
  return true;
}

async function getActivityStats() {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10) + '%';
  const total = (await db.get('SELECT COUNT(*) as c FROM activities WHERE deleted_at IS NULL')).c;
  const uploaded = (await db.get("SELECT COUNT(*) as c FROM activities WHERE upload_status = 'uploaded' AND deleted_at IS NULL")).c;
  const failed = (await db.get("SELECT COUNT(*) as c FROM activities WHERE upload_status = 'failed' AND deleted_at IS NULL")).c;
  const sums = await db.get("SELECT SUM(distance_km) as dist, SUM(duration_min) as dur FROM activities WHERE upload_status = 'uploaded' AND deleted_at IS NULL");
  const todayCount = (await db.get('SELECT COUNT(*) as c FROM activities WHERE created_at LIKE ? AND deleted_at IS NULL', [today])).c;

  return {
    total,
    uploaded,
    failed,
    totalDistanceKm: Math.round((sums.dist || 0) * 10) / 10,
    totalDurationMin: Math.round(sums.dur || 0),
    todayCount,
  };
}

module.exports = {
  getDb,
  getConfig, setConfig, getAllConfig,
  saveTokens, getTokens, deleteTokens,
  saveActivity, updateActivity, getActivities,
  getActivityStats, deleteActivity,
};
