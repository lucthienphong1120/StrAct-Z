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

router.get('/config', (req, res) => {
  res.json(db.getAllConfig());
});

router.post('/config', (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    db.setConfig(key, value);
  }
  res.json({ success: true, config: db.getAllConfig() });
});

// ─── Stats ──────────────────────────────────────────────────────────────────

router.get('/stats', (req, res) => {
  const stats = db.getActivityStats();
  const scheduleStatus = scheduler.getStatus();
  const tokens = db.getTokens();
  res.json({
    ...stats,
    schedule: scheduleStatus,
    authenticated: !!(tokens && tokens.access_token),
    athleteName: tokens?.athlete_name || null,
    athleteAvatar: tokens?.athlete_avatar || null,
  });
});

// ─── Activities ─────────────────────────────────────────────────────────────

router.get('/activities', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const all = db.getActivities(limit);
  // Exclude hard-deleted (shouldn't exist) but show soft-deleted with flag
  res.json(all);
});

router.get('/strava-activities', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;
    const after = req.query.after ? parseInt(req.query.after) : null;
    const activities = await stravaApi.getActivities(page, perPage, after);
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate GPX only (no upload)
router.post('/generate', async (req, res) => {
  try {
    const config = db.getAllConfig();
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
    });

    const activityId = db.saveActivity({
      activity_name: activity.activityName,
      distance_km: activity.distanceKm,
      duration_min: activity.durationMin,
      pace_min_km: activity.paceMinKm,
      gpx_file: activity.filename,
      upload_status: 'generated',
      route_start_lat: activity.startLat,
      route_start_lng: activity.startLng,
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
    const result = await scheduler.executeJob();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload existing activity by local DB id
router.post('/upload/:id', async (req, res) => {
  try {
    const activities = db.getActivities(200);
    const activity = activities.find(a => a.id === parseInt(req.params.id));
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    const gpxPath = path.join(__dirname, '..', '..', 'data', 'gpx', activity.gpx_file);
    if (!fs.existsSync(gpxPath)) return res.status(404).json({ error: 'GPX file not found' });

    const uploadResult = await stravaApi.uploadActivity(gpxPath, {
      name: activity.activity_name,
      sportType: db.getConfig('activity_type') || 'Run',
    });

    const finalStatus = await stravaApi.waitForUpload(uploadResult.id);

    db.updateActivity(activity.id, {
      strava_activity_id: String(finalStatus.activity_id),
      upload_status: 'uploaded',
    });

    res.json({ success: true, stravaActivityId: finalStatus.activity_id });
  } catch (err) {
    console.error('Upload error:', err);
    if (req.params.id) {
      db.updateActivity(parseInt(req.params.id), {
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

  const activities = db.getActivities(200);
  const activity = activities.find(a => a.id === id);
  if (!activity) return res.status(404).json({ error: 'Activity not found' });

  console.log(`[API] Deleting activity ${id} (Strava ID: ${activity.strava_activity_id || 'none'})`);

  let stravaDeleted = false;
  let stravaError = null;

  // Try to delete from Strava first if requested
  if (deleteFromStrava && activity.strava_activity_id) {
    try {
      await stravaApi.deleteActivity(activity.strava_activity_id);
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
  db.deleteActivity(id, true);

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

router.get('/scheduler', (req, res) => res.json(scheduler.getStatus()));

router.post('/scheduler', (req, res) => {
  const { enabled, time } = req.body;
  scheduler.updateSchedule(enabled, time);
  res.json(scheduler.getStatus());
});

router.post('/scheduler/trigger', async (req, res) => {
  try {
    const result = await scheduler.executeJob();
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

module.exports = router;
