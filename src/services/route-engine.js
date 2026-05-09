/**
 * Route Engine v2 - OSRM road-snapping + Hanoi districts
 * Generates realistic GPS routes that follow actual roads using OSRM API
 */

const https = require('https');

// ─── Hanoi Inner Districts ────────────────────────────────────────────────────
const HANOI_DISTRICTS = {
  hoan_kiem:    { name: 'Hoàn Kiếm',    lat: 21.0285, lng: 105.8542, radiusKm: 1.2 },
  hai_ba_trung: { name: 'Hai Bà Trưng', lat: 21.0069, lng: 105.8591, radiusKm: 2.0 },
  hoang_mai:    { name: 'Hoàng Mai',    lat: 20.9725, lng: 105.8629, radiusKm: 2.8 },
  dong_da:      { name: 'Đống Đa',      lat: 21.0245, lng: 105.8412, radiusKm: 1.8 },
  ba_dinh:      { name: 'Ba Đình',      lat: 21.0342, lng: 105.8412, radiusKm: 1.5 },
  thanh_xuan:   { name: 'Thanh Xuân',   lat: 20.9951, lng: 105.8130, radiusKm: 1.8 },
  cau_giay:     { name: 'Cầu Giấy',     lat: 21.0312, lng: 105.7886, radiusKm: 2.0 },
  tay_ho:       { name: 'Tây Hồ',       lat: 21.0614, lng: 105.8317, radiusKm: 2.2 },
  long_bien:    { name: 'Long Biên',    lat: 21.0425, lng: 105.8943, radiusKm: 2.5 },
  ha_dong:      { name: 'Hà Đông',      lat: 20.9632, lng: 105.7725, radiusKm: 2.8 },
  bac_tu_liem:  { name: 'Bắc Từ Liêm',  lat: 21.0658, lng: 105.7505, radiusKm: 2.5 },
  nam_tu_liem:  { name: 'Nam Từ Liêm',  lat: 21.0125, lng: 105.7600, radiusKm: 2.2 },
};

const EARTH_RADIUS = 6371000;

// ─── Math helpers ─────────────────────────────────────────────────────────────

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }

function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function destinationPoint(lat, lng, bearing, distM) {
  const d = distM / EARTH_RADIUS;
  const b = toRad(bearing);
  const lat1 = toRad(lat), lng1 = toRad(lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 = lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

function randomInRange(min, max, normal = false) {
  if (normal) {
    const u1 = Math.random(), u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const mean = (min + max) / 2, std = (max - min) / 6;
    return Math.max(min, Math.min(max, mean + z * std));
  }
  return min + Math.random() * (max - min);
}

// ─── OSRM Road-Snapping ───────────────────────────────────────────────────────

const osrmAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Get road-following route between two points via OSRM foot profile
 * Returns array of {lat, lng} points along actual roads
 */
function osrmRoute(fromLat, fromLng, toLat, toLng, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const coordStr = `${fromLng},${fromLat};${toLng},${toLat}`;
    const options = {
      hostname: 'router.project-osrm.org',
      path: `/route/v1/foot/${coordStr}?geometries=geojson&overview=full`,
      method: 'GET',
      headers: { 'User-Agent': 'StravaAutoGen/1.0' },
      agent: osrmAgent,
    };

    const timer = setTimeout(() => reject(new Error('OSRM timeout')), timeoutMs);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        clearTimeout(timer);
        try {
          const json = JSON.parse(data);
          if (json.routes && json.routes[0]) {
            // OSRM returns [lng, lat], convert to {lat, lng}
            const coords = json.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
            const distance = json.routes[0].distance; // meters
            resolve({ points: coords, distance });
          } else {
            reject(new Error('OSRM: no route found'));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', (e) => { clearTimeout(timer); reject(e); });
    req.end();
  });
}

/**
 * Build a full route using OSRM by chaining segments between waypoints.
 * Falls back to straight-line interpolation if OSRM fails.
 */
async function buildOSRMRoute(waypoints) {
  const allPoints = [];
  let totalDistance = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i], to = waypoints[i + 1];
    try {
      const { points, distance } = await osrmRoute(from.lat, from.lng, to.lat, to.lng);
      // Skip first point of each segment (it's the same as last of previous)
      const seg = i === 0 ? points : points.slice(1);
      allPoints.push(...seg);
      totalDistance += distance;
    } catch (err) {
      // Fallback: straight line interpolation
      console.warn(`[OSRM] Segment ${i} failed (${err.message}), using straight line`);
      const segDist = haversineDistance(from.lat, from.lng, to.lat, to.lng);
      const steps = Math.max(2, Math.floor(segDist / 20));
      for (let j = (i === 0 ? 0 : 1); j <= steps; j++) {
        const t = j / steps;
        allPoints.push({ lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t });
      }
      totalDistance += segDist;
    }
  }

  return { points: allPoints, totalDistance };
}

/**
 * Generate loop waypoints within a district
 * Creates a set of waypoints that form a rough loop shape
 */
function generateLoopWaypoints(centerLat, centerLng, targetDistKm) {
  const targetDistM = targetDistKm * 1000;
  // Estimate radius of loop (circumference ≈ distance, adjust for road factor ~1.35)
  const adjustedDist = targetDistM / 1.35;
  const radius = adjustedDist / (2 * Math.PI);

  // Clamp radius to district size
  const maxRadius = Math.min(radius, 1500); // max 1.5km from center
  const effectiveRadius = Math.max(100, maxRadius);

  // Number of waypoints based on distance
  const numWP = Math.max(3, Math.min(8, Math.floor(targetDistKm * 1.5)));
  const startBearing = randomInRange(0, 360);
  const waypoints = [];

  // Start point with slight offset from center
  const startOffset = randomInRange(0, effectiveRadius * 0.3);
  const startBear = randomInRange(0, 360);
  const start = destinationPoint(centerLat, centerLng, startBear, startOffset);
  waypoints.push(start);

  for (let i = 0; i < numWP; i++) {
    const angle = startBearing + (360 * i / numWP) + randomInRange(-25, 25);
    const r = effectiveRadius * randomInRange(0.6, 1.2);
    const wp = destinationPoint(centerLat, centerLng, angle, r);
    waypoints.push(wp);
  }

  // Close loop back to start
  waypoints.push({ ...start });
  return waypoints;
}

/**
 * Generate out-and-back waypoints
 */
function generateOutBackWaypoints(centerLat, centerLng, targetDistKm) {
  const halfDistM = (targetDistKm * 1000) / 2 / 1.35;
  const numLegs = Math.max(2, Math.floor(targetDistKm));
  const legDist = halfDistM / numLegs;
  const bearing = randomInRange(0, 360);

  const outPoints = [{ lat: centerLat, lng: centerLng }];
  let cur = { lat: centerLat, lng: centerLng };

  for (let i = 0; i < numLegs; i++) {
    const bear = bearing + randomInRange(-30, 30);
    cur = destinationPoint(cur.lat, cur.lng, bear, legDist * randomInRange(0.8, 1.2));
    outPoints.push(cur);
  }

  // Return path (slight offset from outbound)
  const retPoints = [];
  for (let i = outPoints.length - 1; i >= 1; i--) {
    retPoints.push({
      lat: outPoints[i].lat + randomInRange(-0.0001, 0.0001),
      lng: outPoints[i].lng + randomInRange(-0.0001, 0.0001),
    });
  }
  retPoints.push({ lat: centerLat, lng: centerLng });

  return [...outPoints, ...retPoints];
}

/**
 * Trim or pad route to match target distance
 */
function trimRouteToDistance(points, targetDistM) {
  let cumDist = 0;
  const result = [{ ...points[0], distance: 0 }];

  for (let i = 1; i < points.length; i++) {
    const segDist = haversineDistance(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng
    );
    cumDist += segDist;

    if (cumDist >= targetDistM) {
      // Interpolate final point exactly at targetDistM
      const overshoot = cumDist - targetDistM;
      const t = 1 - overshoot / segDist;
      const finalPt = {
        lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * t,
        lng: points[i - 1].lng + (points[i].lng - points[i - 1].lng) * t,
        distance: targetDistM,
      };
      result.push(finalPt);
      return result;
    }
    result.push({ ...points[i], distance: cumDist });
  }

  // If route is shorter than target, just return what we have
  return result;
}

// ─── Main Route Generator ─────────────────────────────────────────────────────

/**
 * Main route generation entry point
 * Uses OSRM to snap coordinates to real roads
 */
async function generateRoute(options = {}) {
  const {
    startLat,
    startLng,
    distanceKm = 5,
    districtKeys = [], // Now accepts an array of district keys
    useOSRM = true,
  } = options;

  // Determine center point
  let centerLat = startLat, centerLng = startLng;
  let waypoints = [];
  const routeType = distanceKm < 2 ? 'out-back' : (Math.random() > 0.35 ? 'loop' : 'out-back');

  if (districtKeys && districtKeys.length > 0) {
    const d0 = HANOI_DISTRICTS[districtKeys[0]];
    if (d0) {
      // Randomize start within first district radius
      const r = randomInRange(0, d0.radiusKm * 1000 * 0.6);
      const b = randomInRange(0, 360);
      const pt = destinationPoint(d0.lat, d0.lng, b, r);
      centerLat = pt.lat;
      centerLng = pt.lng;
    }

    if (districtKeys.length === 1) {
      // Single district: normal behavior
      waypoints = routeType === 'loop'
        ? generateLoopWaypoints(centerLat, centerLng, distanceKm)
        : generateOutBackWaypoints(centerLat, centerLng, distanceKm);
    } else {
      // Multi-district: generate path traversing the districts
      waypoints.push({ lat: centerLat, lng: centerLng });
      
      // Traverse initial sequence of districts
      for (let i = 1; i < districtKeys.length; i++) {
        const d = HANOI_DISTRICTS[districtKeys[i]];
        if (d) {
          const r = randomInRange(0, d.radiusKm * 1000 * 0.5);
          const b = randomInRange(0, 360);
          waypoints.push(destinationPoint(d.lat, d.lng, b, r));
        }
      }

      // Add bounce-back waypoints to ensure the route is long enough
      // so that trimRouteToDistance has enough track to work with
      let currentIdx = districtKeys.length - 1;
      let direction = -1;
      
      // Generate up to 15 bounces (enough to cover 20-30km)
      for (let bounce = 0; bounce < 15; bounce++) {
        currentIdx += direction;
        if (currentIdx < 0) {
          currentIdx = 1;
          direction = 1;
        } else if (currentIdx >= districtKeys.length) {
          currentIdx = districtKeys.length - 2;
          direction = -1;
        }
        
        const d = HANOI_DISTRICTS[districtKeys[currentIdx]];
        if (d) {
          const r = randomInRange(0, d.radiusKm * 1000 * 0.7);
          const b = randomInRange(0, 360);
          waypoints.push(destinationPoint(d.lat, d.lng, b, r));
        }
      }
    }
  } else {
    // No district specified
    waypoints = routeType === 'loop'
      ? generateLoopWaypoints(centerLat, centerLng, distanceKm)
      : generateOutBackWaypoints(centerLat, centerLng, distanceKm);
  }

  let points;
  const targetDistM = distanceKm * 1000;

  if (useOSRM) {
    try {
      const { points: osrmPoints } = await buildOSRMRoute(waypoints);
      // Add cumulative distances
      let cum = 0;
      const withDist = [{ ...osrmPoints[0], distance: 0 }];
      for (let i = 1; i < osrmPoints.length; i++) {
        cum += haversineDistance(osrmPoints[i - 1].lat, osrmPoints[i - 1].lng, osrmPoints[i].lat, osrmPoints[i].lng);
        withDist.push({ ...osrmPoints[i], distance: cum });
      }
      points = trimRouteToDistance(withDist, targetDistM);
      console.log(`[Route] OSRM success: ${points.length} pts, ${(points[points.length-1].distance/1000).toFixed(2)}km`);
    } catch (err) {
      console.warn('[Route] OSRM failed, using fallback:', err.message);
      points = fallbackRoute(waypoints, targetDistM);
    }
  } else {
    points = fallbackRoute(waypoints, targetDistM);
  }

  return points;
}

/**
 * Fallback route generator (no OSRM) - Manhattan-like interpolation
 */
function fallbackRoute(waypoints, targetDistM) {
  const allPts = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i], to = waypoints[i + 1];
    const midPt = { lat: from.lat, lng: to.lng }; // L-shape
    
    const dist1 = haversineDistance(from.lat, from.lng, midPt.lat, midPt.lng);
    const dist2 = haversineDistance(midPt.lat, midPt.lng, to.lat, to.lng);
    
    const steps1 = Math.max(2, Math.floor(dist1 / 20));
    const steps2 = Math.max(2, Math.floor(dist2 / 20));

    for (let j = (i === 0 ? 0 : 1); j <= steps1; j++) {
      allPts.push({
        lat: from.lat,
        lng: from.lng + (midPt.lng - from.lng) * (j / steps1) + randomInRange(-0.00003, 0.00003)
      });
    }
    for (let j = 1; j <= steps2; j++) {
      allPts.push({
        lat: midPt.lat + (to.lat - midPt.lat) * (j / steps2) + randomInRange(-0.00003, 0.00003),
        lng: to.lng
      });
    }
  }

  // Add cumulative distances
  let cum = 0;
  const withDist = [{ ...allPts[0], distance: 0 }];
  for (let i = 1; i < allPts.length; i++) {
    cum += haversineDistance(allPts[i - 1].lat, allPts[i - 1].lng, allPts[i].lat, allPts[i].lng);
    withDist.push({ ...allPts[i], distance: cum });
  }

  return trimRouteToDistance(withDist, targetDistM);
}

// ─── Elevation (Hanoi: 0-8m) ──────────────────────────────────────────────────

function generateElevation(points, options = {}) {
  const { baseElevation = 3, maxVariation = 5 } = options;
  const n = points.length;
  const freq1 = randomInRange(1, 3), freq2 = randomInRange(2, 5);
  const amp1 = maxVariation * randomInRange(0.3, 0.7), amp2 = maxVariation * randomInRange(0.1, 0.3);

  for (let i = 0; i < n; i++) {
    const t = i / n;
    const ele = baseElevation
      + amp1 * Math.sin(2 * Math.PI * freq1 * t)
      + amp2 * Math.sin(2 * Math.PI * freq2 * t + 1.2)
      + randomInRange(-0.3, 0.3);
    points[i].elevation = Math.max(0, Math.min(8, Math.round(ele * 10) / 10));
  }
  return points;
}

// ─── Timestamps ───────────────────────────────────────────────────────────────

function generateTimestamps(points, options = {}) {
  const { startTime = new Date(), avgPaceMinPerKm = 7.0, paceVariation = 0.12 } = options;
  const avgSpeed = 1000 / (avgPaceMinPerKm * 60);

  let cur = new Date(startTime);
  const result = [];
  points[0].time = new Date(cur);
  result.push(points[0]);

  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    const prevPt = points[i - 1];
    const segDist = pt.distance - prevPt.distance;
    const progress = i / points.length;

    let paceFactor = 1.0;
    if (progress < 0.08) paceFactor = 1.15 + (0.08 - progress) * 2;
    else if (progress > 0.92) paceFactor = 1.05 + (progress - 0.92) * 3;
    else paceFactor = randomInRange(1 - paceVariation, 1 + paceVariation, true);

    if (pt.elevation !== undefined && prevPt.elevation !== undefined && segDist > 0) {
      const grad = (pt.elevation - prevPt.elevation) / segDist;
      paceFactor += grad * 4;
    }

    const speed = avgSpeed / Math.max(0.5, paceFactor);
    const secs = segDist > 0 ? segDist / speed : 0;
    cur = new Date(cur.getTime() + secs * 1000);
    pt.time = new Date(cur);
    
    // Simulate Red Light / Pause (approx 1.5% chance per point if not near start/end)
    if (options.simRedLights !== false && progress > 0.1 && progress < 0.9 && Math.random() < 0.015) {
       const pauseSecs = randomInRange(15, 60);
       const steps = Math.floor(pauseSecs / 5);
       for (let j = 1; j <= steps; j++) {
         cur = new Date(cur.getTime() + 5000);
         result.push({ ...pt, time: new Date(cur), isPause: true });
       }
    }
    
    result.push(pt);
  }
  return result;
}

// ─── Heart Rate ───────────────────────────────────────────────────────────────

function generateHeartRate(points, options = {}) {
  const { minHR = 130, maxHR = 165, restingHR = 65, startTime = null } = options;
  
  // Simulate weather factor randomly (hot weather = +HR)
  const isHotWeather = options.simWeather !== false && Math.random() > 0.7;
  let weatherFactor = isHotWeather ? randomInRange(3, 8) : 0;
  
  // Time-of-day factor: trưa/chiều (11:00 - 16:00) nắng cũng tăng chút
  const startHour = startTime ? new Date(startTime).getHours() : 10;
  if (startHour >= 11 && startHour <= 16) {
    weatherFactor += randomInRange(2, 5);
  }

  const n = points.length;
  let lastActiveHR = minHR;
  let pauseDuration = 0;

  for (let i = 0; i < n; i++) {
    const p = i / n;
    let hr;
    
    if (points[i].isPause) {
       // HR drops during pauses towards restingHR
       pauseDuration += 5; // each pause point is 5s
       const dropFactor = Math.min(0.8, pauseDuration / 120); // max 80% drop towards resting after 2 mins
       hr = lastActiveHR - (lastActiveHR - restingHR) * dropFactor + randomInRange(-2, 2);
    } else {
       pauseDuration = 0; // Reset pause counter when moving
       if (p < 0.1) {
          hr = restingHR + (minHR - restingHR) * (p / 0.1);
       } else if (p < 0.9) {
         const mp = (p - 0.1) / 0.8;
         hr = minHR + (maxHR - minHR) * (0.5 + 0.3 * Math.sin(2 * Math.PI * 3 * mp)) + randomInRange(-5, 5);
         if (points[i].elevation !== undefined && i > 0 && points[i - 1].elevation !== undefined)
           hr += (points[i].elevation - points[i - 1].elevation) * 2;
       } else {
         hr = minHR + (restingHR - minHR) * ((p - 0.9) / 0.1) * 0.5;
       }
       lastActiveHR = hr;
    }
    
    points[i].heartRate = Math.round(Math.max(restingHR, Math.min(maxHR + 15, hr + weatherFactor)));
  }
  return points;
}

// ─── Cadence ──────────────────────────────────────────────────────────────────

function generateCadence(points, options = {}) {
  const { avgCadence = 168 } = options;
  for (let i = 0; i < points.length; i++) {
    const p = i / points.length;
    let cad = avgCadence;
    if (p < 0.05 || p > 0.95) cad = avgCadence * 0.88;
    cad += randomInRange(-8, 8);
    points[i].cadence = Math.round(cad);
  }
  return points;
}

module.exports = {
  HANOI_DISTRICTS,
  generateRoute,
  generateElevation,
  generateTimestamps,
  generateHeartRate,
  generateCadence,
  haversineDistance,
  randomInRange,
};
