/**
 * FIT Generator v2 - async, OSRM-backed
 * Generates binary FIT files for running, walking, and cycling activities.
 */

const fs = require('fs');
const path = require('path');
const { FitWriter } = require('@markw65/fit-file-writer');
const {
  HANOI_DISTRICTS,
  generateRoute,
  generateElevation,
  generateTimestamps,
  generateHeartRate,
  generateCadence,
  randomInRange,
  haversineDistance,
} = require('./route-engine');
const systemLimits = require('../config/limits');
const { ADJACENT_DISTRICTS } = require('../config/districts');

const FIT_DIR = path.join(__dirname, '..', '..', 'data', 'fit');
fs.mkdirSync(FIT_DIR, { recursive: true });

function getShortDescription(deviceName) {
  return '';
}

function generateActivityName(activityType, date) {
  const hour = date.getHours();
  let timeOfDay = 'buổi tối';
  if (hour < 5) timeOfDay = 'rạng sáng';
  else if (hour < 10) timeOfDay = 'buổi sáng';
  else if (hour < 14) timeOfDay = 'buổi trưa';
  else if (hour < 18) timeOfDay = 'buổi chiều';

  let typeName = 'Chạy bộ';
  if (activityType.toLowerCase() === 'walk') typeName = 'Đi bộ';
  if (activityType.toLowerCase() === 'ride') typeName = 'Đạp xe';

  return `${typeName} ${timeOfDay}`;
}

/**
 * Tính diện tích giao nhau (Intersection Area) của 2 đường tròn
 */
function getCircleIntersectionArea(r1, r2, d) {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.pow(Math.min(r1, r2), 2);

  const r1Sq = r1 * r1;
  const r2Sq = r2 * r2;
  const dSq = d * d;

  const a1 = r1Sq * Math.acos((dSq + r1Sq - r2Sq) / (2 * d * r1));
  const a2 = r2Sq * Math.acos((dSq + r2Sq - r1Sq) / (2 * d * r2));
  
  // Heron's formula for triangle area
  const p = (r1 + r2 + d) / 2;
  const triangleArea = 2 * Math.sqrt(p * (p - r1) * (p - r2) * (p - d));

  return a1 + a2 - triangleArea;
}

/**
 * Maps a device name to Manufacturer and Product parameters for FIT file.
 */
function resolveDeviceParams(deviceName) {
  const nameLower = (deviceName || '').toLowerCase();
  
  let manufacturer = 1; // Default Garmin ID
  let product = 3907;   // Default fenix7x
  let productName = deviceName || 'Garmin fēnix 7x Pro';

  if (nameLower.includes('forerunner 945')) {
    manufacturer = 1; product = 3113; productName = 'Forerunner 945';
  } else if (nameLower.includes('forerunner 165')) {
    manufacturer = 1; product = 4533; productName = 'Forerunner 165';
  } else if (nameLower.includes('fenix 7') || nameLower.includes('fēnix 7')) {
    manufacturer = 1; product = 3907; productName = 'fēnix 7x Pro';
  } else if (nameLower.includes('fenix 8') || nameLower.includes('fēnix 8')) {
    manufacturer = 1; product = 4543; productName = 'fēnix 8';
  } else if (nameLower.includes('forerunner 255')) {
    manufacturer = 1; product = 4024; productName = 'Forerunner 255S';
  } else if (nameLower.includes('venu 2')) {
    manufacturer = 1; product = 3850; productName = 'Venu 2';
  } else if (nameLower.includes('instinct 3')) {
    manufacturer = 1; product = 4600; productName = 'Instinct 3';
  } else if (nameLower.includes('instinct 2x')) {
    manufacturer = 1; product = 4125; productName = 'Instinct 2X Solar';
  } else if (nameLower.includes('epix pro')) {
    manufacturer = 1; product = 4312; productName = 'Epix Pro (Gen 2)';
  } else if (nameLower.includes('pace 3')) {
    manufacturer = 125; product = 125; productName = 'PACE 3';
  } else if (nameLower.includes('apex 2 pro')) {
    manufacturer = 125; product = 126; productName = 'APEX 2 Pro';
  } else if (nameLower.includes('vertix 2s')) {
    manufacturer = 125; product = 127; productName = 'VERTIX 2S';
  } else if (nameLower.includes('race s')) {
    manufacturer = 23; product = 23; productName = 'Suunto Race S';
  } else if (nameLower.includes('vertical')) {
    manufacturer = 23; product = 24; productName = 'Suunto Vertical';
  } else if (nameLower.includes('t-rex 3')) {
    manufacturer = 292; product = 292; productName = 'Amazfit T-Rex 3';
  } else if (nameLower.includes('balance 2')) {
    manufacturer = 292; product = 293; productName = 'Amazfit Balance 2';
  } else if (nameLower.includes('active 3')) {
    manufacturer = 292; product = 294; productName = 'Amazfit Active';
  } else if (nameLower.includes('gt 6 pro')) {
    manufacturer = 201; product = 292; productName = 'Huawei Watch GT 6 Pro';
  } else if (nameLower.includes('fit 5 pro')) {
    manufacturer = 201; product = 293; productName = 'Huawei Watch Fit 5 Pro';
  } else if (nameLower.includes('gt 4 pro')) {
    manufacturer = 201; product = 294; productName = 'Huawei Watch GT 4 Pro';
  } else if (nameLower.includes('fit 3')) {
    manufacturer = 201; product = 295; productName = 'Huawei Watch Fit 3';
  } else if (nameLower.includes('ultimate')) {
    manufacturer = 201; product = 296; productName = 'Huawei Watch Ultimate';
  } else if (nameLower.includes('galaxy watch ultra')) {
    manufacturer = 258; product = 258; productName = 'Galaxy Watch Ultra';
  } else if (nameLower.includes('galaxy watch 8')) {
    manufacturer = 258; product = 259; productName = 'Galaxy Watch 8';
  } else if (nameLower.includes('galaxy watch 7')) {
    manufacturer = 258; product = 260; productName = 'Galaxy Watch 7';
  } else if (nameLower.includes('zepp')) {
    manufacturer = 292; product = 292; productName = 'Zepp App';
  } else if (nameLower.includes('apple') || nameLower.includes('sport')) {
    manufacturer = 263; product = 263; productName = 'Apple Watch';
  } else if (nameLower.includes('garmin')) {
    manufacturer = 1; product = 3907; productName = deviceName;
  } else if (nameLower.includes('coros')) {
    manufacturer = 125; product = 125; productName = deviceName;
  } else if (nameLower.includes('suunto')) {
    manufacturer = 23; product = 23; productName = deviceName;
  } else if (nameLower.includes('huami') || nameLower.includes('amazfit')) {
    manufacturer = 292; product = 292; productName = deviceName;
  } else if (nameLower.includes('huawei')) {
    manufacturer = 201; product = 292; productName = deviceName;
  } else if (nameLower.includes('samsung')) {
    manufacturer = 258; product = 258; productName = deviceName;
  }

  return { manufacturer, product, productName };
}

/**
 * Generate a complete activity and build a FIT binary file
 */
async function generateActivity(config = {}) {
  const {
    startLat = 21.0285,
    startLng = 105.8542,
    districtKey = null,
    minDistanceKm = 0.5,
    maxDistanceKm = 10,
    minPace = 7.0,
    maxPace = 15.0,
    activityNameTemplate = 'Morning Run',
    heartRateEnabled = true,
    minHeartRate = 130,
    maxHeartRate = 165,
    startTime = null,
    useOSRM = true,
    userRole = 'normal',
    deviceName = 'Garmin fēnix 7x Pro',
    simWeather = true,
    simRedLights = true,
  } = config;

  let { activityType = 'Random' } = config;
  const limits = systemLimits[userRole] || systemLimits.normal;

  // Determine Activity Type
  let finalActivityType = activityType;
  if (activityType === 'Random') {
    activityType = 'Random (misc)';
  }
  const weights = limits.activity_type?.weights?.[activityType];
  if (weights) {
    const r = Math.random();
    const runWeight = weights.Run || 0;
    const walkWeight = weights.Walk || 0;
    if (r < runWeight) {
      finalActivityType = 'Run';
    } else if (r < runWeight + walkWeight) {
      finalActivityType = 'Walk';
    } else {
      finalActivityType = 'Ride';
    }
  } else {
    if (activityType.toLowerCase().includes('walk')) finalActivityType = 'Walk';
    else if (activityType.toLowerCase().includes('ride')) finalActivityType = 'Ride';
    else finalActivityType = 'Run';
  }

  // Adjust Pace, Distance, HR based on Activity Type
  let finalMinDist = minDistanceKm;
  let finalMaxDist = maxDistanceKm;
  let finalMinPace = minPace;
  let finalMaxPace = maxPace;
  
  // Heart Rate Calculation based on MHR
  const mhr = parseInt(maxHeartRate || '160', 10);
  let finalMinHR = 80;
  let finalMaxHR = 160;

  const distMults = limits.dist_multipliers?.default || { Walk: 0.55, Ride: 2.3, Run: 1.0 };
  const paceMults = limits.pace_multipliers?.default || { Walk: 1.7, Ride: 0.45, Run: 1.0 };

  if (finalActivityType === 'Walk') {
    finalMinDist = minDistanceKm * distMults.Walk;
    finalMaxDist = maxDistanceKm * distMults.Walk;
    finalMinPace = minPace * paceMults.Walk;
    finalMaxPace = maxPace * paceMults.Walk;
    finalMinHR = Math.round(mhr * limits.hr_zones.Walk.min);
    finalMaxHR = Math.round(mhr * limits.hr_zones.Walk.max);
  } else if (finalActivityType === 'Ride') {
    finalMinDist = minDistanceKm * distMults.Ride;
    finalMaxDist = maxDistanceKm * distMults.Ride;
    finalMinPace = minPace * paceMults.Ride;
    finalMaxPace = maxPace * paceMults.Ride;
    finalMinHR = Math.round(mhr * limits.hr_zones.Ride.min);
    finalMaxHR = Math.round(mhr * limits.hr_zones.Ride.max);
  } else { // Run
    finalMinDist = minDistanceKm * (distMults.Run || 1.0);
    finalMaxDist = maxDistanceKm * (distMults.Run || 1.0);
    finalMinPace = minPace * (paceMults.Run || 1.0);
    finalMaxPace = maxPace * (paceMults.Run || 1.0);
    finalMinHR = Math.round(mhr * limits.hr_zones.Run.min);
    finalMaxHR = Math.round(mhr * limits.hr_zones.Run.max);
  }

  // Determine District
  const allowedDistricts = config.selected_districts ? config.selected_districts.split(',').filter(Boolean) : Object.keys(HANOI_DISTRICTS);
  const maxSpan = parseInt(config.max_district_span || '1', 10);
  const actualSpan = Math.max(1, Math.floor(Math.random() * maxSpan) + 1);
  
  let chosenDistrictKeys = [];
  if (!districtKey || districtKey === 'random') {
    const areas = config.activity_areas ? JSON.parse(config.activity_areas) : [];
    
    // Calculate weights for each allowed district (Base ratio 1:1)
    const weights = allowedDistricts.map(key => {
      const dist = HANOI_DISTRICTS[key];
      if (!dist) return 1.0;
      
      let weight = 1.0; 
      const distRadiusM = (dist.radiusKm || 1.5) * 1000;

      areas.forEach(area => {
        const d = haversineDistance(dist.lat, dist.lng, area.lat, area.lng);
        const areaRadiusM = area.radius;
        const distRadiusM = (dist.radiusKm || 1.5) * 1000;
        
        const intersectionArea = getCircleIntersectionArea(distRadiusM, areaRadiusM, d);
        const minArea = Math.PI * Math.pow(Math.min(distRadiusM, areaRadiusM), 2);
        const ratio = minArea > 0 ? intersectionArea / minArea : 0;
        
        if (ratio > 0) {
          const areaWeights = limits.activity_areas?.weights || {
            home: { fully: 7.0, mostly: 4.2, partially: 2.8 },
            work: { fully: 5.2, mostly: 3.0, partially: 1.5 }
          };
          if (area.type === 'home') {
            if (ratio >= 0.85) weight += areaWeights.home.fully;
            else if (ratio >= 0.35) weight += areaWeights.home.mostly;
            else weight += areaWeights.home.partially;
          } else if (area.type === 'work') {
            if (ratio >= 0.85) weight += areaWeights.work.fully;
            else if (ratio >= 0.35) weight += areaWeights.work.mostly;
            else weight += areaWeights.work.partially;
          }
        }
      });

      // Adjacent Boost Logic
      const boostAdjacent = config.boost_adjacent !== 'false' && config.boost_adjacent !== false;
      if (boostAdjacent && config.last_district_keys) {
        let lastKeys = [];
        try {
          lastKeys = typeof config.last_district_keys === 'string' && config.last_district_keys.startsWith('[') 
            ? JSON.parse(config.last_district_keys) 
            : config.last_district_keys.split(',');
        } catch(e) {
          lastKeys = [];
        }
        
        if (Array.isArray(lastKeys)) {
          let boostValue = 0;
          for (let lk of lastKeys) {
            if (lk === key) {
              const sameWeight = limits.boost_adjacent?.same_weight || 2.1;
              boostValue = Math.max(boostValue, sameWeight);
            } else if (ADJACENT_DISTRICTS[lk] && ADJACENT_DISTRICTS[lk].includes(key)) {
              const adjWeight = limits.boost_adjacent?.adjacent_weight || 1.4;
              boostValue = Math.max(boostValue, adjWeight);
            }
          }
          weight += boostValue;
        }
      }

      return weight;
    });

    // Weighted pick `span` districts
    let available = [...allowedDistricts];
    let availableWeights = [...weights];
    const span = Math.min(actualSpan, available.length);
    
    for (let i = 0; i < span && available.length > 0; i++) {
      const totalWeight = availableWeights.reduce((a, b) => a + b, 0);
      let r = Math.random() * totalWeight;
      let sum = 0;
      for (let j = 0; j < available.length; j++) {
        sum += availableWeights[j];
        if (r <= sum) {
          chosenDistrictKeys.push(available[j]);
          available.splice(j, 1);
          availableWeights.splice(j, 1);
          break;
        }
      }
    }
  } else if (HANOI_DISTRICTS[districtKey]) {
    chosenDistrictKeys = [districtKey];
  } else {
    const totalWeight = allowedDistricts.length;
    const r = Math.floor(Math.random() * totalWeight);
    chosenDistrictKeys = [allowedDistricts[r] || 'hoan_kiem'];
  }

  // Distance calculations
  let distanceKm;
  if (config.targetDistanceKm && parseFloat(config.targetDistanceKm) > 0) {
    const rawTarget = parseFloat(config.targetDistanceKm);
    const finalTarget = Math.max(finalMinDist, Math.min(finalMaxDist, Math.min(maxDistanceKm, rawTarget)));
    distanceKm = Math.round(finalTarget * 10) / 10;
  } else {
    distanceKm = Math.round(randomInRange(finalMinDist, finalMaxDist) * 10) / 10;
  }
  const avgPace = randomInRange(finalMinPace, finalMaxPace, true);

  // Time handling
  let activityStartTime = startTime;
  if (!activityStartTime) {
    const targetDateStr = config.targetDate || new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Ho_Chi_Minh'});
    const minTimeStr = config.minTime || '04:30';
    const maxTimeStr = config.maxTime || '21:30';

    const [minH, minM] = minTimeStr.split(':').map(Number);
    const [maxH, maxM] = maxTimeStr.split(':').map(Number);
    const minMs = (minH * 60 + minM) * 60000;
    const maxMs = (maxH * 60 + maxM) * 60000;

    const parseTimeMs = (tStr, defaultMs) => {
      if (!tStr) return defaultMs;
      const [h, m] = tStr.split(':').map(Number);
      return (h * 60 + m) * 60000;
    };
    
    const workStart1 = parseTimeMs(config.workStart1, 8 * 3600000);
    const workEnd1 = parseTimeMs(config.workEnd1, 11.5 * 3600000);
    const workStart2 = parseTimeMs(config.workStart2, 13.5 * 3600000);
    const workEnd2 = parseTimeMs(config.workEnd2, 17.5 * 3600000);

    const targetDateObj = new Date(`${targetDateStr}T00:00:00.000+07:00`);
    
    const safeMs = (parseInt(config.overlap_protection_minutes || limits.overlap_minutes || '30')) * 60000;
    const restPercent = parseInt(config.rest_time_percent || 50);
    const restMultiplier = restPercent / 100;
    const estimatedDurationMs = (avgPace * distanceKm) * 60000;

    const activeActivities = (config.existingActivities || []).filter(a => {
      if (a.upload_status !== undefined) {
        return a.upload_status === 'uploaded' || a.upload_status === 'generated';
      }
      return true;
    });

    const blockedRanges = activeActivities.map(a => {
      const start = new Date(a.start_date || a.route_start_time).getTime();
      const durationMs = (a.elapsed_time || (a.duration_min * 60)) * 1000;
      const dayStart = targetDateObj.getTime();
      const restMs = durationMs * restMultiplier;
      return {
        start: start - dayStart - safeMs - restMs,
        end: start - dayStart + durationMs + safeMs + restMs
      };
    });

    const isOverlap = (ms) => {
      const newDurationMs = estimatedDurationMs;
      const restMsOfNew = newDurationMs * restMultiplier;
      const msEnd = ms + newDurationMs;

      for (const a of activeActivities) {
        const aStart = new Date(a.start_date || a.route_start_time).getTime() - targetDateObj.getTime();
        const aDurationMs = (a.elapsed_time || (a.duration_min * 60)) * 1000;
        const aEnd = aStart + aDurationMs;
        const aRestMs = aDurationMs * restMultiplier;

        if (ms >= aStart - safeMs - aRestMs && ms < aEnd + safeMs + aRestMs) {
          return true;
        }

        if (ms < aStart) {
          if (msEnd + safeMs + restMsOfNew > aStart) {
            return true;
          }
        }
      }
      return false;
    };

    const isValidTime = (ms) => {
      const msEnd = ms + estimatedDurationMs;
      const isWorkOverlap = (s, e) => {
        if (s < workEnd1 && e > workStart1) return true;
        if (s < workEnd2 && e > workStart2) return true;
        return false;
      };

      const dayOfWeek = targetDateObj.getDay();
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

      if (isWeekday && isWorkOverlap(ms, msEnd)) return false;
      if (isOverlap(ms)) return false;
      return true;
    };

    const nowOffsetMs = new Date().getTime() - targetDateObj.getTime();
    const effectiveMaxMs = Math.min(maxMs, nowOffsetMs > 0 ? nowOffsetMs : maxMs);
    
    const intervals = [];
    if (minMs === maxMs) {
      if (isValidTime(minMs)) {
        intervals.push({ start: minMs, end: minMs, duration: 0 });
      }
    } else {
      const restMsOfNew = estimatedDurationMs * restMultiplier;
      const checkPoints = [minMs, workStart1, workEnd1, workStart2, workEnd2, effectiveMaxMs];
      blockedRanges.forEach(r => {
        if (r.start > minMs && r.start < effectiveMaxMs) checkPoints.push(r.start);
        if (r.end > minMs && r.end < effectiveMaxMs) checkPoints.push(r.end);
        const shiftMs = estimatedDurationMs + restMsOfNew;
        if (r.start - shiftMs > minMs && r.start - shiftMs < effectiveMaxMs) checkPoints.push(r.start - shiftMs);
      });
      checkPoints.sort((a, b) => a - b);
      
      for (let i = 0; i < checkPoints.length - 1; i++) {
        const start = checkPoints[i];
        const end = checkPoints[i+1];
        if (start >= end) continue;
        if (start >= minMs && end <= effectiveMaxMs && isValidTime((start + end) / 2)) {
          intervals.push({ start, end, duration: end - start });
        }
      }
    }

    let targetTime;
    if (intervals.length > 0) {
      if (minMs === maxMs) {
        targetTime = new Date(targetDateObj.getTime() + minMs);
      } else {
        const totalDuration = intervals.reduce((sum, int) => sum + int.duration, 0);
        let randomVal = Math.random() * totalDuration;
        let selectedOffset = intervals[0].start;
        
        for (const int of intervals) {
          if (randomVal <= int.duration) {
            selectedOffset = int.start + randomVal;
            break;
          }
          randomVal -= int.duration;
        }
        targetTime = new Date(targetDateObj.getTime() + selectedOffset);
      }
    } else {
      const err = new Error('Không còn khung giờ hợp lệ trong ngày hôm nay. Vui lòng kiểm tra lại cài đặt Avoid Workhours hoặc thử lại vào ngày mai.');
      err.code = 'NO_VALID_TIME_SLOT';
      throw err;
    }
    
    activityStartTime = targetTime;
  }

  // Generate route
  let points = await generateRoute({
    startLat,
    startLng,
    distanceKm,
    districtKeys: chosenDistrictKeys,
    useOSRM,
  });

  if (!points || points.length < 2) {
    throw new Error('Route generation returned too few points');
  }

  // Add elevation
  points = generateElevation(points, { baseElevation: randomInRange(5, 10), maxVariation: randomInRange(1.5, 3.5) });

  // Add timestamps
  points = generateTimestamps(points, { 
    startTime: activityStartTime, 
    avgPaceMinPerKm: avgPace, 
    simRedLights,
    redLightsProbability: limits.sim_redlights?.probability,
    redLightsMinDuration: limits.sim_redlights?.min_duration,
    redLightsMaxDuration: limits.sim_redlights?.max_duration
  });

  // Add heart rate
  if (heartRateEnabled) {
    points = generateHeartRate(points, { 
      minHR: finalMinHR, 
      maxHR: finalMaxHR, 
      simWeather, 
      startTime: activityStartTime,
      weatherProbability: limits.sim_weather?.probability,
      weatherHRMin: limits.sim_weather?.hr_increase_min,
      weatherHRMax: limits.sim_weather?.hr_increase_max
    });
  } else {
    for (const pt of points) {
      delete pt.heartRate;
    }
  }

  // Add cadence
  points = generateCadence(points);

  // Activity name
  const activityName = generateActivityName(finalActivityType, activityStartTime);

  // --- BUILD BINARY FIT FILE ---
  const fitWriter = new FitWriter();
  const start = fitWriter.time(activityStartTime);
  
  // Resolve device parameters
  const devParams = resolveDeviceParams(deviceName);
  const serialNumber = 1234567; // Simulated

  // 1. file_id
  fitWriter.writeMessage(
    "file_id",
    {
      type: "activity",
      manufacturer: devParams.manufacturer,
      product: devParams.product,
      serial_number: serialNumber,
      time_created: start
    },
    null,
    true
  );

  // 2. device_info
  fitWriter.writeMessage(
    "device_info",
    {
      timestamp: start,
      device_index: 0, // creator
      manufacturer: devParams.manufacturer,
      product: devParams.product,
      serial_number: serialNumber,
      product_name: devParams.productName,
      software_version: 2.0
    },
    null,
    true
  );

  // 3. sport
  let fitSport = "running";
  let fitSubSport = "generic";
  if (finalActivityType === 'Walk') {
    fitSport = "walking";
    fitSubSport = "generic";
  } else if (finalActivityType === 'Ride') {
    fitSport = "cycling";
    fitSubSport = "generic";
  }

  fitWriter.writeMessage(
    "sport",
    {
      sport: fitSport,
      sub_sport: fitSubSport,
      name: finalActivityType
    },
    null,
    true
  );

  // 4. record trackpoints
  points.forEach((pt, index) => {
    const recordMsg = {
      timestamp: fitWriter.time(pt.time),
      position_lat: fitWriter.latlng(pt.lat * Math.PI / 180),
      position_long: fitWriter.latlng(pt.lng * Math.PI / 180),
      altitude: pt.elevation,
      distance: pt.distance,
    };
    
    // Compute speed (m/s)
    if (index > 0) {
      const timeDeltaSec = (pt.time - points[index - 1].time) / 1000;
      const distDeltaM = pt.distance - points[index - 1].distance;
      recordMsg.speed = timeDeltaSec > 0 ? distDeltaM / timeDeltaSec : 0;
    } else {
      recordMsg.speed = 0;
    }

    if (heartRateEnabled && pt.heartRate) {
      recordMsg.heart_rate = pt.heartRate;
    }
    if (pt.cadence) {
      recordMsg.cadence = pt.cadence;
    }

    fitWriter.writeMessage(
      "record",
      recordMsg,
      null,
      index === points.length - 1
    );
  });

  const totalElapsedTime = Math.round((points[points.length - 1].time - points[0].time) / 1000);
  const totalDistance = points[points.length - 1].distance;
  const calories = Math.round(
    finalActivityType === 'Walk' ? 50 * (totalDistance / 1000) :
    finalActivityType === 'Ride' ? 30 * (totalDistance / 1000) :
    75 * (totalDistance / 1000)
  );

  // 5. lap
  fitWriter.writeMessage(
    "lap",
    {
      start_time: start,
      timestamp: fitWriter.time(points[points.length - 1].time),
      total_elapsed_time: totalElapsedTime,
      total_timer_time: totalElapsedTime,
      total_distance: totalDistance,
      total_calories: calories
    },
    null,
    true
  );

  // 6. session
  fitWriter.writeMessage(
    "session",
    {
      start_time: start,
      timestamp: fitWriter.time(points[points.length - 1].time),
      total_elapsed_time: totalElapsedTime,
      total_timer_time: totalElapsedTime,
      total_distance: totalDistance,
      sport: fitSport,
      sub_sport: fitSubSport,
      first_lap_index: 0,
      num_laps: 1,
      total_calories: calories
    },
    null,
    true
  );

  // 7. activity
  fitWriter.writeMessage(
    "activity",
    {
      timestamp: start,
      total_timer_time: totalElapsedTime,
      num_sessions: 1,
      type: "manual",
      local_timestamp: start + 7 * 3600 // Hanoi GMT+7 offset
    },
    null,
    true
  );

  const view = fitWriter.finish();
  const fitBuffer = Buffer.from(view.buffer, view.byteOffset, view.byteLength);

  // Save FIT file
  const timestamp = activityStartTime.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `run_${timestamp}.fit`;
  const filepath = path.join(FIT_DIR, filename);
  fs.writeFileSync(filepath, fitBuffer);

  const actualDuration = (points[points.length - 1].time - points[0].time) / 60000;
  const actualDistance = points[points.length - 1].distance / 1000;

  return {
    filename, filepath, activityName,
    activityType: finalActivityType,
    distanceKm: Math.round(actualDistance * 10) / 10,
    durationMin: Math.round(actualDuration * 10) / 10,
    paceMinKm: Math.round(avgPace * 10) / 10,
    startTime: activityStartTime,
    startLat: points[0].lat,
    startLng: points[0].lng,
    numPoints: points.length,
    districtKey: chosenDistrictKeys.join(','),
    fitBuffer,
  };
}

module.exports = { generateActivity, FIT_DIR, HANOI_DISTRICTS, getShortDescription };
