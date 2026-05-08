/**
 * Strava API Client - Handles OAuth2 authentication and activity uploads
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const db = require('../db/database');

const STRAVA_BASE_URL = 'www.strava.com';

// Bypass SSL cert verification (common issue on Windows with corporate CA certs)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
          if ((limit[0] > 0 && usage[0] >= limit[0] * 0.95) || (limit[1] > 0 && usage[1] >= limit[1] * 0.95)) {
            console.warn(`[Strava API] WARNING: Approaching rate limit (${usage.join(',')}/${limit.join(',')})`);
          }
        }

        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            if (res.statusCode === 429) {
              reject({ status: 429, body: { error: 'Rate limit exceeded', message: 'Strava API limit reached. Try again in 15 minutes.' } });
            } else {
              reject({ status: res.statusCode, body: json });
            }
          } else {
            resolve(json);
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            if (res.statusCode === 429) {
              reject({ status: 429, body: { error: 'Rate limit exceeded', message: 'Strava API limit reached.' } });
            } else {
              reject({ status: res.statusCode, body: data });
            }
          } else {
            resolve(data);
          }
        }
      });
    });
    req.on('error', reject);
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
function getAuthUrl() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = `${process.env.BASE_URL}/auth/callback`;
  const scope = 'activity:write,activity:read_all,read';

  return `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&approval_prompt=force`;
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCode(code) {
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
  await db.saveTokens({
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
async function refreshToken() {
  const tokens = await db.getTokens();
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
  await db.saveTokens({
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

/**
 * Upload GPX file to Strava
 */
async function uploadActivity(gpxFilepath, options = {}) {
  const {
    name = 'Morning Run',
    description = '',
    sportType = 'Run',
  } = options;

  const accessToken = await refreshToken();

  const form = new FormData();
  form.append('file', fs.createReadStream(gpxFilepath));
  form.append('data_type', 'gpx');
  form.append('name', name);
  form.append('description', description);
  form.append('sport_type', sportType);
  form.append('external_id', `auto_${Date.now()}`);

  const requestOptions = {
    hostname: STRAVA_BASE_URL,
    path: '/api/v3/uploads',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      ...form.getHeaders(),
    },
  };

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
    form.pipe(req);
  });
}

/**
 * Check upload status
 */
async function checkUploadStatus(uploadId) {
  const accessToken = await refreshToken();

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
async function waitForUpload(uploadId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between polls
    try {
      const status = await checkUploadStatus(uploadId);
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
async function getAthlete() {
  const accessToken = await refreshToken();
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
async function isAuthenticated() {
  const tokens = await db.getTokens();
  return tokens && tokens.access_token ? true : false;
}

/**
 * Delete a Strava activity by its activity ID
 */
async function deleteActivity(stravaActivityId) {
  const accessToken = await refreshToken();
  const options = {
    hostname: STRAVA_BASE_URL,
    path: `/api/v3/activities/${stravaActivityId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  };
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
 * Disconnect / deauthorize
 */
async function disconnect() {
  try {
    const tokens = await db.getTokens();
    if (tokens && tokens.access_token) {
      const postData = new URLSearchParams({
        access_token: tokens.access_token,
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

      await makeRequest(options, postData).catch(() => {});
    }
  } finally {
    await db.deleteTokens();
  }
}

/**
 * Get athlete's past activities
 */
async function getActivities(page = 1, perPage = 30, after = null) {
  const token = await refreshToken();
  
  let reqPath = `/api/v3/athlete/activities?page=${page}&per_page=${perPage}`;
  if (after) {
    reqPath += `&after=${after}`;
  }

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
  return response;
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  refreshToken,
  uploadActivity,
  checkUploadStatus,
  waitForUpload,
  getAthlete,
  isAuthenticated,
  deleteActivity,
  disconnect,
  getActivities,
};
