/**
 * StrAct Z - Centralized Configuration and Limits
 * This file defines all system constraints, UI ranges, and default values.
 */

const LIMITS = {
  // ─── Hidden / System ──────────────────────────────────────────────────────
  daily_upload_limit: {
    label: 'Số lượng upload tối đa lên Strava mỗi ngày.',
    type: 'int',
    default: 2,
    min_range: { normal: 2, vip: 5 },
    max_range: { normal: 2, vip: 5 }
  },

  // ─── Route Configuration ──────────────────────────────────────────────────
  allowed_districts: {
    label: 'Các quận được phép tạo lộ trình.',
    type: 'array',
    // Default: Enable all except nam_tu_liem, bac_tu_liem
    default: ['hoan_kiem', 'ba_dinh', 'hai_ba_trung', 'dong_da', 'tay_ho', 'cau_giay', 'thanh_xuan', 'ha_dong', 'long_bien', 'hoang_mai'],
    default_label: '10 quận nội thành',
    min: { normal: 4, vip: 2 },
    max: { normal: 10, vip: 12 }
  },
  max_district_span: {
    label: 'Số lượng quận tối đa một lộ trình có thể đi qua.',
    type: 'int',
    default: 1,
    min: 1,
    max: { normal: 2, vip: 3 }
  },
  overlap_protection_minutes: {
    label: 'Thời gian đệm tối thiểu giữa các hoạt động để tránh trùng lặp.',
    type: 'int',
    default: 30,
    min: 10,
    max: { normal: 60, vip: 120 },
    unit: 'phút'
  },
  use_osrm: {
    label: 'Lộ trình đi theo đường thực tế qua OSRM.',
    desc_extra: 'Tắt để dùng đường chim bay fallback',
    type: 'bool',
    default: true
  },
  custom_time_enabled: {
    label: 'Giới hạn thời gian cho ngày mục tiêu.',
    type: 'bool',
    default: false
  },
  random_time_bounds: {
    label: 'Thời gian bắt đầu hoạt động ngẫu nhiên.',
    type: 'time',
    default: { start: '04:30', end: '21:30' }
  },
  avoid_workhours: {
    label: 'Khung giờ không tạo hoạt động ngẫu nhiên.',
    type: 'time',
    default: { 
      start1: '08:00', end1: '11:30', 
      start2: '13:30', end2: '17:30' 
    }
  },
  target_date: {
    label: 'Tạo hoạt động cho một ngày trong quá khứ.',
    type: 'date',
    default: 'Hôm nay',
    min: 'today',
    max: { normal: 7, vip: 30 }, // days ago
    unit: 'ngày'
  },
  min_distance_km: {
    label: 'Khoảng cách tối thiểu của hoạt động.',
    type: 'float',
    default: 0.5,
    min: { normal: 0.2, vip: 0.1 },
    max: { normal: 2.0, vip: 4.0 },
    unit: 'km'
  },
  max_distance_km: {
    label: 'Khoảng cách tối đa của hoạt động.',
    type: 'float',
    default: 8.0,
    min: 2.0,
    max: { normal: 10.0, vip: 15.0 },
    unit: 'km'
  },

  // ─── Auto Schedule ────────────────────────────────────────────────────────
  schedule_enabled: {
    label: 'Tự động tạo hoạt động hàng ngày.',
    type: 'bool',
    default: false
  },
  schedule_time: {
    label: 'Thời điểm hệ thống tự động chạy hàng ngày.',
    type: 'time',
    default: '06:00'
  },
  schedule_count_min: {
    label: 'Số lượng hoạt động tối thiểu tạo tự động mỗi ngày.',
    type: 'int',
    default: 1,
    min: 0,
    max: 1
  },
  schedule_count_max: {
    label: 'Số lượng hoạt động tối đa tạo tự động mỗi ngày.',
    type: 'int',
    default: 2,
    min: 1,
    max: { normal: 2, vip: 3 }
  },

  // ─── Activity Areas (Map) ─────────────────────────────────────────────────
  map_locked: {
    label: 'Khóa vị trí bản đồ hiện tại.',
    type: 'bool',
    default: true
  },
  home_count: {
    label: 'Số lượng điểm Nhà.',
    type: 'int',
    default: 0,
    min: 0,
    max: 1
  },
  work_count: {
    label: 'Số lượng điểm Công ty.',
    type: 'int',
    default: 0,
    min: 1,
    max: { normal: 1, vip: 2 }
  },
  scale_radius: {
    label: 'Bán kính khu vực ưu tiên.',
    type: 'int',
    default: 2000,
    min: 2000,
    max: 4000,
    unit: 'm'
  },

  // ─── Activity Settings ────────────────────────────────────────────────────
  activity_type: {
    label: 'Loại hoạt động GPX sẽ được tạo.',
    desc_extra: 'Hệ số Dist/Pace: Walk 0.7x/1.25x, Run 1x/0.8x, Ride 1.5x/0.5x',
    type: 'array',
    default: 'Random',
    default_label: 'Ngẫu nhiên (60% Chạy, 30% Đi bộ, 10% Đạp xe)',
    choices: ['Random', 'Run', 'Walk', 'Ride'],
    weights: {
      Random: { Run: 0.6, Walk: 0.3, Ride: 0.1 },
      Run: { Run: 1.0, Walk: 0.0, Ride: 0.0 },
      Walk: { Run: 0.0, Walk: 1.0, Ride: 0.0 },
      Ride: { Run: 0.0, Walk: 0.0, Ride: 1.0 }
    }
  },
  heart_rate_enabled: {
    label: 'Mô phỏng dữ liệu nhịp tim trong file GPX.',
    desc_extra: 'Dựa trên MHR: Walk 50-60%, Ride 60-70%, Run 70-85%',
    type: 'bool',
    default: true
  },
  user_age: {
    label: 'Tuổi người dùng để tính nhịp tim tối đa.',
    desc_extra: 'MHR = 220 - Tuổi',
    type: 'int',
    default: 25,
    min: 18,
    max: 90
  },
  heart_rate_zones: {
    label: 'Vùng nhịp tim mô phỏng.',
    type: 'map',
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
    label: 'Tốc độ nhanh nhất cho phép.',
    desc_extra: 'Giá trị thay đổi theo loại hoạt động',
    type: 'float',
    default: 8.0,
    min: 6.0,
    max: 12.0
  },
  max_pace: {
    label: 'Tốc độ chậm nhất cho phép.',
    desc_extra: 'Giá trị thay đổi theo loại hoạt động',
    type: 'float',
    default: 12.0,
    min: 10.0,
    max: 15.0
  },
  sim_weather: {
    label: 'Giả lập tác động của thời tiết.',
    desc_extra: 'Tỉ lệ 30% gặp trời nóng, khung giờ 11h-16h stress hơn',
    type: 'bool',
    default: true
  },
  sim_redlights: {
    label: 'Giả lập dừng đèn đỏ.',
    desc_extra: 'Xác suất 1.5% mỗi điểm, dừng 15-60s',
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
      const min_val = (item.min && typeof item.min === 'object' ? item.min[role] : item.min) || 
                  (item.min_range ? item.min_range[role] : 0);
      const max_val = (item.max && typeof item.max === 'object' ? item.max[role] : item.max) || 
                  (item.max_range ? item.max_range[role] : 0);
      
      result[key] = {
        ...item,
        min: min_val,
        max: max_val,
        // Also keep full range info for UI hints
        full_min: item.min,
        full_max: item.max,
        full_min_range: item.min_range,
        full_max_range: item.max_range
      };
    } else {
      result[key] = item;
    }
  }
  
  // Legacy compatibility
  result.hr_zones = LIMITS.heart_rate_zones[role];
  result.activity_type_weights = LIMITS.activity_type.weights.Random;
  
  // Dynamic value extraction for legacy code
  const getVal = (item, role) => {
    if (!item) return undefined;
    if (item.max_range) return typeof item.max_range === 'object' ? item.max_range[role] : item.max_range;
    if (item.max) return typeof item.max === 'object' ? item.max[role] : item.max;
    return item.default;
  };

  result.max_district_span_val = getVal(LIMITS.max_district_span, role) || 1;
  result.overlap_protection_minutes_val = LIMITS.overlap_protection_minutes.default;
  result.daily_upload_limit_val = getVal(LIMITS.daily_upload_limit, role) || 2;
  result.overlap_minutes = LIMITS.overlap_protection_minutes.default;

  return result;
}

module.exports = {
  ...LIMITS,
  getLimits,
  normal: getLimits('normal'),
  vip: getLimits('vip')
};
