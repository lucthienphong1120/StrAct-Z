/**
 * API Routes - Config, activities, scheduler, district management
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const scheduler = require('../services/scheduler');
const fitGenerator = require('../services/fit-generator');
const gpxGenerator = require('../services/gpx-generator');
const stravaApi = require('../services/strava-api');
const googleFit = require('../services/google-fit');
const systemLimits = require('../config/limits');
const { buildGeneratorConfig } = require('../utils/activity-config-builder');

const { DISTRICTS } = require('../config/districts');


// ─── Districts ──────────────────────────────────────────────────────────────

router.get('/districts', (req, res) => {
  res.json(DISTRICTS);
});

// ─── System / Version ───────────────────────────────────────────────────────
router.get('/version', (req, res) => {
  try {
    const pkg = require('../../package.json');
    res.json({ version: pkg.version });
  } catch (e) {
    res.json({ version: 'unknown' });
  }
});

// ─── Configuration ──────────────────────────────────────────────────────────

router.get('/config', async (req, res) => {
  try {
    res.json(await db.getAllConfig(req.user.id));
  } catch (err) {
    console.error(`[Config API] Error getting config for user ${req.user?.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// System limits endpoint moved below to avoid duplication

const { validateConfig } = require('../utils/validation');

router.post('/config', async (req, res) => {
  try {
    const updates = req.body;
    const role = req.user.role || 'basic';

    const validation = validateConfig(updates, role);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    for (const [key, value] of Object.entries(validation.sanitized)) {
      await db.setConfig(req.user.id, key, value);
    }
    res.json({ success: true, config: await db.getAllConfig(req.user.id) });
  } catch (err) {
    console.error(`[Config API] Error saving config for user ${req.user?.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/config/reset', async (req, res) => {
  try {
    await db.resetConfig(req.user.id);
    stravaApi.clearActivityCache(req.user.id);
    googleFit.clearCache(req.user.id);
    res.json({ success: true, message: 'Configuration reset to defaults (Map areas & history preserved)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/system-limits', (req, res) => {
  const role = req.user.role || 'basic';
  res.json(systemLimits.getLimits(role));
});

// ─── Google Fit Auth ────────────────────────────────────────────────────────

router.get('/auth/google', (req, res) => {
  res.redirect(googleFit.getAuthUrl());
});

router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) throw new Error('No code provided');
    const tokens = await googleFit.exchangeCode(code);
    await db.saveExternalTokens(req.user.id, 'google_fit', {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
      scope: tokens.scope
    });
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google Fit Connected</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: white; text-align: center; }
          .icon { font-size: 48px; margin-bottom: 20px; }
          .btn { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="icon">✅</div>
        <h2>Google Fit Connected!</h2>
        <p>You can close this window now.</p>
        <button class="btn" onclick="window.close()">Close Window</button>
        <script>
          // Notify other windows/tabs via BroadcastChannel (Most reliable)
          try {
            const bc = new BroadcastChannel('stract_z_auth');
            bc.postMessage('google_fit_connected');
          } catch (e) { console.error('BC Error:', e); }

          // Legacy notification via opener postMessage
          if (window.opener) {
            try {
              window.opener.postMessage('google_fit_connected', '*');
            } catch (e) { console.error('Opener Error:', e); }
          }
          
          // If this is a popup, just close it after notifying
          if (window.opener && window.opener !== window) {
            setTimeout(() => { window.close(); }, 1500);
          } else {
            // If it's NOT a popup (direct navigation), redirect to home
            setTimeout(() => { window.location.href = '/?success=google_fit_connected'; }, 1500);
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`Auth Error: ${err.message}`);
  }
});

router.delete('/auth/google', async (req, res) => {
  await googleFit.disconnect(req.user.id);
  res.json({ success: true });
});

router.get('/google-fit/stats', async (req, res) => {
  try {
    const refresh = req.query.refresh === 'true';
    const stats = await googleFit.getTodayStats(req.user.id, refresh);
    res.json(stats);
  } catch (err) {
    console.error(`[Google Fit] Error getting stats for user ${req.user.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Stats ──────────────────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getActivityStats(req.user.id);
    const scheduleStatus = await scheduler.getStatus(req.user.id);
    const tokens = await db.getTokens(req.user.id);
    const gfTokens = await db.getExternalTokens(req.user.id, 'google_fit');
    res.json({
      ...stats,
      role: req.user.role,
      schedule: scheduleStatus,
      authenticated: !!(tokens && tokens.access_token),
      athleteName: tokens?.athlete_name || null,
      athleteAvatar: tokens?.athlete_avatar || null,
      googleFitConnected: !!(gfTokens && gfTokens.access_token),
    });
  } catch (err) {
    console.error(`[Stats API] Error getting stats for user ${req.user?.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/insights', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 14;
    const now = new Date();
    // 2 days buffer to handle timezones and late night uploads safely
    const after = Math.floor((now.getTime() - (days + 2) * 24 * 60 * 60 * 1000) / 1000);

    const forceRefresh = req.query.refresh === 'true';
    const activities = await stravaApi.getActivities(req.user.id, 1, 200, after, forceRefresh);

    if (forceRefresh) {
      console.log(`[Cloud Sync] Refreshed insights for user ${req.user.id}. Found ${activities.length} acts since ${new Date(after * 1000).toISOString()}`);
    }

    // Enrich activities with is_stract_z flag
    const localActivities = await db.getActivities(req.user.id, 1000).catch(() => []);
    const localStravaIds = new Set(
      localActivities
        .filter(a => a.strava_activity_id)
        .map(a => String(a.strava_activity_id))
    );

    const enrichedActivities = activities.map(a => {
      const isStrActZ = (a.external_id && (a.external_id.startsWith('stract-z') || a.external_id.includes('stract-z'))) ||
        localStravaIds.has(String(a.id));
      return {
        ...a,
        is_stract_z: !!isStrActZ
      };
    });

    res.json(enrichedActivities);
  } catch (err) {
    console.error(`[Insights] Error getting insights for user ${req.user.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Activities ─────────────────────────────────────────────────────────────

router.get('/activities', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const all = await db.getActivities(req.user.id, limit, offset);
    res.json(all);
  } catch (err) {
    console.error(`[Activities API] Error getting activities for user ${req.user?.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/strava-activities', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;
    const after = req.query.after ? parseInt(req.query.after) : null;
    const forceRefresh = req.query.refresh === 'true';

    // Fetch WITHOUT 'after' to ensure Strava returns results in reverse-chronological order.
    // If 'after' is provided to the Strava API, it defaults to chronological (oldest first).
    let activities = await stravaApi.getActivities(req.user.id, page, perPage, null, forceRefresh);

    // Filter by 'after' locally if needed
    if (after) {
      activities = activities.filter(a => {
        const startTime = Math.floor(new Date(a.start_date).getTime() / 1000);
        return startTime >= after;
      });
    }

    // Always sort descending (latest first)
    activities.sort((a, b) => new Date(b.start_date || b.start_date_local) - new Date(a.start_date || a.start_date_local));

    if (forceRefresh || page === 1) {
      console.log(`[Strava API] User ${req.user.id} fetched ${activities.length} acts (Page ${page}, After: ${after})`);
      if (activities.length > 0) {
        console.log(`[Strava API] Newest act: ${activities[0].name} (${activities[0].start_date})`);
      }
    }

    res.json(activities);
  } catch (err) {
    console.error(`[Strava API] Error getting activities for user ${req.user.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});



// Generate FIT only (no upload)
router.post('/generate', async (req, res) => {
  try {
    const ov = req.body || {};
    const validation = validateConfig(ov, req.user.role || 'basic');
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    const config = await db.getAllConfig(req.user.id);

    const targetDate = ov.target_date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    let localActivities = await db.getActivitiesByDate(req.user.id, targetDate);
    let stravaActivities = [];
    if (await stravaApi.isAuthenticated(req.user.id)) {
      try {
        const after = Math.floor(new Date(`${targetDate}T00:00:00.000+07:00`).getTime() / 1000) - 1;
        stravaActivities = await stravaApi.getActivities(req.user.id, 1, 50, after, false);
        stravaActivities = stravaActivities.filter(a => (a.start_date_local || a.start_date).startsWith(targetDate));
        // Re-read local activities after getActivities automatically synced them
        localActivities = await db.getActivitiesByDate(req.user.id, targetDate);
      } catch (e) { console.warn('Strava fetch failed for overlap check'); }
    }

    const lastUploaded = await db.getLastUploadedActivity(req.user.id);
    const genConfig = buildGeneratorConfig(config, { ...ov, target_date: targetDate }, lastUploaded, req.user.role || 'basic');
    genConfig.existingActivities = [...localActivities, ...stravaActivities];
    genConfig.isManual = true;
    let format = ov.export_format || config.export_format || 'fit';
    const deviceNameForFormat = ov.device_name || config.device_name || systemLimits.device_name.default;
    if (gpxGenerator.shouldForceGPX(deviceNameForFormat)) format = 'gpx';
    const generator = format === 'gpx' ? gpxGenerator : fitGenerator;
    const activity = await generator.generateActivity(genConfig);

    const activityId = await db.saveActivity(req.user.id, {
      activity_name: activity.activityName,
      distance_km: activity.distanceKm,
      duration_min: activity.durationMin,
      pace_min_km: activity.paceMinKm,
      fit_file: activity.filename,
      upload_status: 'generated',
      route_start_lat: activity.startLat,
      route_start_lng: activity.startLng,
      route_start_time: activity.startTime ? activity.startTime.toISOString() : new Date().toISOString(),
      district_keys: activity.districtKey,
      created_by: (ov.near_me_lat && ov.near_me_lng) ? 'Custom' : 'Manual',
    });

    res.json({
      success: true,
      activity: {
        id: activityId,
        name: activity.activityName,
        distanceKm: activity.distanceKm,
        durationMin: activity.durationMin,
        paceMinKm: activity.paceMinKm,
        filename: activity.filename,
        numPoints: activity.numPoints,
        districtKey: activity.districtKey,
      },
    });
  } catch (err) {
    console.error('Generate error:', err);
    if (err.code === 'NO_VALID_TIME_SLOT') {
      // Save a failed record so it shows in history
      try {
        await db.saveActivity(req.user.id, {
          activity_name: 'Không thể tạo hoạt động',
          distance_km: 0,
          duration_min: 0,
          pace_min_km: 0,
          fit_file: null,
          upload_status: 'failed',
          route_start_lat: null,
          route_start_lng: null,
          route_start_time: new Date().toISOString(),
          district_keys: null,
          created_by: (ov.near_me_lat && ov.near_me_lng) ? 'Custom' : 'Manual',
          error_message: err.message,
        });
      } catch (_) { }
      return res.status(409).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

// Generate and upload
router.post('/generate-and-upload', async (req, res) => {
  try {
    const ov = req.body || {};
    const validation = validateConfig(ov, req.user.role || 'basic');
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    const config = await db.getAllConfig(req.user.id);

    const targetDate = ov.target_date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    let localActivities = await db.getActivitiesByDate(req.user.id, targetDate);
    let stravaActivities = [];
    if (await stravaApi.isAuthenticated(req.user.id)) {
      try {
        const after = Math.floor(new Date(`${targetDate}T00:00:00.000+07:00`).getTime() / 1000) - 1;
        stravaActivities = await stravaApi.getActivities(req.user.id, 1, 50, after, false);
        stravaActivities = stravaActivities.filter(a => (a.start_date_local || a.start_date).startsWith(targetDate));
        // Re-read local activities after getActivities automatically synced them
        localActivities = await db.getActivitiesByDate(req.user.id, targetDate);
      } catch (e) { console.warn('Strava fetch failed for overlap check'); }
    }

    const lastUploaded = await db.getLastUploadedActivity(req.user.id);
    const genConfig = buildGeneratorConfig(config, { ...ov, target_date: targetDate }, lastUploaded, req.user.role || 'basic');
    genConfig.existingActivities = [...localActivities, ...stravaActivities];
    genConfig.isManual = true;
    let format = ov.export_format || config.export_format || 'fit';
    const deviceNameForFormat2 = ov.device_name || config.device_name || systemLimits.device_name.default;
    if (gpxGenerator.shouldForceGPX(deviceNameForFormat2)) format = 'gpx';
    const generator = format === 'gpx' ? gpxGenerator : fitGenerator;
    const activity = await generator.generateActivity(genConfig);

    const dailyMaxActivity = parseInt(ov.daily_max_activity || config.daily_max_activity || '2');
    if (stravaActivities.length >= dailyMaxActivity) {
      const errMsg = `Giới hạn upload hàng ngày là ${dailyMaxActivity}. Vui lòng xóa bớt trên Strava để tiếp tục.`;
      await db.saveActivity(req.user.id, {
        activity_name: activity.activityName,
        distance_km: activity.distanceKm,
        duration_min: activity.durationMin,
        pace_min_km: activity.paceMinKm,
        fit_file: activity.filename,
        upload_status: 'failed',
        route_start_lat: activity.startLat,
        route_start_lng: activity.startLng,
        route_start_time: activity.startTime ? activity.startTime.toISOString() : new Date().toISOString(),
        district_keys: activity.districtKey,
        created_by: (ov.near_me_lat && ov.near_me_lng) ? 'Custom' : 'Manual',
        error_message: errMsg,
      });
      return res.status(403).json({ error: errMsg });
    }

    const activityId = await db.saveActivity(req.user.id, {
      activity_name: activity.activityName,
      distance_km: activity.distanceKm,
      duration_min: activity.durationMin,
      pace_min_km: activity.paceMinKm,
      fit_file: activity.filename,
      upload_status: 'generated',
      route_start_lat: activity.startLat,
      route_start_lng: activity.startLng,
      route_start_time: activity.startTime ? activity.startTime.toISOString() : new Date().toISOString(),
      district_keys: activity.districtKey,
      created_by: (ov.near_me_lat && ov.near_me_lng) ? 'Custom' : 'Manual',
    });

    const deviceName = ov.device_name || config.device_name || systemLimits.device_name.default;
    const uploadResult = await stravaApi.uploadActivity(req.user.id, activity.filepath, {
      name: activity.activityName,
      description: generator.getShortDescription(deviceName), // Swapped: Use app name as description
      sportType: activity.activityType || 'Run',
    });

    const finalStatus = await stravaApi.waitForUpload(req.user.id, uploadResult.id);

    const visibility = ov.strava_visibility || config.strava_visibility || 'everyone';
    if (visibility !== 'everyone' && finalStatus.activity_id) {
      try {
        console.log(`[Strava API] Updating activity ${finalStatus.activity_id} visibility to private/muted (hide_from_home: true)`);
        await stravaApi.updateActivity(req.user.id, finalStatus.activity_id, { hide_from_home: true });
      } catch (err) {
        console.error('[Strava API] Failed to update activity visibility:', err);
      }
    }

    await db.updateActivity(req.user.id, activityId, {
      strava_activity_id: String(finalStatus.activity_id),
      upload_status: 'uploaded',
    });

    stravaApi.clearActivityCache(req.user.id);



    res.json({
      success: true,
      activity: {
        id: activityId,
        activityName: activity.activityName,
        distanceKm: activity.distanceKm,
        stravaActivityId: finalStatus.activity_id
      },
    });
  } catch (err) {
    console.error('Generate and Upload error:', err);
    if (err.code === 'NO_VALID_TIME_SLOT') {
      try {
        await db.saveActivity(req.user.id, {
          activity_name: 'Không thể tạo hoạt động',
          distance_km: 0,
          duration_min: 0,
          pace_min_km: 0,
          fit_file: null,
          upload_status: 'failed',
          route_start_lat: null,
          route_start_lng: null,
          route_start_time: new Date().toISOString(),
          district_keys: null,
          created_by: (ov.near_me_lat && ov.near_me_lng) ? 'Custom' : 'Manual',
          error_message: err.message,
        });
      } catch (_) { }
      return res.status(409).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message, message: err.message });
  }
});

// Upload existing activity by local DB id
router.post('/upload/:id', async (req, res) => {
  try {
    const activities = await db.getActivities(req.user.id, 200);
    const activity = activities.find(a => a.id === parseInt(req.params.id));
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    const targetDate = new Date(activity.route_start_time || activity.created_at || Date.now()).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    let stravaActivities = [];
    if (await stravaApi.isAuthenticated(req.user.id)) {
      try {
        const after = Math.floor(new Date(`${targetDate}T00:00:00.000+07:00`).getTime() / 1000) - 1;
        stravaActivities = await stravaApi.getActivities(req.user.id, 1, 50, after, true);
        stravaActivities = stravaActivities.filter(a => (a.start_date_local || a.start_date).startsWith(targetDate));
      } catch (e) { console.warn('Strava fetch failed for limit check'); }
    }

    const config = await db.getAllConfig(req.user.id);
    const dailyMaxActivity = parseInt(config.daily_max_activity || '2');
    if (stravaActivities.length >= dailyMaxActivity) {
      return res.status(403).json({ error: `Giới hạn upload hàng ngày là ${dailyMaxActivity}. Vui lòng xóa bớt trên Strava để tiếp tục.` });
    }

    const fitPath = path.join(__dirname, '..', '..', 'data', 'activity', activity.fit_file || '');
    if (!fs.existsSync(fitPath)) {
      const ext = path.extname(activity.fit_file || '').toLowerCase();
      return res.status(404).json({ error: `${ext === '.gpx' ? 'GPX' : 'FIT'} file not found` });
    }

    const deviceName = await db.getConfig(req.user.id, 'device_name') || systemLimits.device_name.default;
    let sportType = 'Run';
    if (activity.activity_name.includes('Đi bộ')) sportType = 'Walk';
    else if (activity.activity_name.includes('Đạp xe')) sportType = 'Ride';

    const isGpx = (activity.fit_file || '').endsWith('.gpx');
    const generator = isGpx ? gpxGenerator : fitGenerator;

    const uploadResult = await stravaApi.uploadActivity(req.user.id, fitPath, {
      name: activity.activity_name,
      description: generator.getShortDescription(deviceName), // Swapped: Use app name as description
      sportType: sportType,
    });

    const finalStatus = await stravaApi.waitForUpload(req.user.id, uploadResult.id);

    const visibility = ov.strava_visibility || config.strava_visibility || 'everyone';
    if (visibility !== 'everyone' && finalStatus.activity_id) {
      try {
        console.log(`[Strava API] Updating activity ${finalStatus.activity_id} visibility to private/muted (hide_from_home: true)`);
        await stravaApi.updateActivity(req.user.id, finalStatus.activity_id, { hide_from_home: true });
      } catch (err) {
        console.error('[Strava API] Failed to update activity visibility:', err);
      }
    }

    await db.updateActivity(req.user.id, activity.id, {
      strava_activity_id: String(finalStatus.activity_id),
      upload_status: 'uploaded',
    });

    stravaApi.clearActivityCache(req.user.id);

    res.json({ success: true, stravaActivityId: finalStatus.activity_id });
  } catch (err) {
    console.error('Upload error:', err);
    if (req.params.id) {
      await db.updateActivity(req.user.id, parseInt(req.params.id), {
        upload_status: 'failed',
        error_message: JSON.stringify(err.body || err.message || err),
      });
    }
    res.status(500).json({ error: err.body || err.message || 'Upload failed' });
  }
});

// ─── Delete Activity ─────────────────────────────────────────────────────────

// DELETE /api/activities/:id?strava=true  - delete from local DB (and optionally Strava)
router.delete('/activities/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const deleteFromStrava = req.query.strava === 'true';

  const activities = await db.getActivities(req.user.id, 200);
  const activity = activities.find(a => a.id === id);
  if (!activity) return res.status(404).json({ error: 'Activity not found' });

  console.log(`[API] Deleting activity ${id} (Strava ID: ${activity.strava_activity_id || 'none'})`);

  let stravaDeleted = false;
  let stravaError = null;

  // Try to delete from Strava first if requested
  if (deleteFromStrava && activity.strava_activity_id) {
    try {
      await stravaApi.deleteActivity(req.user.id, activity.strava_activity_id);
      stravaDeleted = true;
    } catch (err) {
      stravaError = err.body || err.message || 'Strava delete failed';
      console.error('Strava delete error:', stravaError);
    }
  }

  // Delete FIT file
  try {
    const fitPath = path.join(__dirname, '..', '..', 'data', 'activity', activity.fit_file || '');
    if (fs.existsSync(fitPath)) fs.unlinkSync(fitPath);
  } catch (e) { /* ignore */ }

  // Soft delete from local DB
  const status = stravaDeleted ? 'removed' : 'deleted';
  await db.deleteActivity(req.user.id, id, false, status);

  stravaApi.clearActivityCache(req.user.id);

  res.json({
    success: true,
    stravaDeleted,
    stravaError,
    message: stravaDeleted
      ? 'Deleted from local DB and Strava'
      : deleteFromStrava && activity.strava_activity_id
        ? `Deleted locally. Strava error: ${stravaError}`
        : 'Deleted from local DB',
  });
});

// ─── Scheduler ───────────────────────────────────────────────────────────────

router.get('/scheduler', async (req, res) => {
  try {
    res.json(await scheduler.getStatus(req.user.id));
  } catch (err) {
    console.error(`[Scheduler API] Error getting status for user ${req.user?.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/scheduler', async (req, res) => {
  try {
    const updates = req.body;
    const role = req.user.role || 'basic';

    const configToValidate = {};
    if (updates.enabled !== undefined) configToValidate.schedule_enabled = updates.enabled;
    if (updates.time !== undefined) configToValidate.schedule_time = updates.time;
    if (updates.scheduleCount !== undefined) configToValidate.schedule_count = updates.scheduleCount;
    if (updates.time2 !== undefined) configToValidate.schedule_time_2 = updates.time2;
    if (updates.time3 !== undefined) configToValidate.schedule_time_3 = updates.time3;
    if (updates.limitScheduleTimeWindow !== undefined) configToValidate.limit_schedule_time_window = updates.limitScheduleTimeWindow;
    if (updates.countMin !== undefined) configToValidate.schedule_count_min = updates.countMin;
    if (updates.countMax !== undefined) configToValidate.schedule_count_max = updates.countMax;
    if (updates.targetDistanceEnabled !== undefined) configToValidate.target_distance_enabled = updates.targetDistanceEnabled;
    if (updates.targetDistanceKm !== undefined) configToValidate.target_distance_km = updates.targetDistanceKm;

    const validation = validateConfig(configToValidate, role);

    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    const s = validation.sanitized;
    await scheduler.updateSchedule(
      req.user.id,
      s.schedule_enabled !== undefined ? s.schedule_enabled === 'true' : undefined,
      s.schedule_time,
      s.schedule_count,
      s.schedule_time_2,
      s.schedule_count_min !== undefined ? parseInt(s.schedule_count_min) : undefined,
      s.schedule_count_max !== undefined ? parseInt(s.schedule_count_max) : undefined,
      s.target_distance_enabled !== undefined ? s.target_distance_enabled === 'true' : undefined,
      s.target_distance_km !== undefined ? parseFloat(s.target_distance_km) : undefined,
      s.schedule_time_3,
      s.limit_schedule_time_window !== undefined ? s.limit_schedule_time_window === 'true' : undefined
    );

    res.json(await scheduler.getStatus(req.user.id));
  } catch (err) {
    console.error(`[Scheduler API] Error updating schedule for user ${req.user?.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/scheduler/trigger', async (req, res) => {
  try {
    const result = await scheduler.executeJob(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── FIT Download ────────────────────────────────────────────────────────────

router.get('/fit/:filename', async (req, res) => {
  try {
    const dbInstance = await db.getDb();
    const activity = await dbInstance.get('SELECT id FROM activities WHERE account_id = ? AND fit_file = ?', [req.user.id, req.params.filename]);
    if (!activity) {
      return res.status(403).json({ error: 'Access denied. You do not own this FIT file.' });
    }

    const fitPath = path.join(__dirname, '..', '..', 'data', 'activity', req.params.filename);
    if (!fs.existsSync(fitPath)) return res.status(404).json({ error: 'FIT file not found' });
    res.download(fitPath, req.params.filename);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Account Management ───────────────────────────────────────────────────────

router.put('/account/password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 5) {
      return res.status(400).json({ error: 'Password must be at least 5 characters long' });
    }
    await db.updateAccountPassword(req.user.id, newPassword);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password update error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/account/activate-vip', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    // Check Bruteforce
    const isLocked = await db.checkBruteForce(req.user.id);
    if (isLocked) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in an hour.' });
    }

    const result = await db.activateVip(req.user.id, code);
    if (result.success) {
      res.json({ success: true, message: 'VIP activated! Please refresh to enjoy VIP benefits.' });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (err) {
    console.error('VIP activation error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
