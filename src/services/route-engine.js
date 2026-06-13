/**
 * Route Engine v2 - OSRM road-snapping + Hanoi districts
 * Generates realistic GPS routes that follow actual roads using OSRM API
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const { DISTRICTS } = require('../config/districts');
const { getDistrictKeyForCoordinate, getRandomPointInDistrict } = require('../utils/geo');

// ─── Hanoi Inner Districts ────────────────────────────────────────────────────
// Dynamically build lookup object from registry for backward compatibility
const HANOI_DISTRICTS = {};
DISTRICTS.forEach(d => {
  HANOI_DISTRICTS[d.key] = { name: d.name, lat: d.lat, lng: d.lng, radiusKm: d.radiusKm };
});

// Predefined scenic, low-traffic running points of interest (POIs) in Hanoi
const RUNNING_POIS = {
  hoan_kiem: [
    { name: 'Hồ Hoàn Kiếm', lat: 21.0285, lng: 105.8542 },
    { name: 'Nhà hát Lớn Hà Nội', lat: 21.0245, lng: 105.8588 },
    { name: 'Vườn hoa Lý Thái Tổ', lat: 21.0274, lng: 105.8562 },
    { name: 'Quảng trường Đông Kinh Nghĩa Thục', lat: 21.0306, lng: 105.8524 },
    { name: 'Trường THPT Việt Đức', lat: 21.0227, lng: 105.8525 }
  ],
  hai_ba_trung: [
    { name: 'Công viên Thống Nhất', lat: 21.0163, lng: 105.8458 },
    { name: 'Công viên Tuổi Trẻ', lat: 21.0068, lng: 105.8601 },
    { name: 'Đại học Bách Khoa Hà Nội', lat: 21.0062, lng: 105.8431 },
    { name: 'Đại học Kinh tế Quốc dân (NEU)', lat: 21.0016, lng: 105.8423 },
    { name: 'Hồ Thiền Quang', lat: 21.0185, lng: 105.8475 },
    { name: 'Đại học Xây dựng', lat: 21.0035, lng: 105.8428 },
    { name: 'Sân vận động Bách Khoa', lat: 21.0055, lng: 105.8465 }
  ],
  ba_dinh: [
    { name: 'Công viên Bách Thảo', lat: 21.0425, lng: 105.8285 },
    { name: 'Hồ Trúc Bạch', lat: 21.0416, lng: 105.8385 },
    { name: 'Quảng trường Ba Đình', lat: 21.0360, lng: 105.8347 },
    { name: 'Hồ Giảng Võ', lat: 21.0270, lng: 105.8166 },
    { name: 'Hồ Ngọc Khánh', lat: 21.0276, lng: 105.8095 },
    { name: 'Hồ Thành Công', lat: 21.0195, lng: 105.8130 },
    { name: 'Công viên Thủ Lệ', lat: 21.0322, lng: 105.8080 },
    { name: 'Trường THPT Chu Văn An', lat: 21.0441, lng: 105.8315 }
  ],
  tay_ho: [
    { name: 'Đường ven Hồ Tây (Trích Sài)', lat: 21.0558, lng: 105.8083 },
    { name: 'Đường ven Hồ Tây (Nguyễn Đình Thi)', lat: 21.0478, lng: 105.8236 },
    { name: 'Công viên Nước Hồ Tây', lat: 21.0762, lng: 105.8175 },
    { name: 'Đường Thanh Niên', lat: 21.0436, lng: 105.8372 },
    { name: 'Đường ven Hồ Tây (Vệ Hồ)', lat: 21.0725, lng: 105.8288 },
    { name: 'Hồ Quảng Bá', lat: 21.0664, lng: 105.8260 },
    { name: 'Thung lũng hoa Hồ Tây', lat: 21.0745, lng: 105.8210 }
  ],
  cau_giay: [
    { name: 'Công viên Cầu Giấy', lat: 21.0205, lng: 105.7905 },
    { name: 'Công viên Nghĩa Đô', lat: 21.0415, lng: 105.7985 },
    { name: 'Đại học Quốc gia Hà Nội (VNU)', lat: 21.0375, lng: 105.7820 },
    { name: 'Trường THPT Chuyên Hà Nội - Amsterdam', lat: 21.0099, lng: 105.7985 },
    { name: 'Đại học Sư phạm Hà Nội', lat: 21.0365, lng: 105.7850 },
    { name: 'Hồ Nghĩa Tân', lat: 21.0410, lng: 105.7930 },
    { name: 'Đại học Thương mại', lat: 21.0366, lng: 105.7745 }
  ],
  dong_da: [
    { name: 'Văn Miếu Quốc Tử Giám', lat: 21.0285, lng: 105.8355 },
    { name: 'Hồ Xã Đàn', lat: 21.0132, lng: 105.8327 },
    { name: 'Công viên Gò Đống Đa', lat: 21.0130, lng: 105.8238 },
    { name: 'Hồ Ba Mẫu', lat: 21.0160, lng: 105.8415 },
    { name: 'Hồ Đống Đa (Hoàng Cầu)', lat: 21.0195, lng: 105.8210 },
    { name: 'Hồ Láng (Chùa Láng)', lat: 21.0215, lng: 105.8035 },
    { name: 'Đại học Ngoại thương (FTU)', lat: 21.0225, lng: 105.8048 },
    { name: 'Đại học Y Hà Nội', lat: 21.0038, lng: 105.8285 },
    { name: 'Học viện Ngoại giao', lat: 21.0232, lng: 105.8045 },
    { name: 'Sân vận động Hàng Đẫy', lat: 21.0290, lng: 105.8315 }
  ],
  thanh_xuan: [
    { name: 'Công viên Thanh Xuân', lat: 20.9982, lng: 105.8008 },
    { name: 'Hồ Đầm Hồng', lat: 20.9950, lng: 105.8235 },
    { name: 'Hồ Khương Đình', lat: 20.9858, lng: 105.8190 },
    { name: 'Đại học Hà Nội (HANU)', lat: 20.9845, lng: 105.7955 },
    { name: 'Đại học Khoa học Tự nhiên', lat: 20.9995, lng: 105.8090 },
    { name: 'Hồ Hạ Đình', lat: 20.9865, lng: 105.8095 }
  ],
  hoang_mai: [
    { name: 'Công viên Yên Sở', lat: 20.9664, lng: 105.8521 },
    { name: 'Bán đảo Linh Đàm', lat: 20.9658, lng: 105.8290 },
    { name: 'Hồ Đền Lừ', lat: 20.9882, lng: 105.8565 },
    { name: 'Hồ Vĩnh Hoàng', lat: 20.9835, lng: 105.8640 },
    { name: 'Trường Đại học Thăng Long', lat: 20.9760, lng: 105.8160 },
    { name: 'Hồ Định Công', lat: 20.9785, lng: 105.8250 },
    { name: 'Công viên Hoàng Văn Thụ', lat: 20.9902, lng: 105.8492 }
  ],
  long_bien: [
    { name: 'Khu đô thị Vinhomes Riverside', lat: 21.0395, lng: 105.9080 },
    { name: 'Công viên Ngọc Lâm', lat: 21.0438, lng: 105.8755 },
    { name: 'Hồ Thạch Bàn', lat: 21.0185, lng: 105.8980 },
    { name: 'Hồ Cầu Tình', lat: 21.0505, lng: 105.8750 },
    { name: 'Đê sông Hồng (Long Biên)', lat: 21.0360, lng: 105.8710 },
    { name: 'Trường THPT Nguyễn Gia Thiều', lat: 21.0465, lng: 105.8785 }
  ],
  ha_dong: [
    { name: 'Công viên hồ Phùng Hưng', lat: 20.9652, lng: 105.7901 },
    { name: 'Làng lụa Vạn Phúc', lat: 20.9782, lng: 105.7760 },
    { name: 'Hồ Văn Quán', lat: 20.9792, lng: 105.7915 },
    { name: 'Học viện Công nghệ Bưu chính Viễn thông (PTIT)', lat: 20.9808, lng: 105.7885 },
    { name: 'Học viện An ninh Nhân dân', lat: 20.9840, lng: 105.7870 },
    { name: 'Hồ Đầm Khê', lat: 20.9675, lng: 105.7760 },
    { name: 'Công viên thể thao Hà Đông', lat: 20.9570, lng: 105.7710 }
  ],
  bac_tu_liem: [
    { name: 'Công viên Hòa Bình', lat: 21.0694, lng: 105.7915 },
    { name: 'Đại học Mỏ - Địa chất', lat: 21.0722, lng: 105.7740 },
    { name: 'Học viện Tài chính', lat: 21.0760, lng: 105.7785 },
    { name: 'Đại học Công nghiệp Hà Nội', lat: 21.0535, lng: 105.7350 },
    { name: 'Công viên hồ điều hòa Ngoại Giao Đoàn', lat: 21.0665, lng: 105.7985 }
  ],
  nam_tu_liem: [
    { name: 'Sân vận động Quốc gia Mỹ Đình', lat: 21.0205, lng: 105.7635 },
    { name: 'Khu vực Landmark 72', lat: 21.0168, lng: 105.7838 },
    { name: 'Công viên Mễ Trì', lat: 21.0125, lng: 105.7815 },
    { name: 'Cung điền kinh trong nhà Mỹ Đình', lat: 21.0225, lng: 105.7605 },
    { name: 'Đại học Quốc gia Hà Nội (Kí túc xá Mỹ Đình)', lat: 21.0275, lng: 105.7695 },
    { name: 'Trường đua F1 Mỹ Đình', lat: 21.0175, lng: 105.7610 }
  ],
  thanh_tri: [
    { name: 'Công viên Chu Văn An', lat: 20.9725, lng: 105.8115 },
    { name: 'Hồ Triều Khúc', lat: 20.9818, lng: 105.8075 },
    { name: 'Sân vận động huyện Thanh Trì', lat: 20.9535, lng: 105.8450 }
  ],
  gia_lam: [
    { name: 'Vinhomes Ocean Park', lat: 20.9930, lng: 105.9520 },
    { name: 'Hồ Sài Đồng', lat: 21.0255, lng: 105.9220 },
    { name: 'Trường Đại học Nông nghiệp Việt Nam (VNUA)', lat: 21.0045, lng: 105.9335 }
  ],
  dong_anh: [
    { name: 'Công viên Thị trấn Đông Anh', lat: 21.1390, lng: 105.8455 },
    { name: 'Sân vận động Đông Anh', lat: 21.1365, lng: 105.8485 },
    { name: 'Hồ Đầm Vân Trì', lat: 21.1445, lng: 105.7950 }
  ],
  hoai_duc: [
    { name: 'Khu đô thị Splendora An Khánh', lat: 21.0090, lng: 105.7220 },
    { name: 'Đại học Thành Đô', lat: 21.0610, lng: 105.7255 }
  ],
  dan_phuong: [
    { name: 'Khu đô thị sinh thái The Phoenix Garden', lat: 21.1070, lng: 105.6790 }
  ],
  chuong_my: [
    { name: 'Trung tâm Thị trấn Xuân Mai', lat: 20.9030, lng: 105.5870 },
    { name: 'Đại học Lâm nghiệp', lat: 20.9045, lng: 105.5785 }
  ],
  thanh_oai: [
    { name: 'Công viên Thanh Hà Mường Thanh', lat: 20.9380, lng: 105.7940 }
  ],
  thuong_tin: [
    { name: 'Khu vực trung tâm Thường Tín', lat: 20.8520, lng: 105.8970 }
  ]
};

function getDistrictTargetCenter(districtKey, activityAreas = [], startNearFavoritePlace = true) {
  const d = HANOI_DISTRICTS[districtKey];
  if (!d) return null;

  // 1. Filter activity areas whose center coordinates lie inside this district polygon
  const containingAreas = (activityAreas || []).filter(area => {
    const areaDistrictKey = area.district || getDistrictKeyForCoordinate(area.lat, area.lng);
    return areaDistrictKey === districtKey;
  });

  const hasHome = containingAreas.some(a => a.type === 'home');
  const hasWork = containingAreas.some(a => a.type === 'work');

  let pCenter = 0;
  let pPoi = 0.75;
  let pRandom = 0.25;

  if (startNearFavoritePlace && containingAreas.length > 0) {
    if (hasHome && hasWork) {
      pCenter = 0.60;
      pPoi = 0.35;
      pRandom = 0.05;
    } else if (hasHome || hasWork) {
      pCenter = 0.40;
      pPoi = 0.50;
      pRandom = 0.10;
    }
  } else {
    pCenter = 0;
    pPoi = 0.75;
    pRandom = 0.25;
  }

  const roll = Math.random();

  if (roll < pCenter) {
    // Sort containing areas to prioritize 'home' first, then 'work'
    const sortedAreas = [...containingAreas].sort((a, b) => {
      if (a.type === 'home' && b.type !== 'home') return -1;
      if (a.type !== 'home' && b.type === 'home') return 1;
      return 0;
    });

    const chosenArea = sortedAreas[0];
    const searchRadiusM = randomInRange(100, 300); // Random offset between 100m and 300m
    console.log(`[Route Engine] Start Near Favorite Place - Home/Work center: "${chosenArea.type}" in district "${d.name}" with radius ${Math.round(searchRadiusM)}m`);
    return { lat: chosenArea.lat, lng: chosenArea.lng, radiusM: searchRadiusM };
  } else if (roll < pCenter + pPoi) {
    const pois = RUNNING_POIS[districtKey];
    if (pois && pois.length > 0) {
      const poi = pois[Math.floor(Math.random() * pois.length)];
      const r = randomInRange(0, 200); // tight search radius around scenic spot (0m - 200m)
      console.log(`[Route Engine] Start Near Favorite Place - Scenic POI: "${poi.name}" in district "${d.name}" with radius ${Math.round(r)}m`);
      return { lat: poi.lat, lng: poi.lng, radiusM: r };
    }
  }

  // Fallback to true random coordinates in district (avoiding exact district center)
  const pt = getRandomPointInDistrict(districtKey);
  if (pt) {
    const r = randomInRange(5, 50); // slight variance
    console.log(`[Route Engine] Start Near Favorite Place - True random inside district polygon "${d.name}" with radius ${Math.round(r)}m`);
    return { lat: pt.lat, lng: pt.lng, radiusM: r };
  }

  // Ultimate fallback to randomized offset from district center
  const r = d.radiusKm * 1000 * randomInRange(0.1, 0.6);
  console.log(`[Route Engine] Start Near Favorite Place - Fallback to center of district "${d.name}" with radius ${Math.round(r)}m`);
  return { lat: d.lat, lng: d.lng, radiusM: r };
}

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

function generateLoopWaypoints(centerLat, centerLng, targetDistKm, districtKey = null, startTargetInfo = null) {
  const targetDistM = targetDistKm * 1000;
  const waypoints = [];

  // Default fallback behavior: standard geometric loop
  const generateDefaultLoop = () => {
    const adjustedDist = targetDistM / 1.35;
    const radius = adjustedDist / (2 * Math.PI);
    const effectiveRadius = Math.max(100, radius);
    const numWP = Math.max(3, Math.min(8, Math.floor(targetDistKm * 1.5)));
    const startBearing = randomInRange(0, 360);
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
    waypoints.push({ ...start });
    return waypoints;
  };

  // Check if we can target a POI
  if (!districtKey || !RUNNING_POIS[districtKey]) {
    return generateDefaultLoop();
  }

  // 1. Determine if we should target another POI
  let shouldTargetPoi = false;
  if (startTargetInfo && startTargetInfo.isPoi) {
    // 30% chance to move to another POI if start is a POI
    shouldTargetPoi = Math.random() < 0.30;
  } else {
    // 100% chance to target a POI if start is home/work or random
    shouldTargetPoi = true;
  }

  if (!shouldTargetPoi) {
    return generateDefaultLoop();
  }

  // 2. Find eligible POIs within 1.5km
  const startPt = { lat: centerLat, lng: centerLng };
  const allPois = RUNNING_POIS[districtKey] || [];
  const eligiblePois = [];

  for (const poi of allPois) {
    // Skip if it's the starting POI
    if (startTargetInfo && startTargetInfo.isPoi && startTargetInfo.poiName === poi.name) {
      continue;
    }
    const d = haversineDistance(startPt.lat, startPt.lng, poi.lat, poi.lng);
    // Distance must be between 100m and 1500m
    if (d >= 100 && d <= 1500) {
      // Run distance must be at least 2.5 * d to allow going there and back
      if (targetDistM >= 2.5 * d) {
        eligiblePois.push({ poi, d });
      }
    }
  }

  if (eligiblePois.length === 0) {
    return generateDefaultLoop();
  }

  // Pick the nearest POI
  eligiblePois.sort((a, b) => a.d - b.d);
  const chosen = eligiblePois[0];
  const secondPoi = chosen.poi;
  const d = chosen.d;

  console.log(`[Route Engine] Smart Loop: Targeting second POI "${secondPoi.name}" at distance ${Math.round(d)}m (Target distance: ${targetDistM}m)`);

  // Start point
  const start = { lat: centerLat, lng: centerLng };
  waypoints.push(start);

  // We want to construct a route: start -> secondPoi -> detour/loop around secondPoi -> detour back -> start
  if (targetDistM <= 5 * d) {
    // Use the perpendicular detour point triangle
    // Midpoint between start and secondPoi
    const midLat = (start.lat + secondPoi.lat) / 2;
    const midLng = (start.lng + secondPoi.lng) / 2;

    // Flat bearing calculation
    const dLat = secondPoi.lat - start.lat;
    const dLng = secondPoi.lng - start.lng;
    const bearing = Math.atan2(dLng, dLat) * 180 / Math.PI;

    // Perpendicular height h
    const h2 = Math.pow(targetDistM - d, 2) - Math.pow(d, 2);
    const h = h2 > 0 ? Math.sqrt(h2) / 2 : 100;

    // Detour point: offset from midpoint perpendicularly
    const detourAngle = bearing + (Math.random() < 0.5 ? 90 : -90);
    const detourPt = destinationPoint(midLat, midLng, detourAngle, h);

    waypoints.push({ lat: secondPoi.lat, lng: secondPoi.lng });
    waypoints.push(detourPt);
  } else {
    // Target distance is large (targetDistM > 5 * d)
    // Run to secondPoi, do a loop around it, then return to start
    waypoints.push({ lat: secondPoi.lat, lng: secondPoi.lng });

    const remainingDist = targetDistM - d; // remaining distance for the loop + return path
    // Let the loop circumference be roughly remainingDist - d
    const loopDist = remainingDist - d;
    const loopRadius = loopDist / (2 * Math.PI);
    const clampedRadius = Math.max(100, Math.min(loopRadius, 1200));

    // Generate 3 loop points around the secondPoi
    const numLoopWP = 3;
    const startBearing = randomInRange(0, 360);
    for (let i = 0; i < numLoopWP; i++) {
      const angle = startBearing + (360 * i / numLoopWP) + randomInRange(-20, 20);
      const r = clampedRadius * randomInRange(0.8, 1.2);
      waypoints.push(destinationPoint(secondPoi.lat, secondPoi.lng, angle, r));
    }
  }

  // Return to start
  waypoints.push({ ...start });
  return waypoints;
}

function generateOutBackWaypoints(centerLat, centerLng, targetDistKm, districtKey = null, startTargetInfo = null) {
  const targetDistM = targetDistKm * 1000;
  const halfDistM = targetDistM / 2 / 1.35;
  const numLegs = Math.max(2, Math.floor(targetDistKm));
  const legDist = halfDistM / numLegs;

  const generateDefaultOutBack = () => {
    const bearing = randomInRange(0, 360);
    const outPoints = [{ lat: centerLat, lng: centerLng }];
    let cur = { lat: centerLat, lng: centerLng };

    for (let i = 0; i < numLegs; i++) {
      const bear = bearing + randomInRange(-30, 30);
      cur = destinationPoint(cur.lat, cur.lng, bear, legDist * randomInRange(0.8, 1.2));
      outPoints.push(cur);
    }

    const retPoints = [];
    for (let i = outPoints.length - 1; i >= 1; i--) {
      retPoints.push({
        lat: outPoints[i].lat + randomInRange(-0.0001, 0.0001),
        lng: outPoints[i].lng + randomInRange(-0.0001, 0.0001),
      });
    }
    retPoints.push({ lat: centerLat, lng: centerLng });
    return [...outPoints, ...retPoints];
  };

  // Check if we can target a POI
  if (!districtKey || !RUNNING_POIS[districtKey]) {
    return generateDefaultOutBack();
  }

  let shouldTargetPoi = false;
  if (startTargetInfo && startTargetInfo.isPoi) {
    // If start is POI, only 30% chance to target another POI
    shouldTargetPoi = Math.random() < 0.30;
  } else {
    // If start is home/work or random, 100% chance to target a nearby POI
    shouldTargetPoi = true;
  }

  if (!shouldTargetPoi) {
    return generateDefaultOutBack();
  }

  // Find eligible POIs that are close enough
  const startPt = { lat: centerLat, lng: centerLng };
  const allPois = RUNNING_POIS[districtKey] || [];
  const eligiblePois = [];

  for (const poi of allPois) {
    if (startTargetInfo && startTargetInfo.isPoi && startTargetInfo.poiName === poi.name) {
      continue;
    }
    const d = haversineDistance(startPt.lat, startPt.lng, poi.lat, poi.lng);
    // Distance must be <= halfDistM and <= 1500m
    if (d >= 100 && d <= 1500 && d <= halfDistM) {
      eligiblePois.push({ poi, d });
    }
  }

  if (eligiblePois.length === 0) {
    return generateDefaultOutBack();
  }

  // Pick nearest eligible POI
  eligiblePois.sort((a, b) => a.d - b.d);
  const chosen = eligiblePois[0];
  const targetPoi = chosen.poi;
  const d = chosen.d;

  console.log(`[Route Engine] Smart Out-Back: Heading to POI "${targetPoi.name}" at distance ${Math.round(d)}m (Half-dist: ${Math.round(halfDistM)}m)`);

  const outPoints = [{ lat: centerLat, lng: centerLng }];
  
  // First leg goes to targetPoi
  outPoints.push({ lat: targetPoi.lat, lng: targetPoi.lng });

  // Remaining distance for the outbound path
  const remainingOutM = halfDistM - d;
  if (remainingOutM > 100) {
    // Continue running past/around the POI
    const dLat = targetPoi.lat - centerLat;
    const dLng = targetPoi.lng - centerLng;
    const bearing = Math.atan2(dLng, dLat) * 180 / Math.PI;

    // Add extra leg(s) past the POI
    const extraBear = bearing + randomInRange(-25, 25);
    const finalOutPt = destinationPoint(targetPoi.lat, targetPoi.lng, extraBear, remainingOutM);
    outPoints.push(finalOutPt);
  }

  // Return path with slight offset
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

/**
 * Resamples route points to a uniform distance step (e.g. 10m)
 * to prevent sparse coordinate segments from causing strange Strava pace chart humps.
 */
function resampleRoute(points, stepM = 10) {
  if (points.length < 2) return points;

  const resampled = [];
  resampled.push({ ...points[0] });

  let currentTargetDist = stepM;
  let i = 1;

  while (i < points.length) {
    const prev = points[i - 1];
    const curr = points[i];

    if (curr.distance >= currentTargetDist) {
      const segDist = curr.distance - prev.distance;
      if (segDist === 0) {
        i++;
        continue;
      }
      const t = (currentTargetDist - prev.distance) / segDist;
      const interpPt = {
        lat: prev.lat + (curr.lat - prev.lat) * t,
        lng: prev.lng + (curr.lng - prev.lng) * t,
        distance: currentTargetDist
      };
      if (prev.elevation !== undefined && curr.elevation !== undefined) {
        interpPt.elevation = prev.elevation + (curr.elevation - prev.elevation) * t;
      }
      resampled.push(interpPt);
      currentTargetDist += stepM;
    } else {
      i++;
    }
  }

  const last = points[points.length - 1];
  if (resampled[resampled.length - 1].distance < last.distance) {
    resampled.push({ ...last });
  }

  return resampled;
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
    activityAreas = [], // Custom home/work circles
    startNearFavoritePlace = true, // Priority toggle
  } = options;

  // Determine center point
  let centerLat = startLat, centerLng = startLng;
  let waypoints = [];
  const routeType = distanceKm < 2 ? 'out-back' : (Math.random() > 0.35 ? 'loop' : 'out-back');

  let startTargetInfo = null;
  if (districtKeys && districtKeys.length > 0) {
    const startTarget = getDistrictTargetCenter(districtKeys[0], activityAreas, startNearFavoritePlace);
    if (startTarget) {
      startTargetInfo = startTarget;
      // Randomize start within the selected target bounds
      const b = randomInRange(0, 360);
      const pt = destinationPoint(startTarget.lat, startTarget.lng, b, startTarget.radiusM);
      centerLat = pt.lat;
      centerLng = pt.lng;
    }
  }

  // Generate loop or out-and-back waypoints around the start coordinate (centerLat, centerLng)
  waypoints = routeType === 'loop'
    ? generateLoopWaypoints(centerLat, centerLng, distanceKm, districtKeys[0], startTargetInfo)
    : generateOutBackWaypoints(centerLat, centerLng, distanceKm, districtKeys[0], startTargetInfo);

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
      console.log(`[Route] OSRM success: ${points.length} pts, ${(points[points.length - 1].distance / 1000).toFixed(2)}km`);
    } catch (err) {
      console.warn('[Route] OSRM failed, using fallback:', err.message);
      points = fallbackRoute(waypoints, targetDistM);
    }
  } else {
    points = fallbackRoute(waypoints, targetDistM);
  }

  // Resample points to uniform 10m spacing for smooth, realistic pace graphs on Strava
  points = resampleRoute(points, 10);

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

// ─── Elevation (Hanoi: 2-20m) ──────────────────────────────────────────────────

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
      + randomInRange(-0.05, 0.05);
    points[i].elevation = Math.max(2, Math.min(20, Math.round(ele * 10) / 10));
  }
  return points;
}

// ─── Timestamps ───────────────────────────────────────────────────────────────

function generateTimestamps(points, options = {}) {
  const { startTime = new Date(), avgPaceMinPerKm = 7.0, paceVariation = 0.12 } = options;
  const redLightsProbability = options.redLightsProbability !== undefined ? options.redLightsProbability : 0.015;
  const redLightsMinDuration = options.redLightsMinDuration !== undefined ? options.redLightsMinDuration : 15;
  const redLightsMaxDuration = options.redLightsMaxDuration !== undefined ? options.redLightsMaxDuration : 60;
  const avgSpeed = 1000 / (avgPaceMinPerKm * 60);

  let cur = new Date(startTime);
  // Round start time to nearest second
  cur = new Date(Math.round(cur.getTime() / 1000) * 1000);

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
      // Clamp gradient to prevent extreme spikes on tiny segments
      const clampedGrad = Math.max(-0.08, Math.min(0.08, grad));
      paceFactor += clampedGrad * 4;
    }

    const speed = avgSpeed / Math.max(0.5, paceFactor);
    const secs = segDist > 0 ? segDist / speed : 0;

    // Add seconds and round next point's time to nearest second
    let nextTimeMs = cur.getTime() + secs * 1000;
    let nextTimeRounded = Math.round(nextTimeMs / 1000) * 1000;

    // Enforce that the time must advance by at least 1 second (1000ms)
    if (nextTimeRounded <= cur.getTime()) {
      nextTimeRounded = cur.getTime() + 1000;
    }

    cur = new Date(nextTimeRounded);
    pt.time = new Date(cur);

    // Simulate Red Light / Pause (approx 1.5% chance per point if not near start/end)
    if (options.simRedLights !== false && progress > 0.1 && progress < 0.9 && Math.random() < redLightsProbability) {
      const pauseSecs = randomInRange(redLightsMinDuration, redLightsMaxDuration);
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
  const weatherProbability = options.weatherProbability !== undefined ? options.weatherProbability : 0.3;
  const weatherHRMin = options.weatherHRMin !== undefined ? options.weatherHRMin : 5;
  const weatherHRMax = options.weatherHRMax !== undefined ? options.weatherHRMax : 15;

  // Simulate weather factor randomly (hot weather = +HR)
  const isHotWeather = options.simWeather !== false && Math.random() < weatherProbability;
  let weatherFactor = isHotWeather ? randomInRange(weatherHRMin, weatherHRMax) : 0;

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
