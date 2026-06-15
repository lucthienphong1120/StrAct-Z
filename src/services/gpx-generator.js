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

const { getDistrictKeyForCoordinate } = require('../utils/geo');

const GPX_DIR = path.join(__dirname, '..', '..', 'data', 'activity');
fs.mkdirSync(GPX_DIR, { recursive: true });

/**
 * Determines the GPX creator (source app/device name) for a given device.
 * Strategy based on DEVICE_TESTCASES.md:
 * - Garmin Connect / Garmin devices in GPX: creator = 'Garmin Connect'
 * - COROS devices: creator = 'COROS'
 * - Huawei devices: creator = 'Huawei Health'
 * - Suunto/Amazfit/Polar/Xiaomi/Redmi: creator = device name directly
 * - Strava App: creator = 'Strava App'
 */
function getGPXCreator(deviceName) {
  const nameLower = (deviceName || '').toLowerCase();
  if (nameLower.includes('garmin') || nameLower === 'garmin connect') return 'Garmin Connect';
  if (nameLower.includes('coros')) return 'COROS';
  if (nameLower.includes('huawei')) return 'Huawei Health';
  if (nameLower.includes('strava')) return 'Strava App';
  // Suunto, Amazfit, Polar, Xiaomi, Redmi → use device name directly
  return deviceName || 'Strava App';
}

/**
 * Returns the description for Strava upload.
 * - Garmin devices (not 'Garmin Connect'): description = device name
 * - COROS specific devices (not generic 'COROS'): description = device name
 * - Huawei specific devices (not generic 'Huawei Health'): description = device name
 * - Others: empty description
 */
function getShortDescription(deviceName) {
  const nameLower = (deviceName || '').toLowerCase();
  // Garmin device in GPX mode → description = device name (but not for 'Garmin Connect' itself)
  if (nameLower.includes('garmin') && nameLower !== 'garmin connect') return deviceName;
  // COROS specific device → description = device name (but not for generic 'COROS')
  if (nameLower.includes('coros') && nameLower !== 'coros') return deviceName;
  // Huawei specific device → description = device name (but not for generic 'Huawei Health')
  if (nameLower.includes('huawei') && nameLower !== 'huawei health') return deviceName;
  return '';
}

/**
 * Determines if a device should always use GPX format (non-Garmin FIT-incompatible devices).
 * Garmin devices + Strava App can use FIT. Everything else should use GPX.
 */
function shouldForceGPX(deviceName) {
  const nameLower = (deviceName || '').toLowerCase();
  if (nameLower.includes('garmin')) return false;
  if (nameLower.includes('strava')) return false;
  // All other brands: COROS, Suunto, Amazfit, Huawei, Polar, Xiaomi, Redmi → force GPX
  return true;
}

function getDeviceBrand(deviceName) {
  const nameLower = (deviceName || '').toLowerCase();
  if (nameLower.includes('garmin')) return 'garmin';
  if (nameLower.includes('coros')) return 'coros';
  if (nameLower.includes('suunto')) return 'suunto';
  if (nameLower.includes('amazfit')) return 'amazfit';
  if (nameLower.includes('huawei')) return 'huawei';
  if (nameLower.includes('polar')) return 'polar';
  if (nameLower.includes('xiaomi') || nameLower.includes('redmi')) return 'xiaomi';
  if (nameLower.includes('strava')) return 'strava';
  return 'garmin';
}

function getActualDistrictKeysForRoute(points, fallbackKeys = []) {
  if (!Array.isArray(points) || points.length === 0) {
    return fallbackKeys;
  }

  const actualKeys = [];
  const addKey = (key) => {
    if (key && HANOI_DISTRICTS[key] && !actualKeys.includes(key)) {
      actualKeys.push(key);
    }
  };

  const step = Math.max(1, Math.floor(points.length / 200));
  for (let i = 0; i < points.length; i += step) {
    addKey(getDistrictKeyForCoordinate(points[i].lat, points[i].lng));
  }

  const lastPoint = points[points.length - 1];
  addKey(getDistrictKeyForCoordinate(lastPoint.lat, lastPoint.lng));

  return actualKeys.length > 0 ? actualKeys : fallbackKeys;
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
  const { activityName = 'Morning Run', activityType = 'running', includeHeartRate = true, includeCadence = true, deviceName = 'Garmin Connect', description = '' } = options;
  // Use getGPXCreator() to determine the proper source app/device name as the GPX creator attribute
  const creator = getGPXCreator(deviceName);

  let gpx = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<gpx xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ns3="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" xmlns:ns2="http://www.garmin.com/xmlschemas/GpxExtensions/v3" xmlns:ns1="http://www.cluetrust.com/XML/GPXDATA/1/0" creator="${escapeXml(creator)}" version="1.1">
  <metadata>
    <name>${escapeXml(activityName)}</name>
    ${description ? `    <desc>${escapeXml(description)}</desc>` : ''}
    <time>${formatGPXTime(points[points.length - 1].time)}</time>
  </metadata>
  <trk>
    <name><![CDATA[${activityName}]]></name>
    ${description ? `    <desc><![CDATA[${description}]]></desc>` : ''}
    <type>${activityType}</type>
    <trkseg>`;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    let speed = 0;
    if (i > 0) {
      const timeDeltaSec = (pt.time - points[i - 1].time) / 1000;
      const distDeltaM = pt.distance - points[i - 1].distance;
      speed = timeDeltaSec > 0 ? distDeltaM / timeDeltaSec : 0;
    }

    gpx += `
      <trkpt lat="${pt.lat.toFixed(8)}" lon="${pt.lng.toFixed(8)}">
        <ele>${pt.elevation.toFixed(2)}</ele>
        <time>${formatGPXTime(pt.time)}</time>`;
        
    gpx += `
        <extensions>
          <ns3:TrackPointExtension>
            <ns3:speed>${speed.toFixed(2)}</ns3:speed>`;
    if (includeCadence && pt.cadence) gpx += `
            <ns3:cad>${pt.cadence}</ns3:cad>`;
    if (includeHeartRate && pt.heartRate) gpx += `
            <ns3:hr>${pt.heartRate}</ns3:hr>`;
    gpx += `
          </ns3:TrackPointExtension>
        </extensions>
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
    userRole = 'basic',
    deviceName = 'Garmin fēnix 7x Pro',
    simWeather = true,
    simRedLights = true,
  } = config;

  const limits = systemLimits[userRole] || systemLimits.basic;

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

  const distMults = limits.dist_multipliers?.default || { Walk: 0.55, Ride: 2.3, Run: 1.0 };
  const paceMults = limits.pace_multipliers?.default || { Walk: 1.7, Ride: 0.45, Run: 1.0 };

  if (finalActivityType === 'Walk') {
    finalMinDist = minDistanceKm * distMults.Walk;
    finalMaxDist = maxDistanceKm * distMults.Walk;
    finalMinPace = minPace * paceMults.Walk;
    finalMaxPace = maxPace * paceMults.Walk;
    // HR Zones from config
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

  // Determine Start District (Random if 'random' or not provided)
  const allowedDistricts = config.selected_districts ? config.selected_districts.split(',').filter(Boolean) : Object.keys(HANOI_DISTRICTS);
  
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
          const areaWeights = limits.activity_areas?.weights || {
            home: { fully: 20.0, mostly: 14.0, partially: 7.0 },
            work: { fully: 12.0, mostly: 7.5, partially: 3.0 }
          };
          if (area.type === 'home') {
            if (ratio >= 0.85) weight += areaWeights.home.fully;      // Bao trọn / Nằm trọn
            else if (ratio >= 0.35) weight += areaWeights.home.mostly; // Nhiều
            else weight += areaWeights.home.partially;                 // Ít
          } else if (area.type === 'work') {
            if (ratio >= 0.85) weight += areaWeights.work.fully;      // Bao trọn / Nằm trọn
            else if (ratio >= 0.35) weight += areaWeights.work.mostly; // Nhiều
            else weight += areaWeights.work.partially;                 // Ít
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
        
        if (Array.isArray(lastKeys) && lastKeys.length > 0) {
          const lk = lastKeys[0]; // Chỉ áp dụng với quận start, các quận sau ko tính
          let boostValue = 0;
          if (lk === key) {
            const sameWeight = limits.boost_adjacent?.same_weight || 2.1;
            boostValue = sameWeight;
          } else if (ADJACENT_DISTRICTS[lk] && ADJACENT_DISTRICTS[lk].includes(key)) {
            const adjWeight = limits.boost_adjacent?.adjacent_weight || 1.4;
            boostValue = adjWeight;
          }
          weight += boostValue;
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

    // Pick exactly 1 start district using weighted choice
    let available = [...allowedDistricts];
    let availableWeights = [...weights];
    
    if (available.length > 0) {
      const totalWeight = availableWeights.reduce((a, b) => a + b, 0);
      let r = Math.random() * totalWeight;
      let sum = 0;
      for (let i = 0; i < available.length; i++) {
        sum += availableWeights[i];
        if (r <= sum) {
          chosenDistrictKeys = [available[i]];
          break;
        }
      }
    }
    if (chosenDistrictKeys.length === 0) {
      chosenDistrictKeys = ['hoan_kiem'];
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

  // Target distance or randomized distance
  let distanceKm;
  if (config.targetDistanceKm && parseFloat(config.targetDistanceKm) > 0) {
    const rawTarget = parseFloat(config.targetDistanceKm);
    const finalTarget = Math.max(finalMinDist, Math.min(finalMaxDist, Math.min(maxDistanceKm, rawTarget)));
    distanceKm = Math.round(finalTarget * 10) / 10;
    console.log(`[Generator] Target distance active: Raw Target = ${rawTarget.toFixed(2)}km, Snapped Target (respecting limits for ${finalActivityType}) = ${distanceKm.toFixed(2)}km`);
  } else {
    distanceKm = Math.round(randomInRange(finalMinDist, finalMaxDist) * 10) / 10;
  }
  const avgPace = randomInRange(finalMinPace, finalMaxPace, true);

  // Handle Random Time Generation if startTime is not explicitly provided
  let activityStartTime = startTime;
  if (!activityStartTime) {
    const targetDateStr = config.targetDate || new Date().toLocaleDateString('sv-SE', {timeZone: 'Asia/Ho_Chi_Minh'});
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
    const restPercent = parseInt(config.rest_time_percent || (limits.rest_time_percent ? limits.rest_time_percent.default : 40) || '40');
    const restMultiplier = restPercent / 100;
    const estimatedDurationMs = (avgPace * distanceKm) * 60000;

    const activeActivities = (config.existingActivities || []).filter(a => {
      if (a.upload_status !== undefined) {
        if (a.upload_status === 'uploaded') return true;
        return false;
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

      const bypassWorkHours = (minMs === maxMs);
      if (!bypassWorkHours && isWeekday && isWorkOverlap(ms, msEnd)) return false;
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
    activityAreas: config.activity_areas ? JSON.parse(config.activity_areas) : [],
    startNearFavoritePlace: config.start_near_favorite_place !== false && config.start_near_favorite_place !== 'false',
  });

  if (!points || points.length < 2) {
    throw new Error('Route generation returned too few points');
  }

  // Add elevation (Hanoi: smooth 2-20m)
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

  // Build GPX
  const gpxContent = buildGPX(points, {
    activityName,
    activityType: finalActivityType.toLowerCase(),
    includeHeartRate: heartRateEnabled,
    includeCadence: true,
    deviceName: deviceName ? deviceName.replace(/\s*★$/, '') : '', // Strip trailing star if any
    description: getShortDescription(deviceName), // Description will be set for Garmin/Huawei/COROS
  });

  // Save GPX file
  const year = activityStartTime.getFullYear();
  const month = String(activityStartTime.getMonth() + 1).padStart(2, '0');
  const day = String(activityStartTime.getDate()).padStart(2, '0');
  const hours = String(activityStartTime.getHours()).padStart(2, '0');
  const minutes = String(activityStartTime.getMinutes()).padStart(2, '0');
  const seconds = String(activityStartTime.getSeconds()).padStart(2, '0');
  const filename = `run_${year}-${month}-${day}T${hours}-${minutes}-${seconds}.gpx`;
  const filepath = path.join(GPX_DIR, filename);
  fs.writeFileSync(filepath, gpxContent, 'utf-8');

  const actualDuration = (points[points.length - 1].time - points[0].time) / 60000;
  const actualDistance = points[points.length - 1].distance / 1000;
  const actualDistrictKeys = getActualDistrictKeysForRoute(points, chosenDistrictKeys);

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
    districtKey: actualDistrictKeys.join(','),
    gpxContent,
  };
}

module.exports = { generateActivity, buildGPX, GPX_DIR, HANOI_DISTRICTS, getShortDescription, shouldForceGPX };
