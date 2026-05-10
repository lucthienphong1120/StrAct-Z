/**
 * StrAct Z - Centralized Configuration and Limits
 * This file defines all system constraints, UI ranges, and default values.
 */

const LIMITS = {
  // ─── Hidden / System ──────────────────────────────────────────────────────
  daily_upload_limit: {
    type: 'int',
    default: 2,
    min_range: { normal: 2, vip: 5 },
    max_range: { normal: 2, vip: 10 }
  },

  // ─── Route Configuration ──────────────────────────────────────────────────
  allowed_districts: {
    type: 'array',
    // Default: Enable all except nam_tu_liem, bac_tu_liem
    default: ['hoan_kiem', 'ba_dinh', 'hai_ba_trung', 'dong_da', 'tay_ho', 'cau_giay', 'thanh_xuan', 'ha_dong', 'long_bien', 'hoang_mai'],
    min: { normal: 4, vip: 2 },
    max: { normal: 10, vip: 12 }
  },
  max_district_span: {
    type: 'int',
    default: 1,
    min: 1,
    max: { normal: 2, vip: 3 }
  },
  overlap_protection_minutes: {
    type: 'int',
    default: 30,
    min: 10,
    max: { normal: 60, vip: 120 }
  },
  use_osrm: {
    type: 'bool',
    default: true
  },
  custom_time_enabled: {
    type: 'bool',
    default: false
  },
  random_time_bounds: {
    type: 'dict',
    default: { start: '04:30', end: '21:30' }
  },
  avoid_workhours: {
    type: 'dict',
    default: { 
      start1: '08:00', end1: '11:30', 
      start2: '13:30', end2: '17:30' 
    }
  },
  target_date: {
    type: 'date',
    default: 'today',
    min: 'today',
    max: { normal: 7, vip: 30 } // days ago
  },
  min_distance_km: {
    type: 'float',
    default: 0.5,
    min: { normal: 0.2, vip: 0.1 },
    max: { normal: 2.0, vip: 4.0 }
  },
  max_distance_km: {
    type: 'float',
    default: 8.0,
    min: 2.0,
    max: { normal: 10.0, vip: 15.0 }
  },

  // ─── Auto Schedule ────────────────────────────────────────────────────────
  schedule_enabled: {
    type: 'bool',
    default: false
  },
  schedule_time: {
    type: 'time',
    default: '22:00'
  },
  schedule_count_min: {
    type: 'int',
    default: 1,
    min: 0,
    max: 1
  },
  schedule_count_max: {
    type: 'int',
    default: 2,
    min: 1,
    max: { normal: 2, vip: 3 }
  },

  // ─── Activity Areas (Map) ─────────────────────────────────────────────────
  map_locked: {
    type: 'bool',
    default: true
  },
  home_count: {
    type: 'int',
    default: 0,
    min: 0,
    max: 1
  },
  work_count: {
    type: 'int',
    default: 0,
    min: 1,
    max: { normal: 1, vip: 2 }
  },
  scale_radius: {
    type: 'int',
    default: 2000,
    min: 2000,
    max: 4000
  },

  // ─── Activity Settings ────────────────────────────────────────────────────
  activity_type: {
    type: 'dict',
    default: 'Random',
    choices: ['Random', 'Run', 'Walk', 'Ride'],
    weights: {
      Random: { Run: 0.6, Walk: 0.3, Ride: 0.1 },
      Run: { Run: 1.0, Walk: 0.0, Ride: 0.0 },
      Walk: { Run: 0.0, Walk: 1.0, Ride: 0.0 },
      Ride: { Run: 0.0, Walk: 0.0, Ride: 1.0 }
    }
  },
  heart_rate_enabled: {
    type: 'bool',
    default: true
  },
  user_age: {
    type: 'int',
    default: 25,
    min: 18,
    max: 90
  },
  heart_rate_zones: {
    normal: {
      Walk: { min: 0.50, max: 0.60 },
      Ride: { min: 0.60, max: 0.70 },
      Run: { min: 0.70, max: 0.85 }
    },
    vip: {
      Walk: { min: 0.45, max: 0.65 },
      Ride: { min: 0.55, max: 0.75 },
      Run: { min: 0.65, max: 0.90 }
    }
  },
  min_pace: {
    type: 'float',
    default: 8.0,
    min: 6.0,
    max: 12.0
  },
  max_pace: {
    type: 'float',
    default: 12.0,
    min: 10.0,
    max: 15.0
  },
  sim_weather: {
    type: 'bool',
    default: true
  },
  sim_redlights: {
    type: 'bool',
    default: true
  }
};

/**
 * Helper to get role-specific limits
 */
function getLimits(role = 'normal') {
  const result = {
    _role: role
  };
  for (const key in LIMITS) {
    const item = LIMITS[key];
    if (item.type) {
      const min = (item.min && typeof item.min === 'object' ? item.min[role] : item.min) || 
                  (item.min_range ? item.min_range[role] : undefined) || 0;
      const max = (item.max && typeof item.max === 'object' ? item.max[role] : item.max) || 
                  (item.max_range ? item.max_range[role] : undefined) || 0;
      
      result[key] = {
        ...item,
        min: min,
        max: max
      };
      
      // Legacy compatibility: add flat values with _ prefix or specific names
      if (['overlap_protection_minutes', 'max_district_span', 'daily_upload_limit'].includes(key)) {
        // We can't overwrite the key if we want to keep the object for UI
        // So we'll add them as properties of the returned object root if they don't conflict
      }
    } else {
      result[key] = item;
    }
  }
  
  // Explicitly add fields expected by legacy code in the format they expect
  result.hr_zones = LIMITS.heart_rate_zones[role];
  result.activity_type_weights = LIMITS.activity_type.weights.Random;
  
  // For Generator and API validation that expects simple numbers
  result.max_district_span_val = result.max_district_span.max;
  result.overlap_protection_minutes_val = LIMITS.overlap_protection_minutes.default;
  result.daily_upload_limit_val = result.daily_upload_limit.max;
  
  // Legacy compatibility for Generator (specific keys)
  result.overlap_minutes = LIMITS.overlap_protection_minutes.default;

  return result;
}

module.exports = {
  ...LIMITS,
  getLimits,
  // Export legacy groups for compatibility
  normal: getLimits('normal'),
  vip: getLimits('vip')
};
