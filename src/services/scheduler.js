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
    if (!(await stravaApi.isAuthenticated())) {
      throw new Error('Not authenticated with Strava. Please connect your account.');
    }

    // Check daily limit
    const stats = await db.getActivityStats();
    if (stats.todayCount >= 2) {
      console.log('[Scheduler] Limit reached (2 activities/day). VIP required.');
      return { success: false, message: 'VIP_REQUIRED' };
    }

    // Get configuration
    const config = await db.getAllConfig();
    const minCount = parseInt(config.schedule_count_min) || 1;
    const maxCount = parseInt(config.schedule_count_max) || 1;
    let taskCount = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
    if (taskCount > 3) taskCount = 3; // Safety cap

    console.log(`[Scheduler] Will generate ${taskCount} activities...`);
    
    let successCount = 0;
    let lastActivity = null;

    for (let i = 0; i < taskCount; i++) {
      // Check daily limit inside loop
      const stats = await db.getActivityStats();
      if (stats.todayCount >= 2) {
        console.log('[Scheduler] Limit reached (2 activities/day). VIP required.');
        if (i === 0) return { success: false, message: 'VIP_REQUIRED' };
        break; // Stop generating more if limit reached
      }

      // Generate activity (async - uses OSRM)
      console.log(`[Scheduler] Generating activity ${i+1}/${taskCount}...`);
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
      const activityId = await db.saveActivity({
        activity_name: activity.activityName,
        distance_km: activity.distanceKm,
        duration_min: activity.durationMin,
        pace_min_km: activity.paceMinKm,
        gpx_file: activity.filename,
        upload_status: 'generated',
        route_start_lat: activity.startLat,
        route_start_lng: activity.startLng,
        route_start_time: activity.startTime ? activity.startTime.toISOString() : new Date().toISOString(),
      });

      // Upload to Strava
      console.log(`[Scheduler] Uploading activity ${i+1} to Strava...`);
      try {
        const uploadResult = await stravaApi.uploadActivity(activity.filepath, {
          name: activity.activityName,
          sportType: config.activity_type || 'Run',
        });

        console.log(`[Scheduler] Upload initiated, ID: ${uploadResult.id}`);

        // Wait for processing
        const finalStatus = await stravaApi.waitForUpload(uploadResult.id);

        console.log(`[Scheduler] Upload complete! Strava Activity ID: ${finalStatus.activity_id}`);

        await db.updateActivity(activityId, {
          strava_activity_id: String(finalStatus.activity_id),
          upload_status: 'uploaded',
        });

        successCount++;
        lastActivity = {
          ...activity,
          stravaActivityId: finalStatus.activity_id,
        };
        
        // Brief delay between uploads if multiple
        if (i < taskCount - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }

      } catch (uploadErr) {
        console.error('[Scheduler] Upload failed:', uploadErr);
        await db.updateActivity(activityId, {
          upload_status: 'failed',
          error_message: typeof uploadErr === 'object' ? JSON.stringify(uploadErr.body || uploadErr.message || uploadErr) : String(uploadErr),
        });
        // Continue to the next task even if this one fails
      }
    } // end for

    return {
      success: successCount > 0,
      message: `Generated and uploaded ${successCount}/${taskCount} activities`,
      activity: lastActivity, // Just returning the last one for the API response
    };
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
async function startScheduler() {
  const config = await db.getAllConfig();

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
async function getStatus() {
  const config = await db.getAllConfig();
  return {
    enabled: config.schedule_enabled === 'true',
    cronExpression: config.schedule_cron || '0 6 * * *',
    scheduleTime: config.schedule_time || '06:00',
    scheduleCountMin: parseInt(config.schedule_count_min) || 1,
    scheduleCountMax: parseInt(config.schedule_count_max) || 1,
    isRunning,
    taskActive: scheduledTask !== null,
  };
}

/**
 * Update schedule
 */
async function updateSchedule(enabled, time, countMin, countMax) {
  await db.setConfig('schedule_enabled', enabled ? 'true' : 'false');

  if (time) {
    await db.setConfig('schedule_time', time);
    // Convert time to cron expression
    const [hours, minutes] = time.split(':');
    const cronExpression = `${parseInt(minutes)} ${parseInt(hours)} * * *`;
    await db.setConfig('schedule_cron', cronExpression);
  }
  
  if (countMin) await db.setConfig('schedule_count_min', countMin);
  if (countMax) await db.setConfig('schedule_count_max', countMax);

  if (enabled) {
    await startScheduler();
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
