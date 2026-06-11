/**
 * StrAct Z - Centralized Configuration and Limits
 * This file defines all system constraints, UI ranges, and default values.
 * Reorganized to match the exact visual display order on the UI.
 */

const { getDefaultKeys } = require('./districts');

const LIMITS = {
  // ─── 🗺️ Route Configuration ───────────────────────────────────────────────
  selected_districts: {
    label: 'Các quận được phép tạo lộ trình.',
    type: 'array',
    // Default: Dynamically resolved from districts registry
    default: getDefaultKeys(),
    default_label: 'Các quận nội thành mặc định',
    min: { basic: 4, vip: 2 },
    max: { basic: 10, vip: 15 }
  },
  max_district_span: {
    label: 'Số lượng quận tối đa một lộ trình có thể đi qua.',
    type: 'int',
    default: 1,
    min: 1,
    max: { basic: 2, vip: 3 }
  },
  use_osrm: {
    label: 'Lộ trình đi theo đường thực tế qua OSRM.',
    desc_extra: 'Tắt để dùng đường chim bay fallback',
    type: 'bool',
    default: true
  },
  boost_adjacent: {
    label: 'Tăng trọng số cho quận hoạt động gần nhất và lân cận.',
    desc_extra: 'Tác dụng: Quận hoạt động gần nhất sẽ được cộng thêm +2.1 trọng số, các quận lân cận được cộng thêm +1.4 trọng số.',
    type: 'bool',
    default: true,
    adjacent_weight: 1.4,
    same_weight: 2.1
  },
  start_near_favorite_place: {
    label: 'Tự động chọn điểm xuất phát gần Priority Areas (nếu có) hoặc các POI nổi tiếng (công viên, hồ, đường chạy,...) thay vì ngẫu nhiên.',
    desc_extra: 'Tác dụng: Tỉ lệ chọn điểm xuất phát: 60%/35%/5% (nếu có cả Home và Work), 40%/50%/10% (nếu chỉ có Home hoặc Work), và 0%/75%/25% (nếu không có Priority Areas).',
    type: 'bool',
    default: true
  },

  // ─── 📍 Map & Priority Areas ──────────────────────────────────────────
  map_locked: {
    label: 'Khóa vị trí bản đồ.',
    desc_extra: 'Tác dụng: Khóa di chuyển và phóng to bản đồ bằng chuột để tránh vô tình thay đổi vị trí.',
    type: 'bool',
    default: true
  },
  map_lat: {
    label: 'Vĩ độ bản đồ.',
    type: 'float',
    default: 21.0285
  },
  map_lng: {
    label: 'Kinh độ bản đồ.',
    type: 'float',
    default: 105.8542
  },
  map_zoom: {
    label: 'Độ phóng đại bản đồ.',
    type: 'int',
    default: 12
  },
  home_count: {
    label: 'Giới hạn điểm Nhà.',
    desc_extra: 'Tác dụng: Số lượng điểm Nhà tối đa bạn có thể đặt trên bản đồ.',
    type: 'int',
    default: 0,
    min: 0,
    max: 1
  },
  work_count: {
    label: 'Giới hạn điểm Công ty.',
    desc_extra: 'Tác dụng: Số lượng điểm Công ty tối đa bạn có thể đặt trên bản đồ.',
    type: 'int',
    default: 0,
    min: 0,
    max: { basic: 1, vip: 2 }
  },
  scale_radius: {
    label: 'Giới hạn bán kính vùng ưu tiên.',
    desc_extra: 'Tác dụng: Khoảng cách tối đa mà một vùng Nhà/Công ty có thể bao phủ.',
    type: 'int',
    default: 2000,
    min: 2000,
    max: { basic: 3000, vip: 4000 },
    unit: 'm'
  },
  activity_areas: {
    label: 'Ưu tiên khu vực hoạt động.',
    type: 'map',
    desc_extra: 'Tác dụng: Tỉ lệ chọn các quận mặc định là 1:1, các quận giao với vùng phủ sóng của Nhà/Công ty sẽ được cộng thêm trọng số boost dựa trên tỷ lệ diện tích giao nhau (Ratio = Giao nhau / Diện tích hình nhỏ hơn).',
    example: 'Ratio >= 0.85 (Fully), Ratio >= 0.35 (Mostly), Ratio > 0 (Partially).',
    weights: {
      home: { fully: 20.0, mostly: 14.0, partially: 7.0 },
      work: { fully: 12.0, mostly: 7.5, partially: 3.0 }
    }
  },

  // ─── ⏱️ Time Configuration ─────────────────────────────────────────────────
  overlap_protection_minutes: {
    label: 'Thời gian đệm tối thiểu giữa các hoạt động để tránh trùng lặp.',
    type: 'int',
    default: 30,
    min: 15,
    max: { basic: 45, vip: 90 },
    unit: 'phút'
  },
  rest_time_percent: {
    label: 'Thời gian nghỉ sau hoạt động.',
    desc_extra: 'Bằng 50% thời lượng hoạt động trước đó.',
    type: 'int',
    default: 50,
    min: 0,
    max: 100,
    unit: '%'
  },
  custom_time_enabled: {
    label: 'Giới hạn thời gian cho ngày mục tiêu.',
    type: 'bool',
    default: false
  },
  random_time_bounds: {
    label: 'Thời gian bắt đầu hoạt động ngẫu nhiên (24h).',
    desc_extra: 'Định dạng 24:00',
    type: 'time',
    default: { start: '04:30', end: '22:30' }
  },
  avoid_workhours: {
    label: 'Khung giờ không tạo hoạt động ngẫu nhiên (24h).',
    desc_extra: 'Định dạng 24:00',
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
    max: { basic: 7, vip: 30 }, // days ago
    unit: 'ngày'
  },
  target_time_custom: {
    label: 'Thời gian cụ thể tạo hoạt động (Target Time).',
    desc_extra: 'Tác dụng: Chỉ định thời gian cụ thể. Đặt 00:00 để tự động tạo ngẫu nhiên thời gian trong ngày.',
    type: 'time',
    default: '00:00'
  },

  // ─── ⚙️ Activity Settings ──────────────────────────────────────────────────
  activity_type: {
    label: 'Loại hoạt động (Activity Type).',
    desc_extra: 'Tác dụng: Tỉ lệ tạo ngẫu nhiên từng loại hoạt động.',
    type: 'array',
    default: 'Random (misc)',
    default_label: 'Random (misc)',
    choices: ['Random (misc)', 'Random (rush)', 'Run', 'Walk', 'Ride'],
    min: 1,
    max: 1,
    weights: {
      'Random (misc)': { Run: 0.55, Walk: 0.30, Ride: 0.15 },
      'Random (rush)': { Run: 0.20, Walk: 0.10, Ride: 0.70 },
      'Run': { Run: 0.90, Walk: 0.05, Ride: 0.05 },
      'Walk': { Run: 0.05, Walk: 0.90, Ride: 0.05 },
      'Ride': { Run: 0.05, Walk: 0.05, Ride: 0.90 }
    }
  },
  device_name: {
    label: 'Thiết bị ghi nhận (Device Name).',
    desc_extra: 'Tác dụng: Thiết bị hiển thị ghi nhận hoạt động trên Strava.',
    type: 'array',
    default: 'Garmin fēnix 7x Pro',
    default_label: 'Garmin fēnix 7x Pro',
    choices: [
      'Garmin Forerunner 965',
      'Garmin Forerunner 745',
      'Garmin Forerunner 265',
      'Garmin Forerunner 165',
      'Garmin Forerunner 970',
      'Garmin Forerunner 570',
      'Garmin Instinct 3',
      'Garmin fēnix 7x Pro',
      'Garmin fēnix 8',
      'Garmin fēnix 8 Solar',
      'Garmin fēnix E',
      'Garmin Enduro 3',
      'Garmin Forerunner 255S',
      'Garmin Venu 3',
      'Garmin Venu 3S',
      'Garmin Venu 2',
      'Garmin Instinct 2X Solar',
      'Garmin epix Pro (Gen 2) 47mm',
      'Coros Pace 3',
      'Coros Apex 2 Pro',
      'Coros Vertix 2S',
      'Suunto Race S',
      'Suunto Vertical',
      'Amazfit T-Rex 3',
      'Amazfit Balance 2',
      'Amazfit Active 3 Premium',
      'Huawei Watch GT 6 Pro',
      'Huawei Watch Fit 5 Pro',
      'Huawei Watch GT 4 Pro',
      'Huawei Watch Fit 3',
      'Huawei Watch Ultimate',
      'Samsung Galaxy Watch Ultra',
      'Samsung Galaxy Watch 8',
      'Samsung Galaxy Watch 7',
      'Apple Watch Ultra 3',
      'Apple Watch Ultra 2',
      'Apple Watch Series 11',
      'Apple Watch Series 10',
      'Strava App',
      'Garmin Connect',
      'Zepp App',
      'Huawei Health',
      'Samsung Health',
      'Apple Sport',
      'COROS',
      'Suunto'
    ],
    min: 1,
    max: 1
  },
  min_distance_km: {
    label: 'Khoảng cách tối thiểu của hoạt động.',
    type: 'float',
    default: 0.5,
    min: { basic: 0.5, vip: 0.2 },
    max: { basic: 2.0, vip: 5.0 },
    unit: 'km'
  },
  max_distance_km: {
    label: 'Khoảng cách tối đa của hoạt động.',
    type: 'float',
    default: 8.0,
    min: 2.0,
    max: { basic: 10.0, vip: 15.0 },
    unit: 'km'
  },
  dist_multipliers: {
    label: 'Hệ số khoảng cách (Distance Multipliers).',
    type: 'map',
    desc_extra: 'Tác dụng: Điều chỉnh độ dài lộ trình thực tế dựa trên hệ số cơ bản.',
    example: 'Ví dụ: Ride 2.3x có nghĩa là cùng một lộ trình 10km, đạp xe sẽ đi được 23km.',
    default: { Walk: 0.55, Ride: 2.3, Run: 1.0 }
  },
  heart_rate_enabled: {
    label: 'Dữ liệu nhịp tim (Heart Rate).',
    desc_extra: 'Tác dụng: Mô phỏng nhịp tim dựa trên MHR và loại hoạt động.',
    type: 'bool',
    default: true
  },
  user_age: {
    label: 'Tuổi người dùng (User Age).',
    desc_extra: 'Tác dụng: Dùng để tính Nhịp tim tối đa (MHR = 220 - Tuổi).',
    type: 'int',
    default: 25,
    min: 18,
    max: 90
  },
  max_heart_rate: {
    label: 'Nhịp tim tối đa (Max Heart Rate).',
    desc_extra: 'Tác dụng: Được tự động tính dựa trên Tuổi (MHR = 220 - Tuổi).',
    type: 'int',
    default: 195,
    min: 130,
    max: 202
  },
  heart_rate_zones: {
    label: 'Vùng nhịp tim (Heart Rate Zones).',
    type: 'map',
    desc_extra: 'Tác dụng: Xác định giới hạn vùng nhịp tim dựa trên MHR theo từng loại hoạt động.',
    example: 'Ví dụ: một người 30 tuổi có MHR khoảng 190 bpm, khi đi bộ sẽ có nhịp tim từ 95-114 bpm (vùng Khởi động).',
    basic: {
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
  pace_multipliers: {
    label: 'Hệ số tốc độ (Pace Multipliers).',
    type: 'map',
    desc_extra: 'Tác dụng: Điều chỉnh tốc độ chạy thực tế so với hệ số cơ bản.',
    example: 'Ví dụ: Walk 1.7x có nghĩa là nhịp độ đi bộ sẽ chậm hơn 70% so với khi chạy bộ.',
    default: { Walk: 1.7, Ride: 0.45, Run: 1.0 }
  },
  sim_weather: {
    label: 'Giả lập thời tiết (Weather Sim).',
    desc_extra: 'Tác dụng: Tăng Nhịp tim (HR) thêm 5-15 bpm. Điều kiện: Ngẫu nhiên 30% hoặc khung giờ 11h-16h',
    type: 'bool',
    default: true,
    probability: 0.3,
    hr_increase_min: 5,
    hr_increase_max: 15
  },
  sim_redlights: {
    label: 'Giả lập đèn đỏ (Red Lights).',
    desc_extra: 'Tác dụng: Tăng Elapsed Time, Giảm Avg Pace, Giảm HR. Xác suất: 1.5% mỗi điểm, dừng 15-60s',
    type: 'bool',
    default: true,
    probability: 0.015,
    min_duration: 15,
    max_duration: 60
  },

  // ─── ⏰ Auto Schedule ──────────────────────────────────────────────────────
  schedule_enabled: {
    label: 'Tự động tạo hoạt động hàng ngày.',
    type: 'bool',
    default: false
  },
  schedule_time: {
    label: 'Mốc thời gian 1 (24h).',
    desc_extra: 'Thời gian hệ thống tự chạy hàng ngày 1. Định dạng 24:00',
    type: 'time',
    default: '22:00'
  },
  schedule_count: {
    label: 'Số lượng khung giờ chạy tự động.',
    type: 'int',
    default: 1,
    min: 1,
    max: { basic: 1, vip: 2 }
  },
  schedule_time_2: {
    label: 'Mốc thời gian 2 (24h).',
    desc_extra: 'Thời gian hệ thống tự chạy hàng ngày 2. Định dạng 24:00',
    type: 'time',
    default: '14:00'
  },
  schedule_count_min: {
    label: 'Số lượng hoạt động tối thiểu tạo tự động mỗi ngày.',
    type: 'int',
    default: 1,
    min: 0,
    max: 2
  },
  schedule_count_max: {
    label: 'Số lượng hoạt động tối đa tạo tự động mỗi ngày.',
    type: 'int',
    default: 1,
    min: 1,
    max: 2
  },
  target_distance_enabled: {
    label: 'Đặt mục tiêu cự ly hàng ngày.',
    desc_extra: 'Tác dụng: Khi được bật, hoạt động cuối cùng trong ngày sẽ điều chỉnh cự ly để cố gắng đạt tổng mục tiêu đề ra.',
    type: 'bool',
    default: false
  },
  target_distance_km: {
    label: 'Mục tiêu cự ly chạy ngày (Target Distance).',
    type: 'float',
    default: 10.0,
    min: 5.0,
    max: 30.0,
    unit: 'km'
  },

  // ─── 🛡️ Hidden / System / Other UI Info ─────────────────────────────────────
  daily_upload_limit: {
    label: 'Giới hạn tải lên (Daily Limit).',
    type: 'int',
    desc_extra: 'Tác dụng: Giới hạn số lượng hoạt động tải lên Strava mỗi ngày.',
    default: 2,
    min_range: { basic: 2, vip: 5 },
    max_range: { basic: 2, vip: 5 }
  },
  daily_max_activity: {
    label: 'Giới hạn hoạt động upload tùy chỉnh (Daily Max Activity).',
    type: 'int',
    desc_extra: 'Tác dụng: Tự điều chỉnh giới hạn số lượng hoạt động tải lên mỗi ngày (tối đa bằng Giới hạn tải lên mặc định của tài khoản).',
    default: 2,
    min: 1,
    max: { basic: 2, vip: 5 }
  },
  local_history: {
    label: 'Lịch sử hoạt động đã tạo (Local Generated History).',
    desc_extra: 'Trạng thái hoạt động:\n• UPLOADED: Đã tải lên Strava thành công.\n• GENERATED: Mới chỉ tạo file FIT local, chưa tải lên.\n• DELETED: Đã xóa cục bộ trước khi tải lên.\n• REMOVED: Đã tải lên nhưng sau đó bị xóa khỏi Strava Cloud.\n• FAILED: Không thể tạo hoạt động do lỗi cấu hình hoặc không tìm thấy khung giờ trống.',
    type: 'info'
  },
  strava_cloud: {
    label: 'Hoạt động trên Strava Cloud.',
    desc_extra: 'Hiển thị danh sách các hoạt động thực tế từ tài khoản Strava của bạn. Dữ liệu được đồng bộ trực tiếp từ máy chủ Strava.',
    type: 'info'
  },
  sync_google_fit: {
    label: 'Tự động đồng bộ sang Google Fit.',
    type: 'bool',
    default: false
  }
};

/**
 * Helper to get role-specific limits
 */
function getLimits(role = 'basic') {
  const result = {
    _role: role
  };
  for (const key in LIMITS) {
    const item = LIMITS[key];
    if (item.type) {
      const resItem = { ...item };

      if (item.min !== undefined || item.min_range !== undefined) {
        resItem.min = (item.min && typeof item.min === 'object' ? item.min[role] : item.min) ||
          (item.min_range ? item.min_range[role] : 0);
      }

      if (item.max !== undefined || item.max_range !== undefined) {
        resItem.max = (item.max && typeof item.max === 'object' ? item.max[role] : item.max) ||
          (item.max_range ? item.max_range[role] : 0);
      }

      result[key] = {
        ...resItem,
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
  result.activity_type_weights = LIMITS.activity_type.weights['Random (misc)'];

  // Dynamic value extraction for legacy code
  const getVal = (item, role) => {
    if (!item) return undefined;
    if (item.max_range) return typeof item.max_range === 'object' ? item.max_range[role] : item.max_range;
    if (item.max) return typeof item.max === 'object' ? item.max[role] : item.max;
    return item.default;
  };

  result.max_district_span_val = getVal(LIMITS.max_district_span, role) || 1;
  result.overlap_protection_minutes_val = LIMITS.overlap_protection_minutes.default;
  result.rest_time_percent_val = LIMITS.rest_time_percent.default;
  result.daily_upload_limit_val = getVal(LIMITS.daily_upload_limit, role) || 2;
  result.overlap_minutes = LIMITS.overlap_protection_minutes.default;

  return result;
}

module.exports = {
  ...LIMITS,
  getLimits,
  basic: getLimits('basic'),
  vip: getLimits('vip')
};
