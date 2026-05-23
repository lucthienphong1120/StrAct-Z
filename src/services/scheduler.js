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

    // Note: Scheduled activities are NOT limited by daily_upload_limit.
    // They are only limited by schedule_count_min and schedule_count_max config.
    const config = await db.getAllConfig(accountId);
    const role = await db.getAccountRole(accountId);
    const limits = systemLimits[role] || systemLimits.normal;

    const minCount = parseInt(config.schedule_count_min) >= 0 ? parseInt(config.schedule_count_min) : 1;
    const maxCount = parseInt(config.schedule_count_max) >= 1 ? parseInt(config.schedule_count_max) : 2;

    // Random count within user config
    let taskCount = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
    if (taskCount > limits.schedule_count_max.max) taskCount = limits.schedule_count_max.max; // Dynamic safety cap

    if (taskCount <= 0) {
      console.log(`[Scheduler] Account ${accountId}: taskCount is 0, skipping.`);
      return { success: true, message: 'No activities scheduled for this slot' };
    }

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
      // No daily limit check inside loop for scheduled events



      let activity;
      const lastUploaded = await db.getLastUploadedActivity(accountId);
      try {
        activity = await generateActivity({
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
          heartRateEnabled: String(config.heart_rate_enabled) === 'true',
          minHeartRate: parseInt(config.min_heart_rate),
          maxHeartRate: parseInt(config.max_heart_rate),
          useOSRM: String(config.use_osrm) !== 'false',
          simWeather: String(config.sim_weather) !== 'false',
          simRedLights: String(config.sim_redlights) !== 'false',
          rest_time_percent: config.rest_time_percent,
          userRole: role,
          boost_adjacent: String(config.boost_adjacent) !== 'false',
          last_district_keys: lastUploaded ? lastUploaded.district_keys : null,
          deviceName: config.device_name || 'Garmin Forerunner 975',
        });
      } catch (genErr) {
        if (genErr.code === 'NO_VALID_TIME_SLOT') {
          console.warn(`[Scheduler] Account ${accountId}: No valid time slot available. Saving failed record.`);
          await db.saveActivity(accountId, {
            activity_name: 'Không thể tạo hoạt động',
            distance_km: 0, duration_min: 0, pace_min_km: 0,
            gpx_file: null, upload_status: 'failed',
            route_start_lat: null, route_start_lng: null,
            route_start_time: new Date().toISOString(),
            district_keys: null, created_by: slotName,
            error_message: genErr.message,
          });
          break; // Stop trying for this slot — no point retrying same day
        }
        throw genErr; // Other errors bubble up
      }

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

  const parseHM = (t) => {
    const [h, m] = (t || '00:00').split(':').map(Number);
    return h * 60 + m;
  };

  const time1 = config.schedule_time || '22:00';
  const time2 = config.schedule_time_2 || '14:00';
  const min1 = parseHM(time1);
  const min2 = parseHM(time2);

  // Always label the earlier slot as "Schedule 1" and the later as "Schedule 2"
  const slotA = min1 <= min2 ? { time: time1, label: 'Schedule 1' } : { time: time1, label: 'Schedule 2' };
  const slotB = min1 <= min2 ? { time: time2, label: 'Schedule 2' } : { time: time2, label: 'Schedule 1' };

  // First schedule
  if (config.schedule_enabled === 'true') {
    const [hA, mA] = slotA.time.split(':');
    const cronA = `${parseInt(mA)} ${parseInt(hA)} * * *`;
    
    if (cron.validate(cronA)) {
      const taskA = cron.schedule(cronA, async () => {
        console.log(`[Scheduler] ${slotA.label} triggered for account ${accountId}`);
        await executeJob(accountId, slotA.label);
      }, { timezone: 'Asia/Ho_Chi_Minh' });
      tasks.push(taskA);
      console.log(`[Scheduler] ${slotA.label} started for ${accountId}: ${cronA}`);
    }
  }

  // Second schedule
  if (parseInt(config.schedule_count) >= 2) {
    const [hB, mB] = slotB.time.split(':');
    const cronB = `${parseInt(mB)} ${parseInt(hB)} * * *`;
    
    if (cron.validate(cronB)) {
      const taskB = cron.schedule(cronB, async () => {
        console.log(`[Scheduler] ${slotB.label} triggered for account ${accountId}`);
        await executeJob(accountId, slotB.label);
      }, { timezone: 'Asia/Ho_Chi_Minh' });
      tasks.push(taskB);
      console.log(`[Scheduler] ${slotB.label} started for ${accountId}: ${cronB}`);
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
