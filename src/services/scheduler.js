/**
 * Scheduler Service - Manages cron jobs for automatic activity generation & upload
 */

const cron = require('node-cron');
const db = require('../db/database');
const { generateActivity, getShortDescription } = require('./fit-generator');
const stravaApi = require('./strava-api');
const googleFit = require('./google-fit');
const systemLimits = require('../config/limits');
const { buildGeneratorConfig } = require('../utils/activity-config-builder');
const fs = require('fs');
const path = require('path');


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

    // Clear activities cache to ensure scheduled job starts with fresh data
    stravaApi.clearActivityCache(accountId);

    // Note: Scheduled activities are NOT limited by daily_upload_limit.
    // They are only limited by schedule_count_min and schedule_count_max config.
    const config = await db.getAllConfig(accountId);
    const role = await db.getAccountRole(accountId);
    const limits = systemLimits[role] || systemLimits.basic;

    const minCount = parseInt(config.schedule_count_min) >= 0 ? parseInt(config.schedule_count_min) : systemLimits.schedule_count_min.default;
    const maxCount = parseInt(config.schedule_count_max) >= 1 ? parseInt(config.schedule_count_max) : systemLimits.schedule_count_max.default;

    // Random count within user config
    let taskCount = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
    if (taskCount > limits.schedule_count_max.max) taskCount = limits.schedule_count_max.max; // Dynamic safety cap

    if (taskCount <= 0) {
      console.log(`[Scheduler] Account ${accountId}: taskCount is 0, skipping.`);
      return { success: true, message: 'No activities scheduled for this slot' };
    }

    // Get existing activities for today to avoid overlaps
    const targetDate = new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Ho_Chi_Minh'});
    let localActivities = await db.getActivitiesByDate(accountId, targetDate);
    if (await stravaApi.isAuthenticated(accountId)) {
      try {
        const after = Math.floor(new Date(`${targetDate}T00:00:00.000+07:00`).getTime() / 1000) - 1;
        stravaActivities = await stravaApi.getActivities(accountId, 1, 50, after, false);
        stravaActivities = stravaActivities.filter(a => (a.start_date_local || a.start_date).startsWith(targetDate));
        // Re-read local activities after getActivities automatically synced them
        localActivities = await db.getActivitiesByDate(accountId, targetDate);
      } catch (e) { console.warn(`[Scheduler] Strava fetch failed for account ${accountId}`); }
    }
    
    let existingActivities = [...localActivities, ...stravaActivities];

    const sysL = limits;
    console.log(`[Scheduler] Account ${accountId} will generate ${taskCount} activities...`);
    
    let lastActivity = null;
    let successCount = 0;
    let currentStravaCount = stravaActivities.length;

    for (let i = 0; i < taskCount; i++) {
      let activity;
      const lastUploaded = await db.getLastUploadedActivity(accountId);

      // Target distance calculation for the last activity of the last schedule.
      // Counts Strava Cloud activities + StrAct-Z uploaded activities only (not generated/failed).
      // Only applies when target not yet met; if already exceeded, uses basic random.
      let targetDistanceKmOverride = null;
      const isLastSchedule = (parseInt(config.schedule_count) === 1) || (slotName === 'Schedule 2');
      const targetDistanceEnabled = config.target_distance_enabled === 'true';

      if (targetDistanceEnabled && isLastSchedule && (i === taskCount - 1)) {
        let accumulatedDistanceForToday = 0;
        // seenTimes deduplicates activities that exist in both local DB (uploaded) and Strava Cloud
        const seenTimes = [];

        for (const act of existingActivities) {
          const startTime = act.start_date || act.route_start_time;
          if (!startTime) continue;
          const startMs = new Date(startTime).getTime();
          
          let isDuplicate = false;
          for (const seenMs of seenTimes) {
            if (Math.abs(seenMs - startMs) < 10 * 60 * 1000) { // 10 minutes tolerance
              isDuplicate = true;
              break;
            }
          }
          if (isDuplicate) continue;

          let dist = 0;
          if (act.distance_km !== undefined) {
            // Local DB activity: only count uploaded (same as Activity Insights)
            if (act.upload_status === 'uploaded') {
              dist = parseFloat(act.distance_km);
            }
          } else if (act.distance !== undefined) {
            // Strava Cloud activity: distance is in meters
            dist = parseFloat(act.distance) / 1000;
          }

          if (dist > 0) {
            accumulatedDistanceForToday += dist;
            seenTimes.push(startMs);
          }
        }

        const dailyTarget = parseFloat(config.target_distance_km || '10.0');
        let remainingDistance = dailyTarget - accumulatedDistanceForToday;

        if (remainingDistance > 0) {
          const sign = Math.random() < 0.5 ? -1 : 1;
          const offsetKm = sign * (Math.random() * (0.20 - 0.05) + 0.05); // +/- (50m to 200m)
          const rawOverride = Math.max(0.1, remainingDistance + offsetKm);
          const maxDist = parseFloat(config.max_distance_km || '8.0');
          targetDistanceKmOverride = Math.min(maxDist, rawOverride);
          console.log(`[Scheduler] Target distance: ${dailyTarget}km, Done: ${accumulatedDistanceForToday.toFixed(2)}km, Remaining: ${remainingDistance.toFixed(2)}km → Override: ${targetDistanceKmOverride.toFixed(2)}km (max: ${maxDist}km)`);
        } else {
          console.log(`[Scheduler] Daily target ${dailyTarget}km already met (${accumulatedDistanceForToday.toFixed(2)}km). Basic random.`);
        }
      }

      try {
        const isCustomTimeActive = (i === 0 && config.custom_time_enabled === 'true');
        const overrides = {};
        if (isCustomTimeActive) {
          // Let buildGeneratorConfig resolve target_date and custom_time from config
        } else {
          overrides.target_date = targetDate;
          overrides.custom_time_enabled = 'false';
        }

        const genConfig = buildGeneratorConfig(config, overrides, lastUploaded, role);
        genConfig.existingActivities = existingActivities;
        if (targetDistanceKmOverride !== null) {
          genConfig.targetDistanceKm = targetDistanceKmOverride;
        }
        activity = await generateActivity(genConfig);
      } catch (genErr) {
        if (genErr.code === 'NO_VALID_TIME_SLOT') {
          console.warn(`[Scheduler] Account ${accountId}: No valid time slot available. Saving failed record.`);
          await db.saveActivity(accountId, {
            activity_name: 'Không thể tạo hoạt động',
            distance_km: 0, duration_min: 0, pace_min_km: 0,
            fit_file: null, upload_status: 'failed',
            route_start_lat: null, route_start_lng: null,
            route_start_time: new Date().toISOString(),
            district_keys: null, created_by: slotName,
            error_message: genErr.message,
          });
          continue; // Skip trying for this item, continue to the next requested item
        }
        throw genErr; // Other errors bubble up
      }

      console.log(`[Scheduler] Generated: ${activity.activityName} at ${activity.startTime.toLocaleTimeString('vi-VN', { hour12: false })} - ${activity.distanceKm}km`);
      
      // Check if daily limit is reached
      const dailyMaxActivity = parseInt(config.daily_max_activity || '2');
      if (currentStravaCount >= dailyMaxActivity) {
        console.log(`[Scheduler] Account ${accountId}: Daily upload limit of ${dailyMaxActivity} reached. Saving activity as FAILED.`);
        await db.saveActivity(accountId, {
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
          created_by: slotName,
          error_message: `Giới hạn upload hàng ngày là ${dailyMaxActivity}. Vui lòng xóa bớt trên Strava để tiếp tục.`,
        });
        continue;
      }

      // Add to existingActivities for next iteration check
      existingActivities.push({
        start_date: activity.startTime.toISOString(),
        duration_min: activity.durationMin,
        distance_km: activity.distanceKm,
        upload_status: 'generated'
      });

      // Save to database
      const activityId = await db.saveActivity(accountId, {
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
        created_by: slotName,
      });

      // Upload to Strava
      console.log(`[Scheduler] Uploading activity ${i+1} to Strava...`);
      try {
        const deviceName = config.device_name || 'Garmin fēnix 7x Pro';
        const uploadResult = await stravaApi.uploadActivity(accountId, activity.filepath, {
          name: activity.activityName,
          description: getShortDescription(deviceName), // returns "" globally
          sportType: activity.activityType || 'Run',
        });

        console.log(`[Scheduler] Upload initiated, ID: ${uploadResult.id}`);

        // Wait for processing
        const finalStatus = await stravaApi.waitForUpload(accountId, uploadResult.id);

        console.log(`[Scheduler] Upload complete! Strava Activity ID: ${finalStatus.activity_id}`);

        await db.updateActivity(accountId, activityId, {
          strava_activity_id: String(finalStatus.activity_id),
          upload_status: 'uploaded',
        });

        stravaApi.clearActivityCache(accountId);

        successCount++;
        currentStravaCount++;
        lastActivity = {
          ...activity,
          stravaActivityId: finalStatus.activity_id,
        };

        
      } catch (uploadErr) {
        console.error('[Scheduler] Upload failed:', uploadErr);
        await db.updateActivity(accountId, activityId, {
          upload_status: 'failed',
          error_message: typeof uploadErr === 'object' ? JSON.stringify(uploadErr.body || uploadErr.message || uploadErr) : String(uploadErr),
        });
      }

      // Brief delay between activities if multiple
      if (i < taskCount - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } // end for

    if (config.custom_time_enabled === 'true') {
      await db.setConfig(accountId, 'custom_time_enabled', 'false');
      console.log(`[Scheduler] Disabled custom time after running custom schedule for account ${accountId}`);
    }

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

  const time1 = config.schedule_time || systemLimits.schedule_time.default;
  const time2 = config.schedule_time_2 || systemLimits.schedule_time_2.default;
  const min1 = parseHM(time1);
  const min2 = parseHM(time2);

  // Always label the earlier slot as "Schedule 1" and the later as "Schedule 2"
  const slotA = min1 <= min2 ? { time: time1, label: 'Schedule 1' } : { time: time1, label: 'Schedule 2' };
  const slotB = min1 <= min2 ? { time: time2, label: 'Schedule 2' } : { time: time2, label: 'Schedule 1' };

  if (config.schedule_enabled !== 'true') {
    console.log(`[Scheduler] Auto schedule is disabled for account ${accountId}.`);
    return false;
  }

  // First schedule
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
    scheduleTime: config.schedule_time || systemLimits.schedule_time.default,
    scheduleCount: count,
    scheduleTime2: config.schedule_time_2 || systemLimits.schedule_time_2.default,
    scheduleCountMin: parseInt(config.schedule_count_min) >= 0 ? parseInt(config.schedule_count_min) : systemLimits.schedule_count_min.default,
    scheduleCountMax: parseInt(config.schedule_count_max) >= 0 ? parseInt(config.schedule_count_max) : systemLimits.schedule_count_max.default,
    targetDistanceEnabled: config.target_distance_enabled === 'true',
    targetDistanceKm: parseFloat(config.target_distance_km || systemLimits.target_distance_km.default),
    isRunning: isRunning.get(accountId) || false,
    taskActive: scheduledTasks.has(accountId),
  };
}

/**
 * Update schedule for a specific account
 */
async function updateSchedule(accountId, enabled1, time1, scheduleCount, time2, countMin, countMax, targetDistanceEnabled, targetDistanceKm) {
  if (enabled1 !== undefined) await db.setConfig(accountId, 'schedule_enabled', enabled1 ? 'true' : 'false');
  if (time1) await db.setConfig(accountId, 'schedule_time', time1);
  
  if (scheduleCount !== undefined) await db.setConfig(accountId, 'schedule_count', scheduleCount);
  if (time2) await db.setConfig(accountId, 'schedule_time_2', time2);
  
  if (countMin !== undefined && countMin !== null) await db.setConfig(accountId, 'schedule_count_min', countMin);
  if (countMax !== undefined && countMax !== null) await db.setConfig(accountId, 'schedule_count_max', countMax);

  if (targetDistanceEnabled !== undefined) {
    await db.setConfig(accountId, 'target_distance_enabled', targetDistanceEnabled ? 'true' : 'false');
  }
  if (targetDistanceKm !== undefined && targetDistanceKm !== null) {
    await db.setConfig(accountId, 'target_distance_km', String(targetDistanceKm));
  }

  await startScheduler(accountId);
}

/**
 * Cleanup FIT files of uploaded activities older than 30 days
 */
async function cleanupOldFITFiles() {
  console.log('[Scheduler] Starting FIT cleanup job...');
  try {
    const dbInstance = await db.getDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffStr = cutoffDate.toISOString();
    
    const activities = await dbInstance.all(
      `SELECT id, fit_file FROM activities 
       WHERE upload_status = 'uploaded' 
         AND fit_file IS NOT NULL 
         AND created_at < ?`,
      [cutoffStr]
    );

    console.log(`[Scheduler] Found ${activities.length} FIT files older than 30 days to clean up`);
    let deletedCount = 0;
    
    for (const activity of activities) {
      if (activity.fit_file) {
        const fitPath = path.join(__dirname, '..', '..', 'data', 'fit', activity.fit_file);
        try {
          if (fs.existsSync(fitPath)) {
            fs.unlinkSync(fitPath);
            deletedCount++;
          }
          await dbInstance.run(
            `UPDATE activities SET fit_file = NULL WHERE id = ?`,
            [activity.id]
          );
        } catch (e) {
          console.error(`[Scheduler] Failed to delete FIT file ${activity.fit_file}:`, e.message);
        }
      }
    }
    console.log(`[Scheduler] Successfully deleted ${deletedCount} FIT files`);
  } catch (err) {
    console.error('[Scheduler] Error during FIT cleanup:', err.message);
  }
}

/**
 * Gracefully stop all scheduled crons and wait for active jobs
 */
async function stopAll() {
  console.log('[Scheduler] Stopping all scheduled cron tasks...');
  for (const accountId of scheduledTasks.keys()) {
    stopScheduler(accountId);
  }

  let retries = 8;
  while (Array.from(isRunning.values()).some(running => running) && retries > 0) {
    console.log('[Scheduler] Waiting for active jobs to complete...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    retries--;
  }
  
  if (retries === 0) {
    console.log('[Scheduler] Force stopping: some jobs are still running.');
  } else {
    console.log('[Scheduler] All jobs completed and schedulers stopped.');
  }
}

// Schedule FIT file cleanup to run once a week on Sunday at 03:00 AM
cron.schedule('0 3 * * 0', async () => {
  await cleanupOldFITFiles();
}, { timezone: 'Asia/Ho_Chi_Minh' });

module.exports = {
  executeJob,
  startScheduler,
  startAllSchedulers,
  stopScheduler,
  getStatus,
  updateSchedule,
  cleanupOldFITFiles,
  stopAll,
};
