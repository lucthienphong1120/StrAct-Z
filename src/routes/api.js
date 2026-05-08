/**
 * API Routes - Config, activities, scheduler, district management
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const scheduler = require('../services/scheduler');
const { generateActivity, HANOI_DISTRICTS } = require('../services/gpx-generator');
const stravaApi = require('../services/strava-api');

// ─── Districts ──────────────────────────────────────────────────────────────

router.get('/districts', (req, res) => {
  const list = Object.entries(HANOI_DISTRICTS).map(([key, d]) => ({
    key, name: d.name, lat: d.lat, lng: d.lng, radiusKm: d.radiusKm,
  }));
  res.json(list);
});

// ─── Configuration ──────────────────────────────────────────────────────────

router.get('/config', async (req, res) => {
  res.json(await db.getAllConfig(req.user.id));
});

router.post('/config', async (req, res) => {
  const updates = req.body;
  
  // Enforce VIP limits
  if (req.user.role !== 'vip') {
    if (updates.max_district_span && parseInt(updates.max_district_span) > 2) {
      return res.status(403).json({ error: 'Max 2 districts allowed. VIP required.' });
    }
    if (updates.schedule_count_max && parseInt(updates.schedule_count_max) > 2) {
      return res.status(403).json({ error: 'Max 2 scheduled activities allowed. VIP required.' });
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    await db.setConfig(req.user.id, key, value);
  }
  res.json({ success: true, config: await db.getAllConfig(req.user.id) });
});

// ─── Stats ──────────────────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  const stats = await db.getActivityStats(req.user.id);
  const scheduleStatus = await scheduler.getStatus(req.user.id);
  const tokens = await db.getTokens(req.user.id);
  res.json({
    ...stats,
    role: req.user.role,
    schedule: scheduleStatus,
    authenticated: !!(tokens && tokens.access_token),
    athleteName: tokens?.athlete_name || null,
    athleteAvatar: tokens?.athlete_avatar || null,
  });
});

router.get('/insights', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 14;
    const now = new Date();
    const after = Math.floor((now.getTime() - (days + 1) * 24 * 60 * 60 * 1000) / 1000); // Buffer 1 day
    
    const activities = await stravaApi.getActivities(req.user.id, 1, 200, after);
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Activities ─────────────────────────────────────────────────────────────

router.get('/activities', async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const all = await db.getActivities(req.user.id, limit);
  // Exclude hard-deleted (shouldn't exist) but show soft-deleted with flag
  res.json(all);
});

router.get('/strava-activities', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;
    const after = req.query.after ? parseInt(req.query.after) : null;
    const activities = await stravaApi.getActivities(req.user.id, page, perPage, after);
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate GPX only (no upload)
router.post('/generate', async (req, res) => {
  try {
    const config = await db.getAllConfig(req.user.id);
    const ov = req.body || {};

    const activity = await generateActivity({
      districtKey: ov.district_key || config.district_key,
      selected_districts: ov.selected_districts || config.selected_districts,
      max_district_span: ov.max_district_span || config.max_district_span,
      targetDate: ov.target_date,
      minTime: ov.min_time || config.min_time,
      maxTime: ov.max_time || config.max_time,
      workStart1: ov.work_start1 || config.work_start1,
      workEnd1: ov.work_end1 || config.work_end1,
      workStart2: ov.work_start2 || config.work_start2,
      workEnd2: ov.work_end2 || config.work_end2,
      minDistanceKm: parseFloat(ov.min_distance_km || config.min_distance_km),
      maxDistanceKm: parseFloat(ov.max_distance_km || config.max_distance_km),
      minPace: parseFloat(ov.min_pace || config.min_pace),
      maxPace: parseFloat(ov.max_pace || config.max_pace),
      activityType: ov.activity_type || config.activity_type,
      heartRateEnabled: (ov.heart_rate_enabled || config.heart_rate_enabled) === 'true',
      minHeartRate: parseInt(ov.min_heart_rate || config.min_heart_rate),
      maxHeartRate: parseInt(ov.max_heart_rate || config.max_heart_rate),
      useOSRM: (ov.use_osrm || config.use_osrm) !== 'false',
      simWeather: (ov.sim_weather || config.sim_weather) !== 'false',
      simRedLights: (ov.sim_redlights || config.sim_redlights) !== 'false',
    });

    const activityId = await db.saveActivity(req.user.id, {
      activity_name: activity.activityName,
      distance_km: activity.distanceKm,
      duration_min: activity.durationMin,
      pace_min_km: activity.paceMinKm,
      gpx_file: activity.filename,
      upload_status: 'generated',
      route_start_lat: activity.startLat,
      route_start_lng: activity.startLng,
      route_start_time: activity.startTime ? activity.startTime.toISOString() : new Date().toISOString(),
      district_keys: activity.districtKey,
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
    res.status(500).json({ error: err.message });
  }
});

// Generate and upload
router.post('/generate-and-upload', async (req, res) => {
  try {
    const config = await db.getAllConfig(req.user.id);
    const ov = req.body || {};

    const activity = await generateActivity({
      districtKey: ov.district_key || config.district_key,
      selected_districts: ov.selected_districts || config.selected_districts,
      max_district_span: ov.max_district_span || config.max_district_span,
      targetDate: ov.target_date,
      minTime: ov.min_time || config.min_time,
      maxTime: ov.max_time || config.max_time,
      workStart1: ov.work_start1 || config.work_start1,
      workEnd1: ov.work_end1 || config.work_end1,
      workStart2: ov.work_start2 || config.work_start2,
      workEnd2: ov.work_end2 || config.work_end2,
      minDistanceKm: parseFloat(ov.min_distance_km || config.min_distance_km),
      maxDistanceKm: parseFloat(ov.max_distance_km || config.max_distance_km),
      minPace: parseFloat(ov.min_pace || config.min_pace),
      maxPace: parseFloat(ov.max_pace || config.max_pace),
      activityType: ov.activity_type || config.activity_type,
      heartRateEnabled: (ov.heart_rate_enabled || config.heart_rate_enabled) === 'true',
      minHeartRate: parseInt(ov.min_heart_rate || config.min_heart_rate),
      maxHeartRate: parseInt(ov.max_heart_rate || config.max_heart_rate),
      useOSRM: (ov.use_osrm || config.use_osrm) !== 'false',
      simWeather: (ov.sim_weather || config.sim_weather) !== 'false',
      simRedLights: (ov.sim_redlights || config.sim_redlights) !== 'false',
    });

    const activityId = await db.saveActivity(req.user.id, {
      activity_name: activity.activityName,
      distance_km: activity.distanceKm,
      duration_min: activity.durationMin,
      pace_min_km: activity.paceMinKm,
      gpx_file: activity.filename,
      upload_status: 'generated',
      route_start_lat: activity.startLat,
      route_start_lng: activity.startLng,
      route_start_time: activity.startTime ? activity.startTime.toISOString() : new Date().toISOString(),
      district_keys: activity.districtKey,
    });

    const uploadResult = await stravaApi.uploadActivity(req.user.id, activity.filepath, {
      name: activity.activityName,
      sportType: ov.activity_type || config.activity_type || 'Run',
    });

    const finalStatus = await stravaApi.waitForUpload(req.user.id, uploadResult.id);

    await db.updateActivity(req.user.id, activityId, {
      strava_activity_id: String(finalStatus.activity_id),
      upload_status: 'uploaded',
    });

    res.json({
      success: true,
      activity: {
        id: activityId,
        activityName: activity.activityName,
        distanceKm: activity.distanceKm,
        stravaActivityId: finalStatus.activity_id,
      },
    });
  } catch (err) {
    console.error('Generate and Upload error:', err);
    res.status(500).json({ error: err.message, message: err.message });
  }
});

// Upload existing activity by local DB id
router.post('/upload/:id', async (req, res) => {
  try {
    const activities = await db.getActivities(req.user.id, 200);
    const activity = activities.find(a => a.id === parseInt(req.params.id));
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    const gpxPath = path.join(__dirname, '..', '..', 'data', 'gpx', activity.gpx_file);
    if (!fs.existsSync(gpxPath)) return res.status(404).json({ error: 'GPX file not found' });

    const uploadResult = await stravaApi.uploadActivity(req.user.id, gpxPath, {
      name: activity.activity_name,
      sportType: await db.getConfig(req.user.id, 'activity_type') || 'Run',
    });

    const finalStatus = await stravaApi.waitForUpload(req.user.id, uploadResult.id);

    await db.updateActivity(req.user.id, activity.id, {
      strava_activity_id: String(finalStatus.activity_id),
      upload_status: 'uploaded',
    });

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

  // Delete GPX file
  try {
    const gpxPath = path.join(__dirname, '..', '..', 'data', 'gpx', activity.gpx_file);
    if (fs.existsSync(gpxPath)) fs.unlinkSync(gpxPath);
  } catch (e) { /* ignore */ }

  // Hard delete from local DB
  await db.deleteActivity(req.user.id, id, true);

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

router.get('/scheduler', async (req, res) => res.json(await scheduler.getStatus(req.user.id)));

router.post('/scheduler', async (req, res) => {
  const { enabled, time, countMin, countMax } = req.body;
  if (req.user.role !== 'vip' && (parseInt(countMin) > 2 || parseInt(countMax) > 2)) {
    return res.status(403).json({ error: 'Max 2 scheduled activities allowed. VIP required.' });
  }
  await scheduler.updateSchedule(req.user.id, enabled, time, countMin, countMax);
  res.json(await scheduler.getStatus(req.user.id));
});

router.post('/scheduler/trigger', async (req, res) => {
  try {
    const result = await scheduler.executeJob(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GPX Download ────────────────────────────────────────────────────────────

router.get('/gpx/:filename', (req, res) => {
  const gpxPath = path.join(__dirname, '..', '..', 'data', 'gpx', req.params.filename);
  if (!fs.existsSync(gpxPath)) return res.status(404).json({ error: 'GPX file not found' });
  res.download(gpxPath, req.params.filename);
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

module.exports = router;
