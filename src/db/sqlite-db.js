const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
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
  max_distance_km: '8',
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
  selected_districts: 'hoan_kiem,hai_ba_trung,hoang_mai,dong_da,ba_dinh,thanh_xuan,cau_giay,tay_ho,ha_dong',
  activity_type: 'Random',
  variation_enabled: 'true',
  heart_rate_enabled: 'true',
  min_heart_rate: '80',
  max_heart_rate: '160',
  use_osrm: 'true',
  schedule_count_min: '1',
  schedule_count_max: '2',
  activity_areas: '[]',
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
  const configCount = await dbInstance.get('SELECT COUNT(*) as c FROM config');
  
  // Seed default VIP code
  try {
    await dbInstance.run("INSERT OR IGNORE INTO vip_codes (code, status) VALUES (?, ?)", ['CRF@2026', 'available']);
  } catch (e) {}

  try {
    await dbInstance.exec('ALTER TABLE activities ADD COLUMN route_start_time TEXT');
    console.log('[SQLite] Added route_start_time column');
  } catch (e) {}

  try {
    await dbInstance.exec('ALTER TABLE activities ADD COLUMN district_keys TEXT');
    console.log('[SQLite] Added district_keys column');
  } catch (e) {}

  try {
    await dbInstance.exec('ALTER TABLE activities ADD COLUMN account_id INTEGER DEFAULT 1');
    console.log('[SQLite] Added account_id to activities');
  } catch (e) {}

  try {
    await dbInstance.exec('ALTER TABLE users ADD COLUMN account_id INTEGER DEFAULT 1');
    console.log('[SQLite] Added account_id to users');
  } catch (e) {}

  // Migrate global config to user_config for account 1
  const uConfCount = await dbInstance.get('SELECT COUNT(*) as c FROM user_config');
  if (uConfCount.c === 0) {
    const oldConfs = await dbInstance.all('SELECT * FROM config');
    for (const row of oldConfs) {
      await dbInstance.run('INSERT INTO user_config (account_id, key, value) VALUES (1, ?, ?)', [row.key, row.value]);
    }
  }

  // Auto-enable ha_dong for legacy configurations
  await dbInstance.run(`UPDATE user_config SET value = value || ',ha_dong' WHERE key = 'selected_districts' AND value = 'hoan_kiem,hai_ba_trung,hoang_mai,dong_da,ba_dinh,thanh_xuan,cau_giay,tay_ho'`);

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
      // Just seed default configs to account 1
      for (const [k, v] of Object.entries(DEFAULT_CONFIG)) {
        await dbInstance.run('INSERT OR IGNORE INTO user_config (account_id, key, value) VALUES (1, ?, ?)', [k, String(v)]);
      }
    }
  }

  // Seed Admin Account if empty
  const accountCount = await dbInstance.get('SELECT COUNT(*) as c FROM accounts');
  if (accountCount.c === 0 && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    try {
      const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
      await dbInstance.run(
        'INSERT INTO accounts (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)',
        [process.env.ADMIN_USERNAME, hash, 'admin', new Date().toISOString()]
      );
      console.log('[SQLite] Seeded initial admin account from .env');
    } catch (e) {
      console.error('[SQLite] Failed to seed admin account', e);
    }
  }
  
  return dbInstance;
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
  const res = await db.run(`INSERT INTO activities (account_id, created_at, activity_name, distance_km, duration_min, pace_min_km, gpx_file, strava_activity_id, upload_status, error_message, route_start_lat, route_start_lng, route_start_time, district_keys) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [accountId, new Date().toISOString(), data.activity_name, data.distance_km, data.duration_min, data.pace_min_km, data.gpx_file, data.strava_activity_id || null, data.upload_status || 'pending', null, data.route_start_lat, data.route_start_lng, data.route_start_time || null, data.district_keys || null]);
  return res.lastID;
}

async function updateActivity(accountId, id, data) {
  const db = await getDb();
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(data)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) return;
  vals.push(id, accountId);
  await db.run(`UPDATE activities SET ${sets.join(', ')} WHERE id = ? AND account_id = ?`, vals);
}

async function getActivities(accountId, limit = 50) {
  const db = await getDb();
  return await db.all(`SELECT * FROM activities WHERE account_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT ?`, [accountId, limit]);
}

async function deleteActivity(accountId, id, hard = false) {
  const db = await getDb();
  if (hard) {
    await db.run(`DELETE FROM activities WHERE id = ? AND account_id = ?`, [id, accountId]);
  } else {
    await db.run(`UPDATE activities SET upload_status = 'deleted', deleted_at = ? WHERE id = ? AND account_id = ?`, [new Date().toISOString(), id, accountId]);
  }
  return true;
}

async function getActivityStats(accountId) {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10) + '%';
  const total = (await db.get('SELECT COUNT(*) as c FROM activities WHERE account_id = ? AND deleted_at IS NULL', [accountId])).c;
  const uploaded = (await db.get("SELECT COUNT(*) as c FROM activities WHERE account_id = ? AND upload_status = 'uploaded' AND deleted_at IS NULL", [accountId])).c;
  const failed = (await db.get("SELECT COUNT(*) as c FROM activities WHERE account_id = ? AND upload_status = 'failed' AND deleted_at IS NULL", [accountId])).c;
  const sums = await db.get("SELECT SUM(distance_km) as dist, SUM(duration_min) as dur FROM activities WHERE account_id = ? AND upload_status = 'uploaded' AND deleted_at IS NULL", [accountId]);
  const todayCount = (await db.get('SELECT COUNT(*) as c FROM activities WHERE account_id = ? AND created_at LIKE ? AND deleted_at IS NULL', [accountId, today])).c;

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

module.exports = {
  getDb,
  getConfig, setConfig, getAllConfig,
  saveTokens, getTokens, deleteTokens,
  saveActivity, updateActivity, getActivities,
  getActivityStats, deleteActivity,
  getUserByUsername, createAccount, getAccountCount, getAllAccounts, updateAccountPassword,
  activateVip, checkBruteForce,
};
