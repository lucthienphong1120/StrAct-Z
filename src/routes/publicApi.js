/**
 * StrAct Z - Public API Routes
 * Programmatic access protected by User API Token and IP lockout brute-force protection
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const db = require('../db/database');
const fitGenerator = require('../services/fit-generator');
const gpxGenerator = require('../services/gpx-generator');
const stravaApi = require('../services/strava-api');
const systemLimits = require('../config/limits');
const { buildGeneratorConfig } = require('../utils/activity-config-builder');
const { validateConfig } = require('../utils/validation');
const { authenticateApiToken } = require('../middleware/auth');

// ─── Rate Limiters ──────────────────────────────────────────────────────────

const publicGetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Limit each IP to 60 requests per windowMs
  message: { error: 'Too many read requests from this IP, please try again later.', code: 'PUBLIC_GET_LIMIT_EXCEEDED' },
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
});

const publicPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { error: 'Too many activity generation attempts from this IP, please try again later.', code: 'PUBLIC_POST_LIMIT_EXCEEDED' },
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiters before authentication to protect token validation logic from DDoS
router.use('/activities', publicGetLimiter);
router.use('/stats', publicGetLimiter);
router.use('/activities/generate', publicPostLimiter);

// Apply API Token Authentication to all endpoints under /api/public
router.use(authenticateApiToken);

// ─── Vietnam Province Codes ──────────────────────────────────────────────────

const VN_PROVINCE_CODES = {
  'VN-HN': 'Thành phố Hà Nội',
  'VN-SG': 'Thành phố Hồ Chí Minh',
  'VN-DN': 'Thành phố Đà Nẵng',
  'VN-HP': 'Thành phố Hải Phòng',
  'VN-CT': 'Thành phố Cần Thơ',
  'VN-01': 'Tỉnh Lai Châu',
  'VN-02': 'Tỉnh Lào Cai',
  'VN-03': 'Tỉnh Hà Giang',
  'VN-04': 'Tỉnh Cao Bằng',
  'VN-05': 'Tỉnh Sơn La',
  'VN-06': 'Tỉnh Yên Bái',
  'VN-07': 'Tỉnh Tuyên Quang',
  'VN-09': 'Tỉnh Lạng Sơn',
  'VN-13': 'Tỉnh Quảng Ninh',
  'VN-14': 'Tỉnh Hòa Bình',
  'VN-18': 'Tỉnh Ninh Bình',
  'VN-20': 'Tỉnh Thái Bình',
  'VN-21': 'Tỉnh Thanh Hóa',
  'VN-22': 'Tỉnh Nghệ An',
  'VN-23': 'Tỉnh Hà Tĩnh',
  'VN-24': 'Tỉnh Quảng Bình',
  'VN-25': 'Tỉnh Quảng Trị',
  'VN-26': 'Tỉnh Thừa Thiên Huế',
  'VN-27': 'Tỉnh Quảng Nam',
  'VN-28': 'Tỉnh Kon Tum',
  'VN-29': 'Tỉnh Quảng Ngãi',
  'VN-30': 'Tỉnh Gia Lai',
  'VN-31': 'Tỉnh Bình Định',
  'VN-32': 'Tỉnh Phú Yên',
  'VN-33': 'Tỉnh Đắk Lắk',
  'VN-34': 'Tỉnh Khánh Hòa',
  'VN-35': 'Tỉnh Lâm Đồng',
  'VN-36': 'Tỉnh Ninh Thuận',
  'VN-37': 'Tỉnh Tây Ninh',
  'VN-39': 'Tỉnh Đồng Nai',
  'VN-40': 'Tỉnh Bình Thuận',
  'VN-41': 'Tỉnh Long An',
  'VN-43': 'Tỉnh Bà Rịa - Vũng Tàu',
  'VN-44': 'Tỉnh An Giang',
  'VN-45': 'Tỉnh Đồng Tháp',
  'VN-46': 'Tỉnh Tiền Giang',
  'VN-47': 'Tỉnh Kiên Giang',
  'VN-49': 'Tỉnh Vĩnh Long',
  'VN-50': 'Tỉnh Bến Tre',
  'VN-51': 'Tỉnh Trà Vinh',
  'VN-52': 'Tỉnh Sóc Trăng',
  'VN-53': 'Tỉnh Bắc Kạn',
  'VN-54': 'Tỉnh Bắc Giang',
  'VN-55': 'Tỉnh Bạc Liêu',
  'VN-56': 'Tỉnh Bắc Ninh',
  'VN-57': 'Tỉnh Bình Dương',
  'VN-58': 'Tỉnh Bình Phước',
  'VN-59': 'Tỉnh Cà Mau',
  'VN-61': 'Tỉnh Hải Dương',
  'VN-63': 'Tỉnh Hà Nam',
  'VN-66': 'Tỉnh Hưng Yên',
  'VN-67': 'Tỉnh Nam Định',
  'VN-68': 'Tỉnh Phú Thọ',
  'VN-69': 'Tỉnh Thái Nguyên',
  'VN-70': 'Tỉnh Vĩnh Phúc',
  'VN-71': 'Tỉnh Điện Biên',
  'VN-72': 'Tỉnh Đắk Nông',
  'VN-73': 'Tỉnh Hậu Giang'
};

// ─── Reverse Geocoding Utility ────────────────────────────────────────────────

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`, {
      headers: {
        'Accept-Language': 'vi,en',
        'User-Agent': 'StrAct-Z/3.0.0 (contact@crfnetwork.com)'
      }
    });
    if (!res.ok) throw new Error('OSM Nominatim lookup failed');
    const data = await res.json();
    if (!data.address) return null;

    const addr = data.address;
    const district = addr.suburb || addr.quarter || addr.neighbourhood || addr.city_district || addr.district || addr.county || '';
    const city = addr.city || addr.town || addr.village || '';
    let state = addr.state || addr.province || addr.region || '';

    const isVietnam = addr.country_code === 'vn' || (addr.country && (addr.country === 'Việt Nam' || addr.country === 'Vietnam'));
    if (isVietnam && addr['ISO3166-2-lvl4']) {
      const isoCode = addr['ISO3166-2-lvl4'].toUpperCase();
      if (VN_PROVINCE_CODES[isoCode]) {
        state = VN_PROVINCE_CODES[isoCode];
      }
    }

    const uniqueParts = [];
    const seen = new Set();
    for (const p of [district, city, state]) {
      if (!p) continue;
      const norm = p.toLowerCase()
        .replace(/^(tỉnh|thành phố|quận|huyện|phường|xã|thị trấn|thị xã)\s+/i, '')
        .trim();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        uniqueParts.push(p);
      }
    }

    let locationStr = uniqueParts.join(', ');
    if (!locationStr && addr.country) {
      locationStr = addr.country;
    }
    return locationStr;
  } catch (e) {
    console.warn('[Geocoder] Reverse geocoding failed:', e.message);
    return null;
  }
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

// 1. Get Generated Activities (Read-only, Rate limit: 60/15min)
router.get('/activities', async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = parseInt(req.query.offset) || 0;
    const activities = await db.getActivities(req.user.id, limit, offset);
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Account Connection and Statistics (Read-only, Rate limit: 60/15min)
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getActivityStats(req.user.id);
    const tokens = await db.getTokens(req.user.id);
    const gfTokens = await db.getExternalTokens(req.user.id, 'google_fit');
    res.json({
      total: stats.total,
      uploaded: stats.uploaded,
      failed: stats.failed,
      totalDistanceKm: stats.totalDistanceKm,
      totalDurationMin: stats.totalDurationMin,
      todayCount: stats.todayCount,
      role: req.user.role,
      stravaConnected: !!(tokens && tokens.access_token),
      athleteName: tokens?.athlete_name || null,
      googleFitConnected: !!(gfTokens && gfTokens.access_token),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Trigger Activity Generation (Write-intensive, Rate limit: 5/15min)
router.post('/activities/generate', async (req, res) => {
  try {
    const lat = parseFloat(req.body.lat);
    const lon = parseFloat(req.body.lon || req.body.lng);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Vui lòng cung cấp tọa độ lat và lon (hoặc lng) hợp lệ dưới dạng số.' });
    }

    // Clean overrides
    const ov = req.body || {};
    delete ov.lat;
    delete ov.lon;
    delete ov.lng;
    delete ov.token;

    for (const key in ov) {
      if (ov[key] === "" || ov[key] === null || ov[key] === undefined) {
        delete ov[key];
      }
    }

    // Validate standard config overrides
    const validation = validateConfig(ov, req.user.role || 'basic');
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    // Reverse geocode position coordinates
    const locationName = await reverseGeocode(lat, lon);

    // Merge settings
    const config = await db.getAllConfig(req.user.id);
    const targetDate = ov.target_date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    let localActivities = await db.getActivitiesByDate(req.user.id, targetDate);
    
    let stravaActivities = [];
    const isStravaConnected = await stravaApi.isAuthenticated(req.user.id);
    if (isStravaConnected) {
      try {
        const after = Math.floor(new Date(`${targetDate}T00:00:00.000+07:00`).getTime() / 1000) - 1;
        stravaActivities = await stravaApi.getActivities(req.user.id, 1, 50, after, false);
        stravaActivities = stravaActivities.filter(a => (a.start_date_local || a.start_date).startsWith(targetDate));
        localActivities = await db.getActivitiesByDate(req.user.id, targetDate);
      } catch (e) { console.warn('Strava fetch failed for overlap checks'); }
    }

    const lastUploaded = await db.getLastUploadedActivity(req.user.id);

    const mergedOverrides = {
      ...ov,
      target_date: targetDate,
      near_me_lat: lat,
      near_me_lng: lon,
      location_name: locationName || 'ngoai_tinh',
    };

    const genConfig = buildGeneratorConfig(config, mergedOverrides, lastUploaded, req.user.role || 'basic');
    genConfig.existingActivities = [...localActivities, ...stravaActivities];
    genConfig.isManual = true;

    let format = ov.export_format || config.export_format || 'fit';
    const deviceNameForFormat = ov.device_name || config.device_name || systemLimits.device_name.default;
    if (gpxGenerator.shouldForceGPX(deviceNameForFormat)) format = 'gpx';

    // Generate Route & Output buffer
    const generator = format === 'gpx' ? gpxGenerator : fitGenerator;
    const activity = await generator.generateActivity(genConfig);

    const shouldUpload = req.body.upload === true || String(req.body.upload) === 'true';

    if (shouldUpload) {
      if (!isStravaConnected) {
        return res.status(400).json({ error: 'Tài khoản chưa kết nối với Strava để thực hiện upload.' });
      }

      const dailyMaxActivity = parseInt(ov.daily_max_activity || config.daily_max_activity || '2');
      if (stravaActivities.length >= dailyMaxActivity) {
        const errMsg = `Giới hạn upload hàng ngày là ${dailyMaxActivity}. Vui lòng xóa bớt trên Strava để tiếp tục.`;
        await db.saveActivity(req.user.id, {
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
          created_by: 'API',
          error_message: errMsg,
        });
        return res.status(403).json({ error: errMsg });
      }

      // Save activity with generated state
      const activityId = await db.saveActivity(req.user.id, {
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
        created_by: 'API',
      });

      // Trigger upload task
      const deviceName = ov.device_name || config.device_name || systemLimits.device_name.default;
      const uploadResult = await stravaApi.uploadActivity(req.user.id, activity.filepath, {
        name: activity.activityName,
        description: generator.getShortDescription(deviceName),
        sportType: activity.activityType || 'Run',
      });

      const finalStatus = await stravaApi.waitForUpload(req.user.id, uploadResult.id);

      const visibility = ov.strava_visibility || config.strava_visibility || 'everyone';
      if (visibility !== 'everyone' && finalStatus.activity_id) {
        try {
          await stravaApi.updateActivity(req.user.id, finalStatus.activity_id, { hide_from_home: true });
        } catch (err) {
          console.error('[Strava API] Failed to update visibility status:', err);
        }
      }

      await db.updateActivity(req.user.id, activityId, {
        strava_activity_id: String(finalStatus.activity_id),
        upload_status: 'uploaded',
      });

      stravaApi.clearActivityCache(req.user.id);

      res.json({
        success: true,
        activity: {
          id: activityId,
          name: activity.activityName,
          distanceKm: activity.distanceKm,
          durationMin: activity.durationMin,
          paceMinKm: activity.paceMinKm,
          filename: activity.filename,
          districtKey: activity.districtKey,
          uploadStatus: 'uploaded',
          stravaActivityId: finalStatus.activity_id
        }
      });
    } else {
      // Just save under generated draft state
      const activityId = await db.saveActivity(req.user.id, {
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
        created_by: 'API',
      });

      res.json({
        success: true,
        activity: {
          id: activityId,
          name: activity.activityName,
          distanceKm: activity.distanceKm,
          durationMin: activity.durationMin,
          paceMinKm: activity.paceMinKm,
          filename: activity.filename,
          districtKey: activity.districtKey,
          uploadStatus: 'generated'
        }
      });
    }
  } catch (err) {
    console.error('[Public API Generate] Error:', err);
    if (err.code === 'NO_VALID_TIME_SLOT') {
      try {
        await db.saveActivity(req.user.id, {
          activity_name: 'Không thể tạo hoạt động',
          distance_km: 0,
          duration_min: 0,
          pace_min_km: 0,
          fit_file: null,
          upload_status: 'failed',
          route_start_lat: null,
          route_start_lng: null,
          route_start_time: new Date().toISOString(),
          district_keys: null,
          created_by: 'API',
          error_message: err.message,
        });
      } catch (_) { }
      return res.status(499).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
