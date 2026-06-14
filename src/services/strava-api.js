/**
 * Strava API Client - Handles OAuth2 authentication and activity uploads
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FormData = require('form-data');
const db = require('../db/database');

const STRAVA_BASE_URL = 'www.strava.com';

// ─── Caching Layer ──────────────────────────────────────────────────────────
const activityCache = new Map(); // accountId-page-perPage-after -> { data, expires }
const userRecentActivities = new Map(); // accountId -> { data: Array, fetchedAt: number }
const CENTRAL_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function clearActivityCache(accountId) {
  userRecentActivities.delete(accountId);
  for (const key of activityCache.keys()) {
    if (key.startsWith(`${accountId}-`)) {
      activityCache.delete(key);
    }
  }
}

async function syncLocalActivitiesWithStrava(userId, stravaActivities) {
  try {
    if (!Array.isArray(stravaActivities) || stravaActivities.length === 0) return;

    // Find the oldest start date in the retrieved activities
    const sorted = [...stravaActivities].sort((a, b) => new Date(a.start_date || a.start_date_local) - new Date(b.start_date || b.start_date_local));
    const oldestStartDateStr = sorted[0].start_date || sorted[0].start_date_local;
    if (!oldestStartDateStr) return;

    const oldestTime = new Date(oldestStartDateStr).getTime();

    // Get all local activities
    const localActivities = await db.getActivities(userId, 1000).catch(() => []);
    const stravaIds = new Set(stravaActivities.map(a => String(a.id)));

    for (const a of localActivities) {
      if ((a.upload_status === 'uploaded' || a.strava_activity_id) && a.upload_status !== 'removed') {
        const aTime = new Date(a.route_start_time || a.created_at).getTime();
        // Check only local activities within the timeframe of fetched activities (with 24h timezone buffer)
        if (aTime >= oldestTime - 24 * 60 * 60 * 1000) {
          const stravaIdStr = String(a.strava_activity_id);
          if (!stravaIds.has(stravaIdStr)) {
            console.log(`[Central Sync] Activity ${a.id} (Strava ID: ${a.strava_activity_id}) not found on Strava. Marking as 'removed'.`);
            await db.deleteActivity(userId, a.id, false, 'removed').catch(() => { });
            a.upload_status = 'removed';
          } else {
            // Found on Strava - verify and sync any fields that differ (like timezone adjustments or user edits on Strava)
            const match = stravaActivities.find(s => String(s.id) === stravaIdStr);
            if (match) {
              const stravaStartTime = match.start_date || match.start_date_local;
              const stravaDistanceKm = Math.round((match.distance / 1000) * 10) / 10;
              const stravaDurationMin = Math.round(((match.moving_time || match.elapsed_time) / 60) * 10) / 10;
              
              let needsUpdate = false;
              const updates = {};
              
              if (stravaStartTime && a.route_start_time !== stravaStartTime) {
                updates.route_start_time = stravaStartTime;
                needsUpdate = true;
              }
              if (match.name && a.activity_name !== match.name) {
                updates.activity_name = match.name;
                needsUpdate = true;
              }
              if (stravaDistanceKm > 0 && Math.abs((a.distance_km || 0) - stravaDistanceKm) > 0.15) {
                updates.distance_km = stravaDistanceKm;
                needsUpdate = true;
              }
              if (stravaDurationMin > 0 && Math.abs((a.duration_min || 0) - stravaDurationMin) > 1.5) {
                updates.duration_min = stravaDurationMin;
                needsUpdate = true;
              }
              
              if (needsUpdate) {
                console.log(`[Central Sync] Updating local activity ${a.id} to match Strava data:`, updates);
                await db.updateActivity(userId, a.id, updates).catch(err => {
                  console.error(`[Central Sync] Failed to update local activity ${a.id}:`, err);
                });
                Object.assign(a, updates);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[Central Sync] Error syncing local activities with Strava:', err);
  }
}

// Custom HTTPS agent
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Make HTTPS request (promise-based)
 */
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request({ ...options, agent: httpsAgent }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // Track Rate Limits
        const usageHeader = res.headers['x-ratelimit-usage'];
        const limitHeader = res.headers['x-ratelimit-limit'];
        if (usageHeader && limitHeader) {
          const usage = usageHeader.split(',').map(Number);
          const limit = limitHeader.split(',').map(Number);
          global.stravaRateLimit = { usage, limit, timestamp: Date.now() };
        }

        if (res.statusCode >= 400) {
          let errBody = {};
          try { errBody = JSON.parse(data); } catch (e) {}
          const err = new Error(`HTTP Error ${res.statusCode}: ${errBody.message || 'Request failed'}`);
          err.statusCode = res.statusCode;
          err.body = errBody;
          reject(err);
        } else {
          let parsed = data;
          try { parsed = JSON.parse(data); } catch (e) {}
          resolve(parsed);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Strava API request timeout (15s)'));
    });
    if (postData) {
      if (typeof postData === 'string') {
        req.write(postData);
        req.end();
      } else if (postData.pipe) {
        postData.pipe(req);
      } else {
        req.write(postData);
        req.end();
      }
    } else {
      req.end();
    }
  });
}

/**
 * Get OAuth authorization URL
 */
function getAuthUrl(accountId) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = `${process.env.BASE_URL}/auth/callback`;
  const scope = 'activity:write,activity:read_all,read';
  const stateQuery = accountId ? `&state=${accountId}` : '';

  return `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&approval_prompt=force${stateQuery}`;
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCode(accountId, code) {
  const postData = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    code: code,
    grant_type: 'authorization_code',
  }).toString();

  const options = {
    hostname: STRAVA_BASE_URL,
    path: '/api/v3/oauth/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const response = await makeRequest(options, postData);

  // Save tokens to database
  await db.saveTokens(accountId, {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: response.expires_at,
    athlete_id: response.athlete?.id,
    athlete_name: `${response.athlete?.firstname || ''} ${response.athlete?.lastname || ''}`.trim(),
    athlete_avatar: response.athlete?.profile,
    scope: response.scope || '',
  });

  return response;
}

/**
 * Refresh access token if expired
 */
async function refreshToken(accountId) {
  const tokens = await db.getTokens(accountId);
  if (!tokens) {
    throw new Error('No tokens found. Please authenticate first.');
  }

  // Check if token is still valid (with 5 min buffer)
  const now = Math.floor(Date.now() / 1000);
  if (tokens.expires_at && tokens.expires_at > now + 300) {
    return tokens.access_token;
  }

  console.log('[Strava] Refreshing access token...');

  const postData = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
  }).toString();

  const options = {
    hostname: STRAVA_BASE_URL,
    path: '/api/v3/oauth/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const response = await makeRequest(options, postData);

  // Update tokens in database
  await db.saveTokens(accountId, {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: response.expires_at,
    athlete_id: tokens.athlete_id,
    athlete_name: tokens.athlete_name,
    athlete_avatar: tokens.athlete_avatar,
    scope: tokens.scope,
  });

  return response.access_token;
}

async function uploadActivity(accountId, fitFilepath, options = {}) {
  const {
    name = 'Morning Run',
    description = '',
    sportType = 'Run',
  } = options;

  const accessToken = await refreshToken(accountId);

  const form = new FormData();
  form.append('file', fs.createReadStream(fitFilepath));
  
  const ext = path.extname(fitFilepath).toLowerCase().replace('.', '');
  const dataType = ext === 'gpx' ? 'gpx' : 'fit';
  form.append('data_type', dataType);
  form.append('name', name);
  form.append('description', description);
  form.append('sport_type', sportType);
  
  // Use a Zepp-like format for external_id
  const externalId = `stripped_${crypto.randomUUID()}-activity.${ext}`;
  form.append('external_id', externalId);

  const requestOptions = {
    hostname: STRAVA_BASE_URL,
    path: '/api/v3/uploads',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      ...form.getHeaders(),
    },
  };

  clearActivityCache(accountId);

  return new Promise((resolve, reject) => {
    const req = https.request({ ...requestOptions, agent: httpsAgent }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject({ status: res.statusCode, body: json });
          } else {
            resolve(json);
          }
        } catch (e) {
          reject({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Strava upload timeout (60s)'));
    });
    form.pipe(req);
  });
}


/**
 * Check upload status
 */
async function checkUploadStatus(accountId, uploadId) {
  const accessToken = await refreshToken(accountId);

  const options = {
    hostname: STRAVA_BASE_URL,
    path: `/api/v3/uploads/${uploadId}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  };

  return makeRequest(options);
}

/**
 * Wait for upload to complete (polling)
 */
async function waitForUpload(accountId, uploadId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between polls
    try {
      const status = await checkUploadStatus(accountId, uploadId);
      if (status.activity_id) {
        return status;
      }
      if (status.error) {
        throw new Error(status.error);
      }
    } catch (err) {
      if (err.message) throw err;
      throw new Error(`Upload check failed: ${JSON.stringify(err)}`);
    }
  }
  throw new Error('Upload timed out');
}

/**
 * Get authenticated athlete info
 */
async function getAthlete(accountId) {
  const accessToken = await refreshToken(accountId);
  const options = {
    hostname: STRAVA_BASE_URL,
    path: '/api/v3/athlete',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  };
  return makeRequest(options);
}

/**
 * Check if authenticated
 */
async function isAuthenticated(accountId) {
  const tokens = await db.getTokens(accountId);
  return tokens && tokens.access_token ? true : false;
}

/**
 * Delete a Strava activity by its activity ID
 */
async function deleteActivity(accountId, stravaActivityId) {
  const accessToken = await refreshToken(accountId);
  const options = {
    hostname: STRAVA_BASE_URL,
    path: `/api/v3/activities/${stravaActivityId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  };
  
  clearActivityCache(accountId);

  return new Promise((resolve, reject) => {
    const req = https.request({ ...options, agent: httpsAgent }, (res) => {
      if (res.statusCode === 204) { resolve({ success: true }); }
      else {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => reject({ status: res.statusCode, body: data }));
      }
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Update a Strava activity
 */
async function updateActivity(accountId, activityId, params) {
  const accessToken = await refreshToken(accountId);
  const postData = JSON.stringify(params);

  const options = {
    hostname: STRAVA_BASE_URL,
    path: `/api/v3/activities/${activityId}`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  clearActivityCache(accountId);
  return makeRequest(options, postData);
}

/**
 * Disconnect / deauthorize
 */
async function disconnect(accountId) {
  try {
    const tokens = await db.getTokens(accountId);
    if (tokens && tokens.access_token) {
      // Refresh token first to ensure deauthorize call works
      let accessToken;
      try {
        accessToken = await refreshToken(accountId);
      } catch (e) {
        // If refresh fails, try with current access token as last resort
        accessToken = tokens.access_token;
      }

      const postData = new URLSearchParams({
        access_token: accessToken,
      }).toString();

      const options = {
        hostname: STRAVA_BASE_URL,
        path: '/oauth/deauthorize',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      console.log(`[Strava] Deauthorizing account ${accountId}...`);
      await makeRequest(options, postData);
    }
  } catch (err) {
    console.error('[Strava] Deauthorize failed:', err.body || err.message);
    // Even if deauthorize fails, we still proceed to delete from local DB
  } finally {
    await db.deleteTokens(accountId);
    clearActivityCache(accountId);
  }
}

/**
 * Get athlete's past activities
 */
async function getActivities(accountId, page = 1, perPage = 30, after = null, forceRefresh = false) {
  if (forceRefresh) {
    clearActivityCache(accountId);
  }

  const cached = userRecentActivities.get(accountId);
  const isCacheValid = cached && (Date.now() - cached.fetchedAt < CENTRAL_CACHE_TTL_MS);

  if (!forceRefresh && isCacheValid) {
    const startIdx = (page - 1) * perPage;
    if (startIdx < cached.data.length) {
      console.log(`[Strava API Cache] Serving page ${page}, perPage ${perPage} for user ${accountId} from centralized cache.`);
      let filtered = cached.data;
      if (after) {
        filtered = filtered.filter(a => {
          const startTime = Math.floor(new Date(a.start_date || a.start_date_local).getTime() / 1000);
          return startTime >= after;
        });
      }
      return filtered.slice(startIdx, startIdx + perPage);
    }
  }

  const fetchPage = 1;
  const fetchPerPage = (page === 1 && perPage > 50) ? perPage : 50;

  console.log(`[Strava API Cache] Fetching page ${fetchPage}, perPage ${fetchPerPage} from Strava for user ${accountId}.`);
  const token = await refreshToken(accountId);
  
  const reqPath = `/api/v3/athlete/activities?page=${fetchPage}&per_page=${fetchPerPage}`;
  const options = {
    hostname: STRAVA_BASE_URL,
    path: reqPath,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = await makeRequest(options);
  if (response.errors) {
    throw new Error(response.message || 'Failed to fetch activities');
  }

  if (Array.isArray(response)) {
    userRecentActivities.set(accountId, {
      data: response,
      fetchedAt: Date.now()
    });

    await syncLocalActivitiesWithStrava(accountId, response).catch(err => {
      console.error('[Central Sync] Error running sync:', err);
    });
  }

  let filtered = response;
  if (after) {
    filtered = filtered.filter(a => {
      const startTime = Math.floor(new Date(a.start_date || a.start_date_local).getTime() / 1000);
      return startTime >= after;
    });
  }
  const startIdx = (page - 1) * perPage;
  return filtered.slice(startIdx, startIdx + perPage);
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  getActivities,
  clearActivityCache,
  uploadActivity,
  checkUploadStatus,
  waitForUpload,
  getAthlete,
  isAuthenticated,
  deleteActivity,
  disconnect,
  updateActivity,
};
