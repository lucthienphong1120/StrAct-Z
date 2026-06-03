/**
 * GPX Generator v2 - async, OSRM-backed
 */

const fs = require('fs');
const path = require('path');
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

const GPX_DIR = path.join(__dirname, '..', '..', 'data', 'gpx');
fs.mkdirSync(GPX_DIR, { recursive: true });

function getShortDescription(deviceName) {
  if (!deviceName) return 'Garmin Connect';
  const name = deviceName.toLowerCase();
  if (name.includes('garmin')) return 'Garmin Connect';
  if (name.includes('huawei')) return 'Huawei Health';
  if (name.includes('samsung')) return 'Samsung Health';
  if (name.includes('apple')) return 'Apple Health';
  if (name.includes('coros')) return 'COROS';
  if (name.includes('amazfit')) return 'Zepp App';
  if (name.includes('strava')) return 'Strava Android App';
  return 'Garmin Connect';
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

function formatGPXTime(date) { return date.toISOString(); }

function escapeXml(str) {
  if (!str) return '';
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
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

function buildGPX(points, options = {}) {
  const { activityName = 'Morning Run', activityType = 'running', includeHeartRate = true, includeCadence = true, deviceName = 'Garmin Connect' } = options;

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${escapeXml(deviceName)}"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd
                      http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd">
  <metadata>
    <name>${escapeXml(activityName)}</name>
    <time>${formatGPXTime(points[0].time)}</time>
  </metadata>
  <trk>
    <name>${escapeXml(activityName)}</name>
    <type>${activityType}</type>
    <trkseg>`;

  for (const pt of points) {
    gpx += `
      <trkpt lat="${pt.lat.toFixed(7)}" lon="${pt.lng.toFixed(7)}">
        <ele>${pt.elevation.toFixed(1)}</ele>
        <time>${formatGPXTime(pt.time)}</time>`;
    if ((includeHeartRate && pt.heartRate) || (includeCadence && pt.cadence)) {
      gpx += `
        <extensions>
          <gpxtpx:TrackPointExtension>`;
      if (includeHeartRate && pt.heartRate) gpx += `
            <gpxtpx:hr>${pt.heartRate}</gpxtpx:hr>`;
      if (includeCadence && pt.cadence) gpx += `
            <gpxtpx:cad>${pt.cadence}</gpxtpx:cad>`;
      gpx += `
          </gpxtpx:TrackPointExtension>
        </extensions>`;
    }
    gpx += `
      </trkpt>`;
  }

  gpx += `
    </trkseg>
  </trk>
</gpx>`;
  return gpx;
}

/**
 * Generate a complete activity (async - uses OSRM)
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
    activityType = 'Random',
    heartRateEnabled = true,
    minHeartRate = 130, // base limits from UI
    maxHeartRate = 165,
    startTime = null,
    useOSRM = true,
    userRole = 'normal',
    deviceName = 'Garmin Forerunner 975',
    simWeather = true,
    simRedLights = true,
  } = config;

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
    // Fallback if weights mapping is not found
    if (activityType.toLowerCase().includes('walk')) finalActivityType = 'Walk';
    else if (activityType.toLowerCase().includes('ride')) finalActivityType = 'Ride';
    else finalActivityType = 'Run';
  }

  // Adjust Pace, Distance, HR based on Activity Type
  let finalMinDist = minDistanceKm;
  let finalMaxDist = maxDistanceKm;
  let finalMinPace = minPace;
  let finalMaxPace = maxPace;
  
  // Heart Rate Calculation based on MHR (Max Heart Rate from UI/Config)
  const mhr = parseInt(maxHeartRate || '160', 10);
  let finalMinHR = 80;
  let finalMaxHR = 160;

  if (finalActivityType === 'Walk') {
    finalMinDist = minDistanceKm * 0.55;
    finalMaxDist = maxDistanceKm * 0.55;
    finalMinPace = minPace * 1.7;
    finalMaxPace = maxPace * 1.7;
    // HR Zones from config
    finalMinHR = Math.round(mhr * limits.hr_zones.Walk.min);
    finalMaxHR = Math.round(mhr * limits.hr_zones.Walk.max);
  } else if (finalActivityType === 'Ride') {
    finalMinDist = minDistanceKm * 2.3;
    finalMaxDist = maxDistanceKm * 2.3;
    finalMinPace = minPace * 0.45;
    finalMaxPace = maxPace * 0.45;
    finalMinHR = Math.round(mhr * limits.hr_zones.Ride.min);
    finalMaxHR = Math.round(mhr * limits.hr_zones.Ride.max);
  } else { // Run
    finalMinDist = minDistanceKm;
    finalMaxDist = maxDistanceKm;
    finalMinPace = minPace * 1.0;
    finalMaxPace = maxPace * 1.0;
    finalMinHR = Math.round(mhr * limits.hr_zones.Run.min);
    finalMaxHR = Math.round(mhr * limits.hr_zones.Run.max);
  }

  // Determine District (Random if 'random' or not provided)
  const allowedDistricts = config.selected_districts ? config.selected_districts.split(',').filter(Boolean) : Object.keys(HANOI_DISTRICTS);
  const maxSpan = parseInt(config.max_district_span || '1', 10);
  
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
        
        // Tính diện tích giao nhau
        const intersectionArea = getCircleIntersectionArea(distRadiusM, areaRadiusM, d);
        
        // Tính tỷ lệ bao phủ dựa trên đường tròn nhỏ hơn
        const minArea = Math.PI * Math.pow(Math.min(distRadiusM, areaRadiusM), 2);
        const ratio = minArea > 0 ? intersectionArea / minArea : 0;
        
        if (ratio > 0) {
          if (area.type === 'home') {
            if (ratio >= 0.85) weight += 4.5;      // Bao trọn / Nằm trọn
            else if (ratio >= 0.35) weight += 3.2; // Nhiều
            else weight += 1.8;                    // Ít
          } else if (area.type === 'work') {
            if (ratio >= 0.85) weight += 2.5;      // Bao trọn / Nằm trọn
            else if (ratio >= 0.35) weight += 1.2; // Nhiều
            else weight += 0.8;                    // Ít
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
          let isAdjacent = false;
          for (let lk of lastKeys) {
            if (ADJACENT_DISTRICTS[lk] && ADJACENT_DISTRICTS[lk].includes(key)) {
              isAdjacent = true;
              break;
            }
          }
          if (isAdjacent) {
            weight += 1.2;
          }
        }
      }

      return weight;
    });

    // Print debug log for weight ratios
    const totalWeightSum = weights.reduce((a, b) => a + b, 0);
    console.log(`[District Selection] Weight distribution for allowed districts:`);
    allowedDistricts.forEach((key, index) => {
      const w = weights[index];
      const dist = HANOI_DISTRICTS[key];
      const name = dist ? dist.name : key;
      const percent = totalWeightSum > 0 ? ((w / totalWeightSum) * 100).toFixed(2) : 0;
      console.log(`  - District "${name}" (${key}): weight = ${w.toFixed(2)} (${percent}%)`);
    });

    // Weighted pick `span` districts
    let available = [...allowedDistricts];
    let availableWeights = [...weights];
    const span = Math.min(maxSpan, available.length);
    
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
    // Unknown districtKey: fall back to weighted random selection
    console.warn(`[Generator] Unknown districtKey "${districtKey}", falling back to weighted random.`);
    districtKey = null; // force re-entry into weighted pick
    const totalWeight = allowedDistricts.length;
    const r = Math.floor(Math.random() * totalWeight);
    chosenDistrictKeys = [allowedDistricts[r] || 'hoan_kiem'];
  }

  // Randomize distance and pace
  const distanceKm = Math.round(randomInRange(finalMinDist, finalMaxDist) * 10) / 10;
  const avgPace = randomInRange(finalMinPace, finalMaxPace, true);

  // Handle Random Time Generation if startTime is not explicitly provided
  let activityStartTime = startTime;
  if (!activityStartTime) {
    const targetDateStr = config.targetDate || new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Ho_Chi_Minh'});
    const minTimeStr = config.minTime || '04:30';
    const maxTimeStr = config.maxTime || '21:30';

    const [minH, minM] = minTimeStr.split(':').map(Number);
    const [maxH, maxM] = maxTimeStr.split(':').map(Number);
    const minMs = (minH * 60 + minM) * 60000;
    const maxMs = (maxH * 60 + maxM) * 60000;

    // Define working hours in ms
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
    
    // Blocked intervals from existing activities + safe time
    const safeMs = (parseInt(config.overlap_protection_minutes || limits.overlap_minutes || '30')) * 60000;
    const restPercent = parseInt(config.rest_time_percent || (limits.rest_time_percent ? limits.rest_time_percent.default : 50) || '50');
    const restMultiplier = restPercent / 100;
    const estimatedDurationMs = (avgPace * distanceKm) * 60000;

    const blockedRanges = (config.existingActivities || []).map(a => {
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

      for (const a of config.existingActivities || []) {
        const aStart = new Date(a.start_date || a.route_start_time).getTime() - targetDateObj.getTime();
        const aDurationMs = (a.elapsed_time || (a.duration_min * 60)) * 1000;
        const aEnd = aStart + aDurationMs;
        const aRestMs = aDurationMs * restMultiplier;

        // Rule 1: The start time 'ms' must not fall within the forbidden range:
        // [aStart - safeMs - aRestMs, aEnd + safeMs + aRestMs]
        if (ms >= aStart - safeMs - aRestMs && ms < aEnd + safeMs + aRestMs) {
          return true;
        }

        // Rule 2: If the proposed activity starts before 'aStart', its execution and rest/safety buffer must not overlap 'aStart'
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
      // Also avoid working hours for the ENTIRE duration
      const isWorkOverlap = (s, e) => {
        if (s < workEnd1 && e > workStart1) return true;
        if (s < workEnd2 && e > workStart2) return true;
        return false;
      };

      // Only avoid working hours on weekdays (Monday=1 to Friday=5)
      const dayOfWeek = targetDateObj.getDay();
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

      if (isWeekday && isWorkOverlap(ms, msEnd)) return false;
      if (isOverlap(ms)) return false;
      return true;
    };

    const nowOffsetMs = new Date().getTime() - targetDateObj.getTime();
    
    // Find all valid time intervals within [minMs, maxMs] and up to nowOffsetMs (if today)
    const effectiveMaxMs = Math.min(maxMs, nowOffsetMs > 0 ? nowOffsetMs : maxMs);
    
    const intervals = [];
    if (minMs === maxMs) {
      // Fixed time: Check if valid
      if (isValidTime(minMs)) {
        intervals.push({ start: minMs, end: minMs, duration: 0 });
      }
    } else {
      const restMsOfNew = estimatedDurationMs * restMultiplier;
      const checkPoints = [minMs, workStart1, workEnd1, workStart2, workEnd2, effectiveMaxMs];
      blockedRanges.forEach(r => {
        if (r.start > minMs && r.start < effectiveMaxMs) checkPoints.push(r.start);
        if (r.end > minMs && r.end < effectiveMaxMs) checkPoints.push(r.end);
        // Also add points shifted by new duration + rest time to find boundaries
        const shiftMs = estimatedDurationMs + restMsOfNew;
        if (r.start - shiftMs > minMs && r.start - shiftMs < effectiveMaxMs) checkPoints.push(r.start - shiftMs);
      });
      checkPoints.sort((a, b) => a - b);
      
      for (let i = 0; i < checkPoints.length - 1; i++) {
        const start = checkPoints[i];
        const end = checkPoints[i+1];
        if (start >= end) continue;
        // Check middle point for validity
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
      // No valid time slot — all time is blocked by workhours + existing activities
      const err = new Error('Không còn khung giờ hợp lệ trong ngày hôm nay. Vui lòng kiểm tra lại cài đặt Avoid Workhours hoặc thử lại vào ngày mai.');
      err.code = 'NO_VALID_TIME_SLOT';
      throw err;
    }
    
    activityStartTime = targetTime;
  }

  // Generate route (OSRM road-snapped)
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

  // Add elevation (Hanoi: smooth 2-20m)
  points = generateElevation(points, { baseElevation: randomInRange(5, 10), maxVariation: randomInRange(1.5, 3.5) });

  // Add timestamps
  points = generateTimestamps(points, { startTime: activityStartTime, avgPaceMinPerKm: avgPace, simRedLights });

  // Add heart rate
  if (heartRateEnabled) {
    points = generateHeartRate(points, { minHR: finalMinHR, maxHR: finalMaxHR, simWeather, startTime: activityStartTime });
  } else {
    for (const pt of points) {
      delete pt.heartRate;
    }
  }

  // Add cadence
  points = generateCadence(points);

  // Activity name
  const activityName = generateActivityName(finalActivityType, activityStartTime);

  // Build GPX
  const gpxContent = buildGPX(points, {
    activityName,
    activityType: finalActivityType.toLowerCase(),
    includeHeartRate: heartRateEnabled,
    includeCadence: true,
    deviceName: getShortDescription(deviceName), // Use mapped app name (e.g. Garmin Connect, Huawei Health) as creator
  });

  // Save GPX file
  const timestamp = activityStartTime.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `run_${timestamp}.gpx`;
  const filepath = path.join(GPX_DIR, filename);
  fs.writeFileSync(filepath, gpxContent, 'utf-8');

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
    gpxContent,
  };
}

module.exports = { generateActivity, buildGPX, GPX_DIR, HANOI_DISTRICTS };
