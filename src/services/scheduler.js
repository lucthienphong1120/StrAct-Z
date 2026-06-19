/**
 * Scheduler Service - Manages cron jobs for automatic activity generation & upload
 */

const cron = require('node-cron');
const db = require('../db/database');
const fitGenerator = require('./fit-generator');
const gpxGenerator = require('./gpx-generator');
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

  let lockActivityId = null;

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

    // Resolve the scheduled slot time by sorting all active slots chronologically
    const count = parseInt(config.schedule_count) || 1;
    const parseHM = (t) => {
      const [h, m] = (t || '00:00').split(':').map(Number);
      return h * 60 + m;
    };

    const activeSlots = [];
    activeSlots.push({ time: config.schedule_time || systemLimits.schedule_time.default });
    if (count >= 2) {
      activeSlots.push({ time: config.schedule_time_2 || systemLimits.schedule_time_2.default });
    }
    if (count >= 3) {
      activeSlots.push({ time: config.schedule_time_3 || systemLimits.schedule_time_3.default });
    }

    activeSlots.sort((a, b) => parseHM(a.time) - parseHM(b.time));
    activeSlots.forEach((slot, index) => {
      slot.label = `Schedule ${index + 1}`;
    });

    const currentSlot = activeSlots.find(s => s.label === slotName);
    const slotTime = currentSlot ? currentSlot.time : null;

    // Check if custom time is enabled and if we should wait
    if (config.custom_time_enabled === 'true') {
      const targetTimeStr = config.target_time_custom || '00:00';
      const resolvedTargetDate = config.target_date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
      
      const customStartMs = new Date(`${resolvedTargetDate}T${targetTimeStr}:00.000+07:00`).getTime();
      const nowMs = Date.now();
      
      if (nowMs < customStartMs) {
        console.log(`[Scheduler] Current time (${new Date(nowMs).toISOString()}) is before custom time (${resolvedTargetDate} ${targetTimeStr}), skipping execution for account ${accountId}.`);
        isRunning.set(accountId, false);
        return { success: true, message: `Pending: Waiting until ${resolvedTargetDate} ${targetTimeStr} to trigger.` };
      }
      
      // If reached/passed, disable custom time so future schedulers run normally
      await db.setConfig(accountId, 'custom_time_enabled', 'false');
      config.custom_time_enabled = 'false'; // Update in-memory snapshot immediately
      console.log(`[Scheduler] Reached custom time (${resolvedTargetDate} ${targetTimeStr}). Disabled custom time flag for account ${accountId}`);
    }

    const minCount = parseInt(config.schedule_count_min) >= 0 ? parseInt(config.schedule_count_min) : systemLimits.schedule_count_min.default;
    const maxCount = parseInt(config.schedule_count_max) >= 1 ? parseInt(config.schedule_count_max) : systemLimits.schedule_count_max.default;

    // Random count within user config
    let taskCount = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
    if (taskCount > limits.schedule_count_max.max) taskCount = limits.schedule_count_max.max; // Dynamic safety cap

    if (taskCount <= 0) {
      console.log(`[Scheduler] Account ${accountId}: taskCount is 0, skipping.`);
      isRunning.set(accountId, false);
      return { success: true, message: 'No activities scheduled for this slot' };
    }

    const targetDate = new Date().toLocaleDateString('sv-SE', {timeZone: 'Asia/Ho_Chi_Minh'});
    const dbInstance = await db.getDb();

    // 1. Check if we already have a completed/failed activity for this slot today
    const startTimeUTC = new Date(`${targetDate}T00:00:00.000+07:00`).toISOString();
    const endTimeUTC = new Date(`${targetDate}T23:59:59.999+07:00`).toISOString();
    const completedCount = await dbInstance.get(
      `SELECT COUNT(*) as c FROM activities 
       WHERE account_id = ? 
         AND route_start_time >= ? 
         AND route_start_time <= ? 
         AND created_by = ? 
         AND upload_status IN ('uploaded', 'generated')`,
      [accountId, startTimeUTC, endTimeUTC, slotName]
    );

    if (completedCount && completedCount.c > 0) {
      console.log(`[Scheduler] Slot "${slotName}" already completed today (${targetDate}) for account ${accountId}. Skipping duplicate execution.`);
      isRunning.set(accountId, false);
      return { success: true, message: `Slot ${slotName} already executed today.` };
    }

    // 2. Insert our placeholder lock record
    lockActivityId = await db.saveActivity(accountId, {
      activity_name: 'Đang tạo tự động...',
      distance_km: 0,
      duration_min: 0,
      pace_min_km: 0,
      fit_file: null,
      upload_status: 'generating',
      route_start_lat: null,
      route_start_lng: null,
      route_start_time: new Date().toISOString(),
      district_keys: null,
      created_by: slotName,
    });

    // 3. Query all active generating locks for this slot today
    const activeLocks = await dbInstance.all(
      `SELECT id FROM activities 
       WHERE account_id = ? 
         AND route_start_time LIKE ? 
         AND created_by = ? 
         AND upload_status = 'generating'
       ORDER BY id ASC`,
      [accountId, `${targetDate}%`, slotName]
    );

    // If our lock is not the first one, we lost the race
    if (activeLocks.length > 0 && activeLocks[0].id !== lockActivityId) {
      console.log(`[Scheduler] Concurrency lock lost for slot "${slotName}" on account ${accountId}. Deleting placeholder.`);
      await db.deleteActivity(accountId, lockActivityId, true); // Hard delete our lock
      isRunning.set(accountId, false);
      return { success: true, message: 'Concurrency lock lost' };
    }

    // Get existing activities for today to avoid overlaps
    let localActivities = await db.getActivitiesByDate(accountId, targetDate);
    let stravaActivities = [];
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
    
    let totalActivitiesToday = 0;
    const seenTimesDailyCheck = [];
    for (const act of existingActivities) {
      if (act.upload_status === 'failed' || act.upload_status === 'deleted' || act.upload_status === 'generating' || act.upload_status === 'removed') continue;
      const startTime = act.start_date || act.route_start_time;
      if (!startTime) continue;
      const startMs = new Date(startTime).getTime();
      let isDuplicate = false;
      for (const seenMs of seenTimesDailyCheck) {
        if (Math.abs(seenMs - startMs) < 10 * 60 * 1000) { isDuplicate = true; break; }
      }
      if (!isDuplicate) {
        seenTimesDailyCheck.push(startMs);
        totalActivitiesToday++;
      }
    }

    const dailyMaxActivity = parseInt(config.daily_max_activity || '2');
    if (totalActivitiesToday >= dailyMaxActivity) {
      console.log(`[Scheduler] Account ${accountId}: Daily upload limit of ${dailyMaxActivity} already reached BEFORE generation (${totalActivitiesToday} act). Skipping.`);
      if (lockActivityId) await db.deleteActivity(accountId, lockActivityId, true);
      isRunning.set(accountId, false);
      return { success: true, message: `Giới hạn upload hàng ngày là ${dailyMaxActivity} đã đạt. Bỏ qua lịch trình.` };
    }

    for (let i = 0; i < taskCount; i++) {
      let activity;
      const lastUploaded = await db.getLastUploadedActivity(accountId);

      // Target distance calculation for the last activity of the last schedule.
      // Counts Strava Cloud activities + StrAct-Z uploaded activities only (not generated/failed).
      // Only applies when target not yet met; if already exceeded, uses basic random.
      let targetDistanceKmOverride = null;
      const isLastSchedule = slotName === `Schedule ${parseInt(config.schedule_count) || 1}`;
      const targetDistanceEnabled = config.target_distance_enabled === 'true' && config.custom_time_enabled !== 'true';

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
          const offsetKm = (Math.random() * 0.20) - 0.10; // random offset from -100m to +100m (-0.1km to +0.1km)
          const minDist = parseFloat(config.min_distance_km || '0.5');
          const maxDist = parseFloat(config.max_distance_km || '8.0');
          targetDistanceKmOverride = Math.max(minDist, Math.min(maxDist, remainingDistance + offsetKm));
          console.log(`[Scheduler] Target distance: ${dailyTarget}km, Done: ${accumulatedDistanceForToday.toFixed(2)}km, Remaining: ${remainingDistance.toFixed(2)}km → Override: ${targetDistanceKmOverride.toFixed(2)}km (bounds: ${minDist} - ${maxDist}km)`);
        } else {
          console.log(`[Scheduler] Daily target ${dailyTarget}km already met (${accumulatedDistanceForToday.toFixed(2)}km). Basic random.`);
        }
      }

      let generator;
      try {
        const isCustomTimeActive = (i === 0 && config.custom_time_enabled === 'true');
        const overrides = {};
        if (isCustomTimeActive) {
          // Let buildGeneratorConfig resolve target_date and custom_time from config
        } else {
          overrides.target_date = targetDate;
          overrides.custom_time_enabled = 'false';

          // Apply 8-hour relative time bounds toggle logic
          if (config.limit_schedule_time_window !== 'false' && slotTime) {
            const slotMins = parseHM(slotTime);
            const startMins = Math.max(0, slotMins - 8 * 60);

            const toHHMM = (mins) => {
              const hh = String(Math.floor(mins / 60)).padStart(2, '0');
              const mm = String(mins % 60).padStart(2, '0');
              return `${hh}:${mm}`;
            };

            const windowMinTime = toHHMM(startMins);
            const windowMaxTime = slotTime;

            const globalMinMins = parseHM(config.min_time || '04:30');
            const globalMaxMins = parseHM(config.max_time || '22:30');

            const intersectMinMins = Math.max(startMins, globalMinMins);
            const intersectMaxMins = Math.min(slotMins, globalMaxMins);

            if (intersectMinMins <= intersectMaxMins) {
              overrides.min_time = toHHMM(intersectMinMins);
              overrides.max_time = toHHMM(intersectMaxMins);
              console.log(`[Scheduler] Limiting schedule time window for ${slotName} (${slotTime}): [${overrides.min_time} - ${overrides.max_time}] (8h window intersected with global bounds [${config.min_time} - ${config.max_time}])`);
            } else {
              console.log(`[Scheduler] 8h window for ${slotName} (${slotTime}) has no overlap with global bounds [${config.min_time} - ${config.max_time}]. Falling back to global bounds.`);
            }
          }
        }

        const genConfig = buildGeneratorConfig(config, overrides, lastUploaded, role);
        genConfig.existingActivities = existingActivities;
        if (targetDistanceKmOverride !== null) {
          genConfig.targetDistanceKm = targetDistanceKmOverride;
        }
        
        let format = config.export_format || 'fit';
        const schedulerDeviceName = config.device_name || systemLimits.device_name.default;
        if (gpxGenerator.shouldForceGPX(schedulerDeviceName)) format = 'gpx';
        generator = format === 'gpx' ? gpxGenerator : fitGenerator;
        activity = await generator.generateActivity(genConfig);
      } catch (genErr) {
        if (genErr.code === 'NO_VALID_TIME_SLOT') {
          console.warn(`[Scheduler] Account ${accountId}: No valid time slot available. Saving failed record.`);
          const failData = {
            activity_name: 'Không thể tạo hoạt động',
            distance_km: 0, duration_min: 0, pace_min_km: 0,
            fit_file: null, upload_status: 'failed',
            route_start_lat: null, route_start_lng: null,
            route_start_time: new Date().toISOString(),
            district_keys: null, created_by: slotName,
            error_message: genErr.message,
          };
          if (i === 0 && lockActivityId) {
            await db.updateActivity(accountId, lockActivityId, failData);
          } else {
            await db.saveActivity(accountId, failData);
          }
          continue; // Skip trying for this item, continue to the next requested item
        }
        throw genErr; // Other errors bubble up
      }

      console.log(`[Scheduler] Generated: ${activity.activityName} at ${activity.startTime.toLocaleTimeString('vi-VN', { hour12: false })} - ${activity.distanceKm}km`);
      
      // Check if daily limit is reached
      if (totalActivitiesToday + successCount >= dailyMaxActivity) {
        console.log(`[Scheduler] Account ${accountId}: Daily upload limit of ${dailyMaxActivity} reached. Saving activity as FAILED.`);
        const failData = {
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
        };
        if (i === 0 && lockActivityId) {
          await db.updateActivity(accountId, lockActivityId, failData);
        } else {
          await db.saveActivity(accountId, failData);
        }
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
      let activityId;
      const activityData = {
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
      };

      if (i === 0 && lockActivityId) {
        await db.updateActivity(accountId, lockActivityId, activityData);
        activityId = lockActivityId;
      } else {
        activityId = await db.saveActivity(accountId, activityData);
      }

      // Upload to Strava
      console.log(`[Scheduler] Uploading activity ${i+1} to Strava...`);
      try {
        const deviceName = config.device_name || 'Garmin fēnix 7x Pro';
        const uploadResult = await stravaApi.uploadActivity(accountId, activity.filepath, {
          name: activity.activityName,
          description: generator ? generator.getShortDescription(deviceName) : '', // returns "" globally
          sportType: activity.activityType || 'Run',
        });

        console.log(`[Scheduler] Upload initiated, ID: ${uploadResult.id}`);

        // Wait for processing
        const finalStatus = await stravaApi.waitForUpload(accountId, uploadResult.id);

        console.log(`[Scheduler] Upload complete! Strava Activity ID: ${finalStatus.activity_id}`);

        // Update visibility if needed
        const visibility = config.strava_visibility || 'everyone';
        if (visibility !== 'everyone' && finalStatus.activity_id) {
          try {
            console.log(`[Scheduler] Updating activity ${finalStatus.activity_id} visibility to private/muted (hide_from_home: true)`);
            await stravaApi.updateActivity(accountId, finalStatus.activity_id, { hide_from_home: true });
          } catch (err) {
            console.error('[Scheduler] Failed to update activity visibility:', err);
          }
        }

        await db.updateActivity(accountId, activityId, {
          strava_activity_id: String(finalStatus.activity_id),
          upload_status: 'uploaded',
        });

        stravaApi.clearActivityCache(accountId);

        successCount++;
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



    return {
      success: successCount > 0,
      message: `Generated and uploaded ${successCount}/${taskCount} activities`,
      activity: lastActivity,
    };
  } catch (err) {
    console.error(`[Scheduler] Job failed for account ${accountId}:`, err);
    if (lockActivityId) {
      try {
        const dbInstance = await db.getDb();
        const currentLock = await dbInstance.get(`SELECT upload_status FROM activities WHERE id = ?`, [lockActivityId]);
        if (currentLock && currentLock.upload_status === 'generating') {
          await db.updateActivity(accountId, lockActivityId, {
            activity_name: 'Không thể tạo hoạt động',
            upload_status: 'failed',
            error_message: err.message,
          });
        }
      } catch (updateErr) {
        console.error(`[Scheduler] Failed to set lock status to failed:`, updateErr);
      }
    }
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

  const count = parseInt(config.schedule_count) || 1;
  const parseHM = (t) => {
    const [h, m] = (t || '00:00').split(':').map(Number);
    return h * 60 + m;
  };

  const activeSlots = [];
  activeSlots.push({ time: config.schedule_time || systemLimits.schedule_time.default });
  if (count >= 2) {
    activeSlots.push({ time: config.schedule_time_2 || systemLimits.schedule_time_2.default });
  }
  if (count >= 3) {
    activeSlots.push({ time: config.schedule_time_3 || systemLimits.schedule_time_3.default });
  }

  activeSlots.sort((a, b) => parseHM(a.time) - parseHM(b.time));
  activeSlots.forEach((slot, index) => {
    slot.label = `Schedule ${index + 1}`;
  });

  if (config.schedule_enabled !== 'true') {
    console.log(`[Scheduler] Auto schedule is disabled for account ${accountId}.`);
    return false;
  }

  for (const slot of activeSlots) {
    const [h, m] = slot.time.split(':');
    const cronStr = `${parseInt(m)} ${parseInt(h)} * * *`;
    
    if (cron.validate(cronStr)) {
      const task = cron.schedule(cronStr, async () => {
        console.log(`[Scheduler] ${slot.label} triggered for account ${accountId}`);
        await executeJob(accountId, slot.label);
      }, { timezone: 'Asia/Ho_Chi_Minh' });
      tasks.push(task);
      console.log(`[Scheduler] ${slot.label} started for ${accountId}: ${cronStr}`);
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

  const targetTimeStr = config.target_time_custom || '00:00';
  const resolvedTargetDate = config.target_date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  const customStartMs = new Date(`${resolvedTargetDate}T${targetTimeStr}:00.000+07:00`).getTime();
  const nowMs = Date.now();
  const customTimePending = config.custom_time_enabled === 'true' && (nowMs < customStartMs);

  return {
    enabled: config.schedule_enabled === 'true',
    scheduleTime: config.schedule_time || systemLimits.schedule_time.default,
    scheduleCount: count,
    scheduleTime2: config.schedule_time_2 || systemLimits.schedule_time_2.default,
    scheduleTime3: config.schedule_time_3 || systemLimits.schedule_time_3.default,
    limitScheduleTimeWindow: config.limit_schedule_time_window !== 'false',
    scheduleCountMin: parseInt(config.schedule_count_min) >= 0 ? parseInt(config.schedule_count_min) : systemLimits.schedule_count_min.default,
    scheduleCountMax: parseInt(config.schedule_count_max) >= 0 ? parseInt(config.schedule_count_max) : systemLimits.schedule_count_max.default,
    targetDistanceEnabled: config.target_distance_enabled === 'true',
    targetDistanceKm: parseFloat(config.target_distance_km || systemLimits.target_distance_km.default),
    customTimeEnabled: config.custom_time_enabled === 'true',
    customTimePending: customTimePending,
    targetDate: resolvedTargetDate,
    targetTimeCustom: config.target_time_custom || '00:00',
    isRunning: isRunning.get(accountId) || false,
    taskActive: scheduledTasks.has(accountId),
  };
}

/**
 * Update schedule for a specific account
 */
async function updateSchedule(accountId, enabled1, time1, scheduleCount, time2, countMin, countMax, targetDistanceEnabled, targetDistanceKm, time3, limitScheduleTimeWindow) {
  if (enabled1 !== undefined) await db.setConfig(accountId, 'schedule_enabled', enabled1 ? 'true' : 'false');
  if (time1) await db.setConfig(accountId, 'schedule_time', time1);
  
  if (scheduleCount !== undefined) await db.setConfig(accountId, 'schedule_count', scheduleCount);
  if (time2) await db.setConfig(accountId, 'schedule_time_2', time2);
  if (time3) await db.setConfig(accountId, 'schedule_time_3', time3);
  if (limitScheduleTimeWindow !== undefined) {
    await db.setConfig(accountId, 'limit_schedule_time_window', limitScheduleTimeWindow ? 'true' : 'false');
  }
  
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
        const fitPath = path.join(__dirname, '..', '..', 'data', 'activity', activity.fit_file);
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
