/**
 * Activity Configuration Builder Utility
 * Unifies the parameters built for generateActivity from database config and overrides.
 */

const systemLimits = require('../config/limits');

function buildGeneratorConfig(config, overrides = {}, lastUploaded = null, role = 'normal') {
  const ov = overrides;
  const targetDate = ov.target_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  
  return {
    districtKey: null,
    selected_districts: ov.selected_districts || config.selected_districts,
    max_district_span: ov.max_district_span || config.max_district_span,
    targetDate: targetDate,
    minTime: (ov.min_time === '00:00') ? config.min_time : (ov.min_time || config.min_time),
    maxTime: (ov.min_time === '00:00') ? config.max_time : (ov.max_time || config.max_time),
    workStart1: ov.work_start1 || config.work_start1,
    workEnd1: ov.work_end1 || config.work_end1,
    workStart2: ov.work_start2 || config.work_start2,
    workEnd2: ov.work_end2 || config.work_end2,
    minDistanceKm: parseFloat(ov.min_distance_km || config.min_distance_km),
    maxDistanceKm: parseFloat(ov.max_distance_km || config.max_distance_km),
    minPace: parseFloat(ov.min_pace || config.min_pace),
    maxPace: parseFloat(ov.max_pace || config.max_pace),
    activityType: ov.activity_type || config.activity_type,
    heartRateEnabled: String(ov.heart_rate_enabled !== undefined ? ov.heart_rate_enabled : config.heart_rate_enabled) === 'true',
    minHeartRate: parseInt(ov.min_heart_rate || config.min_heart_rate),
    maxHeartRate: parseInt(ov.max_heart_rate || config.max_heart_rate),
    useOSRM: String(ov.use_osrm !== undefined ? ov.use_osrm : config.use_osrm) !== 'false',
    simWeather: String(ov.sim_weather !== undefined ? ov.sim_weather : config.sim_weather) !== 'false',
    simRedLights: String(ov.sim_redlights !== undefined ? ov.sim_redlights : config.sim_redlights) !== 'false',
    overlap_protection_minutes: ov.overlap_protection_minutes || config.overlap_protection_minutes,
    rest_time_percent: ov.rest_time_percent || config.rest_time_percent,
    userRole: role,
    boost_adjacent: String(ov.boost_adjacent !== undefined ? ov.boost_adjacent : config.boost_adjacent) !== 'false',
    last_district_keys: lastUploaded ? lastUploaded.district_keys : null,
    deviceName: ov.device_name || config.device_name || systemLimits.device_name.default,
    target_distance_enabled: String(ov.target_distance_enabled !== undefined ? ov.target_distance_enabled : config.target_distance_enabled) === 'true',
    target_distance_km: parseFloat(ov.target_distance_km || config.target_distance_km || '10.0'),
    activity_areas: ov.activity_areas || config.activity_areas,
    prioritize_centers: String(ov.prioritize_centers !== undefined ? ov.prioritize_centers : config.prioritize_centers) !== 'false',
  };
}

module.exports = { buildGeneratorConfig };
