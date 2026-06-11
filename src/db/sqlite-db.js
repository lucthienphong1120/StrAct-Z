const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const encryption = require('../utils/encryption');
const systemLimits = require('../config/limits');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.sqlite');
const OLD_JSON_DB = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

let dbInstance = null;
let dbPromise = null;

const DEFAULT_CONFIG = {
  selected_districts: systemLimits.selected_districts.default.join(','),
  max_district_span: String(systemLimits.max_district_span.default),
  overlap_protection_minutes: String(systemLimits.overlap_protection_minutes.default),
  rest_time_percent: String(systemLimits.rest_time_percent.default),
  use_osrm: String(systemLimits.use_osrm.default),
  boost_adjacent: String(systemLimits.boost_adjacent.default),
  min_time: systemLimits.random_time_bounds.default.start,
  max_time: systemLimits.random_time_bounds.default.end,
  custom_time_enabled: String(systemLimits.custom_time_enabled.default),
  target_time_custom: systemLimits.target_time_custom.default,
  work_start1: systemLimits.avoid_workhours.default.start1,
  work_end1: systemLimits.avoid_workhours.default.end1,
  work_start2: systemLimits.avoid_workhours.default.start2,
  work_end2: systemLimits.avoid_workhours.default.end2,
  min_distance_km: String(systemLimits.min_distance_km.default),
  max_distance_km: String(systemLimits.max_distance_km.default),
  activity_type: systemLimits.activity_type.default,
  device_name: systemLimits.device_name.default,
  heart_rate_enabled: String(systemLimits.heart_rate_enabled.default),
  user_age: String(systemLimits.user_age.default),
  min_pace: String(systemLimits.min_pace.default),
  max_pace: String(systemLimits.max_pace.default),
  sim_weather: String(systemLimits.sim_weather.default),
  sim_redlights: String(systemLimits.sim_redlights.default),
  sync_google_fit: String(systemLimits.sync_google_fit.default),
  daily_max_activity: String(systemLimits.daily_max_activity.default),
  schedule_enabled: String(systemLimits.schedule_enabled.default),
  schedule_time: systemLimits.schedule_time.default,
  schedule_count: String(systemLimits.schedule_count.default),
  schedule_time_2: systemLimits.schedule_time_2.default,
  schedule_count_min: String(systemLimits.schedule_count_min.default),
  schedule_count_max: String(systemLimits.schedule_count_max.default),
  target_distance_enabled: String(systemLimits.target_distance_enabled.default),
  target_distance_km: String(systemLimits.target_distance_km.default),
  activity_areas: '[]',
  map_lat: String(systemLimits.map_lat.default),
  map_lng: String(systemLimits.map_lng.default),
  map_zoom: String(systemLimits.map_zoom.default),
  map_locked: String(systemLimits.map_locked.default),
  start_near_favorite_place: String(systemLimits.start_near_favorite_place.default),
};

async function getDb() {
  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    try {
      const db = await open({
        filename: DB_FILE,
        driver: sqlite3.Database
      });
      
      // Enable WAL mode for better concurrency
      await db.exec('PRAGMA journal_mode=WAL');
      
      await db.exec(`
        CREATE TABLE IF NOT EXISTS config (
          key TEXT PRIMARY KEY,
          value TEXT
        );
        CREATE TABLE IF NOT EXISTS user_config (
          account_id INTEGER,
          key TEXT,
          value TEXT,
          PRIMARY KEY (account_id, key)
        );
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER,
          access_token TEXT,
          refresh_token TEXT,
          expires_at INTEGER,
          athlete_id INTEGER,
          athlete_name TEXT,
          athlete_avatar TEXT,
          scope TEXT
        );
        CREATE TABLE IF NOT EXISTS external_tokens (
          account_id INTEGER,
          provider TEXT,
          access_token TEXT,
          refresh_token TEXT,
          expires_at INTEGER,
          scope TEXT,
          PRIMARY KEY (account_id, provider)
        );
        CREATE TABLE IF NOT EXISTS activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER,
          created_at TEXT,
          activity_name TEXT,
          distance_km REAL,
          duration_min REAL,
          pace_min_km REAL,
          fit_file TEXT,
          strava_activity_id TEXT,
          upload_status TEXT,
          error_message TEXT,
          route_start_lat REAL,
          route_start_lng REAL,
          route_start_time TEXT,
          district_keys TEXT,
          deleted_at TEXT,
          created_by TEXT
        );
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT DEFAULT 'normal',
          created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS vip_codes (
          code TEXT PRIMARY KEY,
          status TEXT DEFAULT 'available',
          usage_limit INTEGER DEFAULT -1 -- -1 for unlimited
        );
        CREATE TABLE IF NOT EXISTS vip_code_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT,
          account_id INTEGER,
          activated_at TEXT,
          UNIQUE(code, account_id)
        );
        CREATE TABLE IF NOT EXISTS security_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER,
          action TEXT,
          ip TEXT,
          created_at TEXT
        );
      `);
      
      // Migrate from JSON if SQLite config is empty
      const configCount = await db.get('SELECT COUNT(*) as c FROM config');
      
      // Seed default VIP code
      try {
        await db.run("INSERT OR IGNORE INTO vip_codes (code, status) VALUES (?, ?)", ['CRF@2026', 'available']);
      } catch (e) {}



      try {
        await db.exec('ALTER TABLE activities ADD COLUMN route_start_time TEXT');
        console.log('[SQLite] Added route_start_time column');
      } catch (e) {}

      try {
        await db.exec('ALTER TABLE activities ADD COLUMN district_keys TEXT');
        console.log('[SQLite] Added district_keys column');
      } catch (e) {}

      try {
        await db.exec('ALTER TABLE activities ADD COLUMN account_id INTEGER DEFAULT 1');
        console.log('[SQLite] Added account_id to activities');
      } catch (e) {}

      try {
        await db.exec('ALTER TABLE users ADD COLUMN account_id INTEGER DEFAULT 1');
        console.log('[SQLite] Added account_id to users');
      } catch (e) {}

      // Safe migration: rename activities.gpx_file to fit_file
      try {
        const tableInfo = await db.all("PRAGMA table_info(activities)");
        const hasGpxFile = tableInfo.some(col => col.name === 'gpx_file');
        const hasFitFile = tableInfo.some(col => col.name === 'fit_file');
        if (hasGpxFile && !hasFitFile) {
          await db.exec('ALTER TABLE activities RENAME COLUMN gpx_file TO fit_file');
          console.log('[SQLite] Renamed activities.gpx_file column to fit_file');
        } else if (!hasFitFile) {
          await db.exec('ALTER TABLE activities ADD COLUMN fit_file TEXT');
          console.log('[SQLite] Added activities.fit_file column');
        }
      } catch (e) {
        console.error('[SQLite] Migration of activities column failed:', e.message);
      }

      // Safe migration: rename data/gpx folder to data/fit
      try {
        const oldGpxDir = path.join(__dirname, '..', '..', 'data', 'gpx');
        const newFitDir = path.join(__dirname, '..', '..', 'data', 'fit');
        if (fs.existsSync(oldGpxDir) && !fs.existsSync(newFitDir)) {
          fs.renameSync(oldGpxDir, newFitDir);
          console.log('[SQLite/Migration] Renamed data/gpx folder to data/fit');
        }
      } catch (e) {
        console.error('[SQLite/Migration] Failed to rename data/gpx folder:', e.message);
      }

      // Migrate global config to user_config for account 1
      const uConfCount = await db.get('SELECT COUNT(*) as c FROM user_config');
      if (uConfCount.c === 0) {
        const oldConfs = await db.all('SELECT * FROM config');
        for (const row of oldConfs) {
          await db.run('INSERT INTO user_config (account_id, key, value) VALUES (1, ?, ?)', [row.key, row.value]);
        }
      }

      // Auto-enable ha_dong for legacy configurations
      await db.run(`UPDATE user_config SET value = value || ',ha_dong' WHERE key = 'selected_districts' AND value = 'hoan_kiem,hai_ba_trung,hoang_mai,dong_da,ba_dinh,thanh_xuan,cau_giay,tay_ho'`);

      if (configCount.c === 0) {
        if (fs.existsSync(OLD_JSON_DB)) {
          try {
            const oldDb = JSON.parse(fs.readFileSync(OLD_JSON_DB, 'utf-8'));
            if (oldDb.config) {
              for (const [k, v] of Object.entries({ ...DEFAULT_CONFIG, ...oldDb.config })) {
                await db.run('INSERT INTO config (key, value) VALUES (?, ?)', [k, String(v)]);
              }
            }
            if (oldDb.tokens && oldDb.tokens.access_token) {
              await db.run(`INSERT INTO users (access_token, refresh_token, expires_at, athlete_id, athlete_name, athlete_avatar, scope) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                [encryption.encrypt(oldDb.tokens.access_token), encryption.encrypt(oldDb.tokens.refresh_token), oldDb.tokens.expires_at, oldDb.tokens.athlete_id, oldDb.tokens.athlete_name, oldDb.tokens.athlete_avatar, oldDb.tokens.scope]);
            }
            if (oldDb.activities) {
              const acts = [...oldDb.activities].reverse();
              for (const a of acts) {
                await db.run(`INSERT INTO activities (id, created_at, activity_name, distance_km, duration_min, pace_min_km, fit_file, strava_activity_id, upload_status, error_message, route_start_lat, route_start_lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [a.id, a.created_at, a.activity_name, a.distance_km, a.duration_min, a.pace_min_km, a.fit_file, a.strava_activity_id, a.upload_status, a.error_message, a.route_start_lat, a.route_start_lng]);
              }
            }
            console.log('[SQLite] Migrated db.json to SQLite');
          } catch (e) {
            console.error('[SQLite] Migration failed', e);
          }
        } else {
          // Just seed default configs to account 1
          for (const [k, v] of Object.entries(DEFAULT_CONFIG)) {
            await db.run('INSERT OR IGNORE INTO user_config (account_id, key, value) VALUES (1, ?, ?)', [k, String(v)]);
          }
        }
      }

      // Seed Admin Account if empty
      const accountCount = await db.get('SELECT COUNT(*) as c FROM accounts');
      if (accountCount.c === 0 && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
        try {
          const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
          await db.run(
            'INSERT INTO accounts (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)',
            [process.env.ADMIN_USERNAME, hash, 'admin', new Date().toISOString()]
          );
          console.log('[SQLite] Seeded initial admin account from .env');
        } catch (e) {
          console.error('[SQLite] Failed to seed admin account', e);
        }
      }
      
      try {
        await db.exec('ALTER TABLE activities ADD COLUMN created_by TEXT');
        console.log('[SQLite] Added created_by column');
      } catch (e) {}

      // Migrate old prioritize_centers config key to start_near_favorite_place
      try {
        await db.run("UPDATE user_config SET key = 'start_near_favorite_place' WHERE key = 'prioritize_centers'");
      } catch (e) {
        console.error('[Migration] Failed to rename prioritize_centers key:', e.message);
      }

      // One-time initialization and district pre-computation for start_near_favorite_place
      try {
        const { getDistrictKeyForCoordinate } = require('../utils/geo');
        const accounts = await db.all('SELECT id FROM accounts');
        for (const account of accounts) {
          const accId = account.id;
          
          // Check if key exists
          const hasKey = await db.get(
            "SELECT 1 FROM user_config WHERE account_id = ? AND key = 'start_near_favorite_place'",
            [accId]
          );
          
          if (!hasKey) {
            // Set default to 'true'
            await db.run(
              "INSERT OR REPLACE INTO user_config (account_id, key, value) VALUES (?, 'start_near_favorite_place', 'true')",
              [accId]
            );
            console.log(`[Migration] Set default start_near_favorite_place=true for account ${accId}`);

            // Fetch and pre-calculate districts for existing activity_areas
            const areasRow = await db.get(
              "SELECT value FROM user_config WHERE account_id = ? AND key = 'activity_areas'",
              [accId]
            );
            if (areasRow && areasRow.value) {
              try {
                const areas = JSON.parse(areasRow.value);
                if (Array.isArray(areas) && areas.length > 0) {
                  let updated = false;
                  for (const area of areas) {
                    if (typeof area.lat === 'number' && typeof area.lng === 'number') {
                      const distKey = getDistrictKeyForCoordinate(area.lat, area.lng);
                      area.district = distKey || '';
                      updated = true;
                    }
                  }
                  if (updated) {
                    await db.run(
                      "UPDATE user_config SET value = ? WHERE account_id = ? AND key = 'activity_areas'",
                      [JSON.stringify(areas), accId]
                    );
                    console.log(`[Migration] Pre-computed districts for account ${accId} activity_areas`);
                  }
                }
              } catch (parseErr) {
                console.error(`[Migration] Error parsing activity_areas for account ${accId}:`, parseErr.message);
              }
            }
          }
        }
      } catch (err) {
        console.error('[Migration] Error running start_near_favorite_place initialization:', err.message);
      }



      dbInstance = db;
      return db;
    } catch (err) {
      dbPromise = null;
      throw err;
    }
  })();

  return dbPromise;
}

async function getConfig(accountId, key) {
  const db = await getDb();
  const row = await db.get('SELECT value FROM user_config WHERE account_id = ? AND key = ?', [accountId, key]);
  return row ? row.value : (DEFAULT_CONFIG[key] || null);
}

async function setConfig(accountId, key, value) {
  const db = await getDb();
  await db.run('INSERT OR REPLACE INTO user_config (account_id, key, value) VALUES (?, ?, ?)', [accountId, key, String(value)]);
}

async function resetConfig(accountId) {
  const db = await getDb();
  // Delete all config for this account except activity_areas (to preserve circles)
  await db.run('DELETE FROM user_config WHERE account_id = ? AND key != ?', [accountId, 'activity_areas']);
}

async function getAllConfig(accountId) {
  const db = await getDb();
  const rows = await db.all('SELECT key, value FROM user_config WHERE account_id = ?', [accountId]);
  const conf = { ...DEFAULT_CONFIG };
  for (const r of rows) conf[r.key] = r.value;
  return conf;
}

async function saveTokens(accountId, data) {
  const db = await getDb();
  await db.run('DELETE FROM users WHERE account_id = ?', [accountId]);
  await db.run(`INSERT INTO users (account_id, access_token, refresh_token, expires_at, athlete_id, athlete_name, athlete_avatar, scope) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    [accountId, encryption.encrypt(data.access_token), encryption.encrypt(data.refresh_token), data.expires_at, data.athlete_id, data.athlete_name, data.athlete_avatar, data.scope]);
}

async function getTokens(accountId) {
  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE account_id = ? ORDER BY id DESC LIMIT 1', [accountId]);
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

async function deleteTokens(accountId) {
  const db = await getDb();
  await db.run('DELETE FROM users WHERE account_id = ?', [accountId]);
}

async function saveActivity(accountId, data) {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.run(`INSERT INTO activities (account_id, created_at, activity_name, distance_km, duration_min, pace_min_km, fit_file, strava_activity_id, upload_status, error_message, route_start_lat, route_start_lng, route_start_time, district_keys, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [accountId, now, data.activity_name, data.distance_km, data.duration_min, data.pace_min_km, data.fit_file, data.strava_activity_id || null, data.upload_status || 'pending', data.error_message || null, data.route_start_lat, data.route_start_lng, data.route_start_time, data.district_keys, data.created_by]);
  return result.lastID;
}

async function updateActivity(accountId, id, data) {
  const db = await getDb();
  const sets = [];
  const vals = [];
  const ALLOWED_COLUMNS = [
    'activity_name', 'distance_km', 'duration_min', 'pace_min_km',
    'fit_file', 'strava_activity_id', 'upload_status', 'error_message',
    'route_start_lat', 'route_start_lng', 'route_start_time',
    'district_keys', 'deleted_at', 'created_by'
  ];
  for (const [k, v] of Object.entries(data)) {
    if (ALLOWED_COLUMNS.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (sets.length === 0) return;
  vals.push(id, accountId);
  await db.run(`UPDATE activities SET ${sets.join(', ')} WHERE id = ? AND account_id = ?`, vals);
}

async function getActivities(accountId, limit = 50, offset = 0) {
  const db = await getDb();
  // Include deleted activities for logging
  return await db.all(`SELECT * FROM activities WHERE account_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`, [accountId, limit, offset]);
}

async function getActivitiesByDate(accountId, dateStr) {
  const db = await getDb();
  // Fetch activities falling on this local date in UTC+7 (Asia/Ho_Chi_Minh)
  const startTimeUTC = new Date(`${dateStr}T00:00:00.000+07:00`).toISOString();
  const endTimeUTC = new Date(`${dateStr}T23:59:59.999+07:00`).toISOString();
  return await db.all(
    `SELECT * FROM activities 
     WHERE account_id = ? 
       AND route_start_time >= ? 
       AND route_start_time <= ?`, 
    [accountId, startTimeUTC, endTimeUTC]
  );
}

async function getLastUploadedActivity(accountId) {
  const db = await getDb();
  return await db.get(`SELECT * FROM activities WHERE account_id = ? AND upload_status IN ('uploaded', 'removed') ORDER BY id DESC LIMIT 1`, [accountId]);
}

async function deleteActivity(accountId, id, hard = false, status = 'deleted') {
  const db = await getDb();
  if (hard) {
    // Only use hard delete for cleanup if absolutely necessary, 
    // but per rules we should preserve logs.
    await db.run(`DELETE FROM activities WHERE id = ? AND account_id = ?`, [id, accountId]);
  } else {
    await db.run(`UPDATE activities SET upload_status = ?, deleted_at = ? WHERE id = ? AND account_id = ?`, [status, new Date().toISOString(), id, accountId]);
  }
  return true;
}

async function clearActivities(accountId) {
  const db = await getDb();
  await db.run('DELETE FROM activities WHERE account_id = ?', [accountId]);
  return true;
}

async function getActivityStats(accountId) {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10) + '%';
  
  // Total Activities: all events in DB regardless of status/deletion
  const total = (await db.get('SELECT COUNT(*) as c FROM activities WHERE account_id = ?', [accountId])).c;
  
  // Uploaded: activities strictly in 'uploaded' status
  const uploaded = (await db.get("SELECT COUNT(*) as c FROM activities WHERE account_id = ? AND upload_status = 'uploaded'", [accountId])).c;
  
  const failed = (await db.get("SELECT COUNT(*) as c FROM activities WHERE account_id = ? AND upload_status = 'failed'", [accountId])).c;
  
  // Sum distance and duration ONLY for 'uploaded' and 'generated' activities
  const sums = await db.get("SELECT SUM(distance_km) as dist, SUM(duration_min) as dur FROM activities WHERE account_id = ? AND upload_status IN ('uploaded', 'generated')", [accountId]);
  const todayCount = (await db.get('SELECT COUNT(*) as c FROM activities WHERE account_id = ? AND created_at LIKE ?', [accountId, today])).c;

  return {
    total,
    uploaded,
    failed,
    totalDistanceKm: Math.round((sums.dist || 0) * 10) / 10,
    totalDurationMin: Math.round(sums.dur || 0),
    todayCount,
  };
}

async function getUserByUsername(username) {
  const db = await getDb();
  return await db.get('SELECT * FROM accounts WHERE username = ?', [username]);
}

async function createAccount(username, plainPassword) {
  const db = await getDb();
  const hash = bcrypt.hashSync(plainPassword, 10);
  const res = await db.run(
    'INSERT INTO accounts (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)',
    [username, hash, 'normal', new Date().toISOString()]
  );
  
  // Seed default configs for new account
  for (const [k, v] of Object.entries(DEFAULT_CONFIG)) {
    await db.run('INSERT OR IGNORE INTO user_config (account_id, key, value) VALUES (?, ?, ?)', [res.lastID, k, String(v)]);
  }
  return res.lastID;
}

async function updateAccountPassword(accountId, plainPassword) {
  const db = await getDb();
  const hash = bcrypt.hashSync(plainPassword, 10);
  await db.run('UPDATE accounts SET password_hash = ? WHERE id = ?', [hash, accountId]);
  return true;
}

async function getAccountCount() {
  const db = await getDb();
  return (await db.get('SELECT COUNT(*) as c FROM accounts')).c;
}

async function getAllAccounts() {
  const db = await getDb();
  return await db.all('SELECT id, username, role, created_at FROM accounts');
}

async function getAccountRole(accountId) {
  const db = await getDb();
  const row = await db.get('SELECT role FROM accounts WHERE id = ?', [accountId]);
  return row ? row.role : 'normal';
}

async function activateVip(accountId, code) {
  const db = await getDb();
  const now = new Date().toISOString();
  
  // 1. Check if user is already VIP
  const user = await db.get('SELECT role FROM accounts WHERE id = ?', [accountId]);
  if (user && user.role === 'vip') {
    return { success: false, message: 'Your account is already VIP.' };
  }

  // 2. Check if code exists
  const row = await db.get("SELECT * FROM vip_codes WHERE code = ?", [code]);
  if (!row) {
    await db.run('INSERT INTO security_logs (account_id, action, created_at) VALUES (?, ?, ?)', [accountId, 'activate_vip_fail', now]);
    return { success: false, message: 'Invalid activation code.' };
  }

  // 3. Check if user already used THIS code (redundant due to UNIQUE constraint but good for UX)
  const usage = await db.get("SELECT id FROM vip_code_usage WHERE code = ? AND account_id = ?", [code, accountId]);
  if (usage) {
    return { success: false, message: 'You have already used this code.' };
  }

  // 4. Log usage and upgrade account
  try {
    await db.run("INSERT INTO vip_code_usage (code, account_id, activated_at) VALUES (?, ?, ?)", [code, accountId, now]);
    await db.run("UPDATE accounts SET role = 'vip' WHERE id = ?", [accountId]);
    return { success: true };
  } catch (err) {
    return { success: false, message: 'Activation failed: ' + err.message };
  }
}

async function checkBruteForce(accountId) {
  const db = await getDb();
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const row = await db.get("SELECT COUNT(*) as c FROM security_logs WHERE account_id = ? AND action = 'activate_vip_fail' AND created_at > ?", [accountId, oneHourAgo]);
  return row.c >= 5; // Max 5 fails per hour
}

async function saveExternalTokens(accountId, provider, tokens) {
  const db = await getDb();
  const encryptedAccess = encryption.encrypt(tokens.access_token);
  const encryptedRefresh = tokens.refresh_token ? encryption.encrypt(tokens.refresh_token) : null;
  
  await db.run(
    'INSERT OR REPLACE INTO external_tokens (account_id, provider, access_token, refresh_token, expires_at, scope) VALUES (?, ?, ?, ?, ?, ?)',
    [accountId, provider, encryptedAccess, encryptedRefresh, tokens.expires_at, tokens.scope]
  );
  return true;
}

async function getExternalTokens(accountId, provider) {
  const db = await getDb();
  const row = await db.get('SELECT * FROM external_tokens WHERE account_id = ? AND provider = ?', [accountId, provider]);
  if (!row) return null;
  
  return {
    access_token: encryption.decrypt(row.access_token),
    refresh_token: row.refresh_token ? encryption.decrypt(row.refresh_token) : null,
    expires_at: row.expires_at,
    scope: row.scope,
  };
}

async function deleteExternalTokens(accountId, provider) {
  const db = await getDb();
  await db.run('DELETE FROM external_tokens WHERE account_id = ? AND provider = ?', [accountId, provider]);
  return true;
}



module.exports = {
  getDb,
  getConfig, setConfig, getAllConfig,
  saveTokens, getTokens, deleteTokens,
  saveExternalTokens, getExternalTokens, deleteExternalTokens,
  saveActivity, updateActivity, getActivities, getActivitiesByDate, getLastUploadedActivity,
  getActivityStats, deleteActivity, clearActivities,
  getUserByUsername, createAccount, getAccountCount, getAllAccounts, updateAccountPassword,
  activateVip, checkBruteForce, getAccountRole, resetConfig,
};
