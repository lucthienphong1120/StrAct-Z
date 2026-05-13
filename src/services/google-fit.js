/**
 * Google Fit Service - Sync activities to Google Fit
 */

const db = require('../db/database');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

/**
 * Get Google OAuth2 Authorization URL
 */
function getAuthUrl() {
  const scopes = [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.activity.write',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.body.write',
    'https://www.googleapis.com/auth/fitness.location.read',
    'https://www.googleapis.com/auth/fitness.location.write',
    'profile',
    'email'
  ];
  
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent'
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCode(code) {
  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code'
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error_description || 'Failed to exchange Google code');
  }

  return await response.json();
}

/**
 * Refresh Google tokens if expired
 */
async function refreshTokens(userId) {
  const tokens = await db.getExternalTokens(userId, 'google_fit');
  if (!tokens || !tokens.refresh_token) throw new Error('No Google Fit refresh token available');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: tokens.refresh_token,
    grant_type: 'refresh_token'
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Google Fit tokens');
  }

  const data = await response.json();
  const newTokens = {
    ...tokens,
    access_token: data.access_token,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in
  };

  await db.saveExternalTokens(userId, 'google_fit', newTokens);
  return newTokens;
}

/**
 * Upload an activity session to Google Fit
 */
async function uploadActivity(userId, activity) {
  let tokens = await db.getExternalTokens(userId, 'google_fit');
  if (!tokens) return { success: false, error: 'Not connected to Google Fit' };

  // Check expiration (with 1-minute buffer)
  if (tokens.expires_at < (Date.now() / 1000) + 60) {
    tokens = await refreshTokens(userId);
  }

  const startTime = new Date(activity.route_start_time).getTime();
  const durationMs = activity.duration_min * 60 * 1000;
  const endTime = startTime + durationMs;
  const nanoStart = BigInt(startTime) * 1000000n;
  const nanoEnd = BigInt(endTime) * 1000000n;

  // Map Activity Type (8=Running, 7=Walking, 1=Biking)
  let activityType = 8; 
  if (activity.activity_type === 'Walk') activityType = 7;
  else if (activity.activity_type === 'Ride') activityType = 1;

  const totalSteps = Math.round(activity.distance_km * (activityType === 7 ? 1400 : 1250));

  // 1. Expanded Strategies (Naming, Package, Device)
  const strategies = [
    { name: 'StrActZ', package: 'com.stractz.sync', model: 'VirtualTracker', uid: 'manual_v1' },
    { name: 'StrAct-Z', package: 'com.stract_z.sync', model: 'StrAct-Z-Phone', uid: 'manual_v2' },
    { name: 'GoogleFitSync', package: 'com.google.android.apps.fitness', model: 'ManualInput', uid: 'manual_v3' }
  ];

  const results = [];

  for (const strategy of strategies) {
    try {
      console.log(`[Google Fit] Syncing Strategy: ${strategy.name}...`);
      
      // A. Create Data Sources (Including Activity Segment)
      const dsTypes = [
        { type: 'com.google.step_count.delta', field: 'steps', val: { intVal: totalSteps } },
        { type: 'com.google.distance.delta', field: 'distance', val: { fpVal: activity.distance_km * 1000 } },
        { type: 'com.google.activity.segment', field: 'activity', val: { intVal: activityType } }
      ];

      for (const ds of dsTypes) {
        const dsBody = {
          type: 'raw',
          application: { name: strategy.name, packageName: strategy.package },
          dataType: { 
            name: ds.type,
            field: [{ name: ds.field, format: ds.val.intVal !== undefined ? 'integer' : 'floatPoint' }]
          },
          device: { manufacturer: strategy.name, model: strategy.model, type: 'phone', uid: strategy.uid }
        };

        const dsRes = await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataSources`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(dsBody)
        });

        if (!dsRes.ok && dsRes.status !== 409) {
          console.error(`[Google Fit][${strategy.name}] Source Error:`, await dsRes.text());
          continue;
        }
        
        const dsData = await dsRes.json();
        const streamId = dsData.dataStreamId;

        // B. Patch Dataset
        const datasetId = `${nanoStart}-${nanoEnd}`;
        const patchRes = await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataSources/${streamId}/datasets/${datasetId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataSourceId: streamId,
            minStartTimeNs: nanoStart,
            maxEndTimeNs: nanoEnd,
            point: [{ startTimeNanos: nanoStart, endTimeNanos: nanoEnd, dataTypeName: ds.type, value: [ds.val] }]
          })
        });

        if (patchRes.ok) {
          console.log(`[Google Fit][${strategy.name}] ${ds.type} OK`);
        } else {
          console.error(`[Google Fit][${strategy.name}] ${ds.type} Fail:`, await patchRes.text());
        }
      }

      // C. Session Creation
      const sessionId = `stractz_${strategy.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${startTime}`;
      const sessionBody = {
        id: sessionId,
        name: `${activity.activity_name || 'Activity'}`,
        description: 'StrAct Z Generated',
        startTimeMillis: startTime,
        endTimeMillis: endTime,
        application: { name: strategy.name, packageName: strategy.package },
        activityType: activityType
      };

      const sessRes = await fetch(`https://www.googleapis.com/fitness/v1/users/me/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionBody)
      });

      if (sessRes.ok) {
        console.log(`[Google Fit][${strategy.name}] Session OK`);
        results.push({ strategy: strategy.name, success: true });
      } else {
        const errSess = await sessRes.text();
        console.warn(`[Google Fit][${strategy.name}] Session Fail:`, errSess);
        results.push({ strategy: strategy.name, success: false, error: errSess });
      }

    } catch (err) {
      console.error(`[Google Fit][${strategy.name}] Fatal:`, err.message);
      results.push({ strategy: strategy.name, success: false, error: err.message });
    }
  }

  return { success: results.some(r => r.success), steps: totalSteps, details: results };
}

async function deleteActivity(userId, activity) {
  const tokens = await db.getGoogleFitTokens(userId);
  if (!tokens) return;

  const nanoStart = BigInt(new Date(activity.route_start_time).getTime()) * 1000000n;
  const nanoEnd = nanoStart + BigInt(activity.duration || 0) * 1000000000n;
  const datasetId = `${nanoStart}-${nanoEnd}`;

  // 1. Delete Session
  const sessionId = `stractz_${activity.id}`;
  await fetch(`https://www.googleapis.com/fitness/v1/users/me/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });

  // 2. Discover and Delete Data Points from our streams
  const listRes = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });
  
  if (listRes.ok) {
    const listData = await listRes.json();
    const myStreams = listData.dataSource
      ? listData.dataSource
          .filter(ds => ds.dataStreamId.includes('StrActZ'))
          .map(ds => ds.dataStreamId)
      : [];

    for (const streamId of myStreams) {
      await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataSources/${streamId}/datasets/${datasetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
    }
  }

  return { success: true };
}
const statsCache = new Map(); // userId -> { data, expires }
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function getTodayStats(userId, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = statsCache.get(userId);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
  }

  let tokens = await db.getExternalTokens(userId, 'google_fit');
  if (!tokens) throw new Error('Not connected to Google Fit');

  if (tokens.expires_at < (Date.now() / 1000) + 60) {
    tokens = await refreshTokens(userId);
  }

  const now = new Date();
  // Ensure we get 00:00:00 in Asia/Ho_Chi_Minh regardless of server timezone
  const hanoiDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); 
  const startOfDay = new Date(`${hanoiDateStr}T00:00:00.000+07:00`).getTime();
  const endTime = now.getTime();

  // Query 1: Official/General Steps
  const officialBody = {
    aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
    bucketByTime: { durationMillis: (endTime - startOfDay) || 86400000 },
    startTimeMillis: startOfDay,
    endTimeMillis: endTime
  };

  // Query 2: Manual Sync Steps (Direct Dataset Query)
  const nanoStart = BigInt(startOfDay) * 1000000n;
  const nanoEnd = BigInt(endTime) * 1000000n;
  const datasetId = `${nanoStart}-${nanoEnd}`;
  
  // 1. Fetch all data sources to find our dynamic ID
  const listRes = await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataSources`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });

  let allSources = [];
  if (listRes.ok) {
    const listData = await listRes.json();
    allSources = listData.dataSource ? listData.dataSource.map(ds => ds.dataStreamId) : [];
    console.log('[Google Fit Discovery] All sources found:', allSources);
  }

  // 2. Discover all our manual streams (be flexible with naming)
  const manualStreams = allSources.filter(s => 
    s.includes('com.google.step_count.delta') && 
    (s.includes('StrActZ') || s.includes('StrAct Z') || s.includes('StrAct-Z') || s.includes('GoogleFitSync')) && 
    s.startsWith('raw:')
  );

  // 3. Query official data
  const officialRes = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(officialBody)
  });

  let googleTotal = 0;
  if (officialRes.ok) {
    const data = await officialRes.json();
    if (data.bucket && data.bucket[0] && data.bucket[0].dataset && data.bucket[0].dataset[0].point) {
      googleTotal = data.bucket[0].dataset[0].point.reduce((sum, p) => sum + (p.value[0].intVal || 0), 0);
    }
  }

  // 4. Query manual streams using AGGREGATE (more reliable than direct dataset fetch)
  let syncedSteps = 0;
  const manualDetails = [];

  for (const streamId of manualStreams) {
    try {
      const aggBody = {
        aggregateBy: [{ dataSourceId: streamId }],
        bucketByTime: { durationMillis: (endTime - startOfDay) || 86400000 },
        startTimeMillis: startOfDay,
        endTimeMillis: endTime
      };

      const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(aggBody)
      });

      if (res.ok) {
        const data = await res.json();
        let streamTotal = 0;
        if (data.bucket && data.bucket[0] && data.bucket[0].dataset && data.bucket[0].dataset[0].point) {
          streamTotal = data.bucket[0].dataset[0].point.reduce((sum, p) => sum + (p.value[0].intVal || 0), 0);
        }
        syncedSteps += streamTotal;
        manualDetails.push({ streamId, ok: true, steps: streamTotal });
      } else {
        manualDetails.push({ streamId, ok: false, status: res.status });
      }
    } catch (e) {
      manualDetails.push({ streamId, ok: false, error: e.message });
    }
  }

  // Queue Sync Logic:
  // Get all activities uploaded today from local DB to see what WE expect
  const localActs = await db.getActivitiesByDate(userId, hanoiDateStr);
  const uploadedToday = localActs.filter(a => a.upload_status === 'uploaded');
  const expectedSyncedSteps = uploadedToday.reduce((sum, a) => {
    const activityType = a.activity_type === 'Walk' ? 7 : (a.activity_type === 'Ride' ? 1 : 8);
    const estSteps = Math.round(a.distance_km * (activityType === 7 ? 1400 : 1250));
    return sum + estSteps;
  }, 0);

  // queueSteps is what we uploaded but Google Fit hasn't "seen" in the stream yet
  const queueSteps = Math.max(0, expectedSyncedSteps - syncedSteps);

  // Double-counting prevention logic:
  // isolatedDeviceSteps = Total from Google (which might be merged) - Our manual steps
  const isolatedDeviceSteps = Math.max(0, googleTotal - syncedSteps);

  const stats = {
    steps: isolatedDeviceSteps + syncedSteps,
    officialSteps: isolatedDeviceSteps,
    syncedSteps,
    queueSteps,
    lastSync: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }),
    timestamp: now.getTime(),
    debug: {
      queryDate: hanoiDateStr,
      localActCount: uploadedToday.length, // Only count uploaded for consistency
      localActIds: uploadedToday.map(a => a.id),
      manualCount: manualStreams.length,
      manualDetails,
      googleTotal,
      expectedSyncedSteps,
      allSources // Restored like v1.50.49/50
    }
  };

  console.log('[Google Fit Debug]', stats);

  statsCache.set(userId, { data: stats, expires: Date.now() + CACHE_TTL_MS });

  return stats;
}

async function disconnect(userId) {
  try {
    const tokens = await db.getExternalTokens(userId, 'google_fit');
    if (tokens && (tokens.access_token || tokens.refresh_token)) {
      const token = tokens.refresh_token || tokens.access_token;
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
    }
  } catch (err) {
    console.error('[Google Fit] Revoke failed:', err.message);
  } finally {
    await db.deleteExternalTokens(userId, 'google_fit');
  }
}

function clearCache(userId) {
  statsCache.delete(userId);
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  refreshTokens,
  uploadActivity,
  getTodayStats,
  clearCache,
  disconnect
};
