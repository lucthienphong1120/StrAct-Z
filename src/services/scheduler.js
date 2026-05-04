/**
 * Scheduler Service - Manages cron jobs for automatic activity generation & upload
 */

const cron = require('node-cron');
const db = require('../db/database');
const { generateActivity } = require('./gpx-generator');
const stravaApi = require('./strava-api');

let scheduledTask = null;
let isRunning = false;

/**
 * Execute the auto-generate and upload flow
 */
async function executeJob() {
  if (isRunning) {
    console.log('[Scheduler] Job already running, skipping...');
    return { success: false, message: 'Job already running' };
  }

  isRunning = true;
  console.log(`[Scheduler] Starting auto-generate job at ${new Date().toISOString()}`);

  try {
    // Check if authenticated
    if (!stravaApi.isAuthenticated()) {
      throw new Error('Not authenticated with Strava. Please connect your account.');
    }

    // Check daily limit
    const stats = db.getActivityStats();
    if (stats.todayCount >= 2) {
      console.log('[Scheduler] Limit reached (2 activities/day). VIP required.');
      return { success: false, message: 'VIP_REQUIRED' };
    }

    // Get configuration
    const config = db.getAllConfig();

    // Generate activity (async - uses OSRM)
    console.log(`[Scheduler] Generating activity...`);
    const activity = await generateActivity({
      districtKey: config.district_key,
      selected_districts: config.selected_districts,
      max_district_span: config.max_district_span,
      minTime: config.min_time,
      maxTime: config.max_time,
      workStart1: config.work_start1,
      workEnd1: config.work_end1,
      workStart2: config.work_start2,
      workEnd2: config.work_end2,
      minDistanceKm: parseFloat(config.min_distance_km),
      maxDistanceKm: parseFloat(config.max_distance_km),
      minPace: parseFloat(config.min_pace),
      maxPace: parseFloat(config.max_pace),
      activityType: config.activity_type,
      heartRateEnabled: config.heart_rate_enabled === 'true',
      minHeartRate: parseInt(config.min_heart_rate),
      maxHeartRate: parseInt(config.max_heart_rate),
      useOSRM: config.use_osrm !== 'false',
    });

    console.log(`[Scheduler] Generated: ${activity.activityName} - ${activity.distanceKm}km in ${activity.durationMin}min`);

    // Save to database
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

    // Upload to Strava
    console.log('[Scheduler] Uploading to Strava...');
    try {
      const uploadResult = await stravaApi.uploadActivity(activity.filepath, {
        name: activity.activityName,
        sportType: config.activity_type || 'Run',
      });

      console.log(`[Scheduler] Upload initiated, ID: ${uploadResult.id}`);

      // Wait for processing
      const finalStatus = await stravaApi.waitForUpload(uploadResult.id);

      console.log(`[Scheduler] Upload complete! Strava Activity ID: ${finalStatus.activity_id}`);

      db.updateActivity(activityId, {
        strava_activity_id: String(finalStatus.activity_id),
        upload_status: 'uploaded',
      });

      return {
        success: true,
        activity: {
          ...activity,
          stravaActivityId: finalStatus.activity_id,
        }
      };
    } catch (uploadErr) {
      console.error('[Scheduler] Upload failed:', uploadErr);
      db.updateActivity(activityId, {
        upload_status: 'failed',
        error_message: typeof uploadErr === 'object' ? JSON.stringify(uploadErr.body || uploadErr.message || uploadErr) : String(uploadErr),
      });

      return {
        success: false,
        message: `Upload failed: ${JSON.stringify(uploadErr.body || uploadErr.message || uploadErr)}`,
        activity,
      };
    }
  } catch (err) {
    console.error('[Scheduler] Job failed:', err);
    return { success: false, message: err.message };
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduler
 */
function startScheduler() {
  const config = db.getAllConfig();

  if (config.schedule_enabled !== 'true') {
    console.log('[Scheduler] Schedule disabled');
    return false;
  }

  const cronExpression = config.schedule_cron || '0 6 * * *';

  if (!cron.validate(cronExpression)) {
    console.error(`[Scheduler] Invalid cron expression: ${cronExpression}`);
    return false;
  }

  // Stop existing task
  stopScheduler();

  scheduledTask = cron.schedule(cronExpression, async () => {
    console.log('[Scheduler] Cron triggered');
    await executeJob();
  }, {
    timezone: 'Asia/Ho_Chi_Minh'
  });

  console.log(`[Scheduler] Started with cron: ${cronExpression} (Asia/Ho_Chi_Minh)`);
  return true;
}

/**
 * Stop the scheduler
 */
function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[Scheduler] Stopped');
  }
}

/**
 * Get scheduler status
 */
function getStatus() {
  const config = db.getAllConfig();
  return {
    enabled: config.schedule_enabled === 'true',
    cronExpression: config.schedule_cron || '0 6 * * *',
    scheduleTime: config.schedule_time || '06:00',
    isRunning,
    taskActive: scheduledTask !== null,
  };
}

/**
 * Update schedule
 */
function updateSchedule(enabled, time) {
  db.setConfig('schedule_enabled', enabled ? 'true' : 'false');

  if (time) {
    db.setConfig('schedule_time', time);
    // Convert time to cron expression
    const [hours, minutes] = time.split(':');
    const cronExpression = `${parseInt(minutes)} ${parseInt(hours)} * * *`;
    db.setConfig('schedule_cron', cronExpression);
  }

  if (enabled) {
    startScheduler();
  } else {
    stopScheduler();
  }
}

module.exports = {
  executeJob,
  startScheduler,
  stopScheduler,
  getStatus,
  updateSchedule,
};
