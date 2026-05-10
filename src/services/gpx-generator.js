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

const GPX_DIR = path.join(__dirname, '..', '..', 'data', 'gpx');
fs.mkdirSync(GPX_DIR, { recursive: true });

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
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildGPX(points, options = {}) {
  const { activityName = 'Morning Run', activityType = 'running', includeHeartRate = true, includeCadence = true } = options;

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin Connect"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
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
    districtKey = 'hoan_kiem',
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
  } = config;

  const limits = systemLimits[userRole] || systemLimits.normal;

  // Determine Activity Type
  let finalActivityType = activityType;
  if (activityType === 'Random') {
    const r = Math.random();
    const w = limits.activity_type_weights;
    if (r < w.Run) finalActivityType = 'Run';
    else if (r < w.Run + w.Walk) finalActivityType = 'Walk';
    else finalActivityType = 'Ride';
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
    finalMinDist = minDistanceKm * 0.7;
    finalMaxDist = maxDistanceKm * 0.7;
    finalMinPace = Math.max(10.0, minPace);
    finalMaxPace = Math.max(15.0, maxPace);
    // HR Zones from config
    finalMinHR = Math.round(mhr * limits.hr_zones.Walk.min);
    finalMaxHR = Math.round(mhr * limits.hr_zones.Walk.max);
  } else if (finalActivityType === 'Ride') {
    finalMinDist = minDistanceKm * 1.5;
    finalMaxDist = maxDistanceKm * 1.5;
    finalMinPace = 2.5;
    finalMaxPace = 5.0;
    finalMinHR = Math.round(mhr * limits.hr_zones.Ride.min);
    finalMaxHR = Math.round(mhr * limits.hr_zones.Ride.max);
  } else { // Run
    finalMinDist = minDistanceKm;
    finalMaxDist = maxDistanceKm;
    finalMinPace = Math.min(7.0, minPace);
    finalMaxPace = Math.min(10.0, maxPace);
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
        
        if (area.type === 'home') {
          if (d + distRadiusM <= areaRadiusM) weight += 2.0; // Bao trọn
          else if (d <= areaRadiusM) weight += 1.2;         // Nhiều (Center inside)
          else if (d - distRadiusM <= areaRadiusM) weight += 0.5; // Ít (Overlap)
        } else if (area.type === 'work') {
          if (d + distRadiusM <= areaRadiusM) weight += 1.2; // Bao trọn
          else if (d <= areaRadiusM) weight += 0.8;         // Nhiều
          else if (d - distRadiusM <= areaRadiusM) weight += 0.4; // Ít
        }
      });
      return weight;
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
    chosenDistrictKeys = ['hoan_kiem'];
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
    const safeMs = (parseInt(config.overlap_protection_minutes || limits.overlap_protection_minutes || '30')) * 60000;
    const blockedRanges = (config.existingActivities || []).map(a => {
      // Strava uses start_date (ISO), local DB uses route_start_time (ISO)
      const start = new Date(a.start_date || a.route_start_time).getTime();
      // Strava uses duration (seconds), local DB uses duration_min (minutes)
      const durationMs = (a.elapsed_time || (a.duration_min * 60)) * 1000;
      const dayStart = targetDateObj.getTime();
      return {
        start: start - dayStart - safeMs,
        end: start - dayStart + durationMs + safeMs
      };
    });

    const isOverlap = (ms) => {
      for (const range of blockedRanges) {
        if (ms >= range.start && ms <= range.end) return true;
      }
      return false;
    };

    const isValidTime = (ms) => {
      if (ms > workStart1 && ms < workEnd1) return false;
      if (ms > workStart2 && ms < workEnd2) return false;
      if (isOverlap(ms)) return false;
      return true;
    };

    const nowOffsetMs = new Date().getTime() - targetDateObj.getTime();
    
    // Find all valid time intervals within [minMs, maxMs] and up to nowOffsetMs (if today)
    const effectiveMaxMs = Math.min(maxMs, nowOffsetMs > 0 ? nowOffsetMs : maxMs);
    
    const intervals = [];
    const checkPoints = [minMs, workStart1, workEnd1, workStart2, workEnd2, effectiveMaxMs];
    blockedRanges.forEach(r => {
      if (r.start > minMs && r.start < effectiveMaxMs) checkPoints.push(r.start);
      if (r.end > minMs && r.end < effectiveMaxMs) checkPoints.push(r.end);
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

    let targetTime;
    if (intervals.length > 0) {
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
    } else {
      // Fallback if no valid interval found (e.g. they picked exactly a working hour slot that is also in the past)
      targetTime = new Date();
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

  // Add elevation (Hanoi: 0-8m flat)
  points = generateElevation(points, { baseElevation: randomInRange(2, 5), maxVariation: 3 });

  // Add timestamps
  points = generateTimestamps(points, { startTime: activityStartTime, avgPaceMinPerKm: avgPace });

  // Add heart rate
  if (heartRateEnabled) {
    points = generateHeartRate(points, { minHR: finalMinHR, maxHR: finalMaxHR });
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
