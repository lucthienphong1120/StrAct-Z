/**
 * Scheduler Service - Manages cron jobs for automatic activity generation & upload
 */

const cron = require('node-cron');
const db = require('../db/database');
const { generateActivity } = require('./gpx-generator');
const stravaApi = require('./strava-api');
const googleFit = require('./google-fit');
const systemLimits = require('../config/limits');

const scheduledTasks = new Map(); // accountId -> cronTask
const isRunning = new Map(); // accountId -> boolean

/**
 * Execute the auto-generate and upload flow for a specific account
 */
async function executeJob(accountId, slotName = 'Schedule 1') {
  if (isRunning.get(accountId)) {
    console.log(`[Scheduler] Job already running for account ${accountId}, skipping...`);
    return { success: false, message: 'Job already running' };
  }

  isRunning.set(accountId, true);
  console.log(`[Scheduler] Starting auto-generate job for account ${accountId} at ${new Date().toISOString()}`);

  try {
    // Check if authenticated
    if (!(await stravaApi.isAuthenticated(accountId))) {
      throw new Error('Not authenticated with Strava. Please connect your account.');
    }

    // Check daily limit
    const stats = await db.getActivityStats(accountId);
    const role = await db.getAccountRole(accountId);
    const limits = systemLimits[role] || systemLimits.normal;

    if (stats.todayCount >= limits.daily_upload_limit.max) {
      console.log(`[Scheduler] Limit reached for account ${accountId} (${limits.daily_upload_limit.max} activities/day).`);
      return { success: false, message: 'VIP_REQUIRED' };
    }

    // Get configuration
    const config = await db.getAllConfig(accountId);
    const minCount = config.schedule_count_min !== undefined ? parseInt(config.schedule_count_min) : 1;
    const maxCount = config.schedule_count_max !== undefined ? parseInt(config.schedule_count_max) : 2;
    let taskCount = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
    if (taskCount > limits.schedule_count_max.max) taskCount = limits.schedule_count_max.max; // Dynamic safety cap

    // Get existing activities for today to avoid overlaps
    const targetDate = new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Ho_Chi_Minh'});
    const localActivities = await db.getActivitiesByDate(accountId, targetDate);
    let stravaActivities = [];
    if (await stravaApi.isAuthenticated(accountId)) {
      try {
        const after = Math.floor(new Date(`${targetDate}T00:00:00.000+07:00`).getTime() / 1000) - 1;
        stravaActivities = await stravaApi.getActivities(accountId, 1, 50, after);
        stravaActivities = stravaActivities.filter(a => a.start_date.startsWith(targetDate));
      } catch (e) { console.warn(`[Scheduler] Strava fetch failed for account ${accountId}`); }
    }
    
    let existingActivities = [...localActivities, ...stravaActivities];

    console.log(`[Scheduler] Account ${accountId} will generate ${taskCount} activities...`);
    
    let successCount = 0;

    for (let i = 0; i < taskCount; i++) {
      // Check daily limit inside loop
      const loopStats = await db.getActivityStats(accountId);
      if (loopStats.todayCount >= limits.daily_upload_limit.max) {
        console.log(`[Scheduler] Limit reached for account ${accountId}.`);
        if (i === 0) return { success: false, message: 'VIP_REQUIRED' };
        break; 
      }



      const lastUploaded = await db.getLastUploadedActivity(accountId);

      // Generate activity (async - uses OSRM)
      console.log(`[Scheduler] Account ${accountId} generating activity ${i+1}/${taskCount}...`);
      const activity = await generateActivity({
        districtKey: config.district_key,
        selected_districts: config.selected_districts,
        max_district_span: config.max_district_span,
        targetDate: targetDate,
        existingActivities: existingActivities,
        minTime: config.min_time,
        maxTime: config.max_time,
        workStart1: config.work_start1,
        workEnd1: config.work_end1,
        workStart2: config.work_start2,
        workEnd2: config.work_end2,
        overlap_protection_minutes: config.overlap_protection_minutes,
        minDistanceKm: parseFloat(config.min_distance_km),
        maxDistanceKm: parseFloat(config.max_distance_km),
        minPace: parseFloat(config.min_pace),
        maxPace: parseFloat(config.max_pace),
        activityType: config.activity_type,
        heartRateEnabled: config.heart_rate_enabled === 'true',
        minHeartRate: parseInt(config.min_heart_rate),
        maxHeartRate: parseInt(config.max_heart_rate),
        useOSRM: config.use_osrm !== 'false',
        simWeather: config.sim_weather !== 'false',
        simRedLights: config.sim_redlights !== 'false',
        userRole: role,
        boost_adjacent: config.boost_adjacent,
        last_district_keys: lastUploaded ? lastUploaded.district_keys : null,
      });

      console.log(`[Scheduler] Generated: ${activity.activityName} at ${activity.startTime.toLocaleTimeString('vi-VN', { hour12: false })} - ${activity.distanceKm}km`);
      
      // Add to existingActivities for next iteration check
      existingActivities.push({
        start_date: activity.startTime.toISOString(),
        duration_min: activity.durationMin
      });

      // Save to database
      const activityId = await db.saveActivity(accountId, {
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
        created_by: slotName,
      });

      // Upload to Strava
      console.log(`[Scheduler] Uploading activity ${i+1} to Strava...`);
      try {
        const uploadResult = await stravaApi.uploadActivity(accountId, activity.filepath, {
          name: activity.activityName,
          sportType: config.activity_type || 'Run',
        });

        console.log(`[Scheduler] Upload initiated, ID: ${uploadResult.id}`);

        // Wait for processing
        const finalStatus = await stravaApi.waitForUpload(accountId, uploadResult.id);

        console.log(`[Scheduler] Upload complete! Strava Activity ID: ${finalStatus.activity_id}`);

        await db.updateActivity(accountId, activityId, {
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
        await db.updateActivity(accountId, activityId, {
          upload_status: 'failed',
          error_message: typeof uploadErr === 'object' ? JSON.stringify(uploadErr.body || uploadErr.message || uploadErr) : String(uploadErr),
        });
      }
    } // end for

    return {
      success: successCount > 0,
      message: `Generated and uploaded ${successCount}/${taskCount} activities`,
      activity: lastActivity,
    };
  } catch (err) {
    console.error(`[Scheduler] Job failed for account ${accountId}:`, err);
    return { success: false, message: err.message };
  } finally {
    isRunning.set(accountId, false);
  }
}

/**
 * Start the scheduler for a specific account
 */
async function startScheduler(accountId) {
  const config = await db.getAllConfig(accountId);
  const tasks = [];

  // Stop existing tasks
  stopScheduler(accountId);

  // First schedule
  if (config.schedule_enabled === 'true') {
    const time1 = config.schedule_time || '22:00';
    const [h1, m1] = time1.split(':');
    const cron1 = `${parseInt(m1)} ${parseInt(h1)} * * *`;
    
    if (cron.validate(cron1)) {
      const task1 = cron.schedule(cron1, async () => {
        console.log(`[Scheduler] Slot 1 triggered for account ${accountId}`);
        await executeJob(accountId, 'Schedule 1');
      }, { timezone: 'Asia/Ho_Chi_Minh' });
      tasks.push(task1);
      console.log(`[Scheduler] Slot 1 started for ${accountId}: ${cron1}`);
    }
  }

  // Second schedule
  if (parseInt(config.schedule_count) >= 2) {
    const time2 = config.schedule_time_2 || '14:00';
    const [h2, m2] = time2.split(':');
    const cron2 = `${parseInt(m2)} ${parseInt(h2)} * * *`;
    
    if (cron.validate(cron2)) {
      const task2 = cron.schedule(cron2, async () => {
        console.log(`[Scheduler] Slot 2 triggered for account ${accountId}`);
        await executeJob(accountId, 'Schedule 2');
      }, { timezone: 'Asia/Ho_Chi_Minh' });
      tasks.push(task2);
      console.log(`[Scheduler] Slot 2 started for ${accountId}: ${cron2}`);
    }
  }

  if (tasks.length > 0) {
    scheduledTasks.set(accountId, tasks);
    return true;
  }
  return false;
}

/**
 * Start schedulers for ALL active accounts on server boot
 */
async function startAllSchedulers() {
  const accounts = await db.getAllAccounts();
  for (const account of accounts) {
    await startScheduler(account.id);
  }
}

/**
 * Stop the scheduler for a specific account
 */
function stopScheduler(accountId) {
  const tasks = scheduledTasks.get(accountId);
  if (tasks && Array.isArray(tasks)) {
    tasks.forEach(t => t.stop());
    scheduledTasks.delete(accountId);
    console.log(`[Scheduler] All tasks stopped for account ${accountId}`);
  } else if (tasks) {
    // Legacy single task support
    tasks.stop();
    scheduledTasks.delete(accountId);
  }
}

/**
 * Get scheduler status for a specific account
 */
async function getStatus(accountId) {
  const config = await db.getAllConfig(accountId);
  const count = parseInt(config.schedule_count) || 1;
  return {
    enabled: config.schedule_enabled === 'true',
    scheduleTime: config.schedule_time || '22:00',
    scheduleCount: count,
    scheduleTime2: config.schedule_time_2 || '14:00',
    scheduleCountMin: parseInt(config.schedule_count_min) >= 0 ? parseInt(config.schedule_count_min) : 1,
    scheduleCountMax: parseInt(config.schedule_count_max) >= 0 ? parseInt(config.schedule_count_max) : 2,
    isRunning: isRunning.get(accountId) || false,
    taskActive: scheduledTasks.has(accountId),
  };
}

/**
 * Update schedule for a specific account
 */
async function updateSchedule(accountId, enabled1, time1, scheduleCount, time2, countMin, countMax) {
  await db.setConfig(accountId, 'schedule_enabled', enabled1 ? 'true' : 'false');
  if (time1) await db.setConfig(accountId, 'schedule_time', time1);
  
  if (scheduleCount !== undefined) await db.setConfig(accountId, 'schedule_count', scheduleCount);
  if (time2) await db.setConfig(accountId, 'schedule_time_2', time2);
  
  if (countMin !== undefined && countMin !== null) await db.setConfig(accountId, 'schedule_count_min', countMin);
  if (countMax !== undefined && countMax !== null) await db.setConfig(accountId, 'schedule_count_max', countMax);

  await startScheduler(accountId);
}

module.exports = {
  executeJob,
  startScheduler,
  startAllSchedulers,
  stopScheduler,
  getStatus,
  updateSchedule,
};
