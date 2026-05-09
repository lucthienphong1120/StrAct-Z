/**
 * StrAct Z - System Limits and Validation Ranges
 * This file centralizes all constraints for Normal and VIP accounts.
 */

module.exports = {
  normal: {
    max_district_span: 2,
    schedule_count_max: 2,
    daily_upload_limit: 2,

    distance_km: { min: 0.2, max: 4.0, default_min: 0.5, default_max: 8.0 },
    max_distance_km_limit: 15.0, // Absolute max for validation

    pace_min_km: { min: 6.0, max: 12.0, default: 8.0 },
    pace_max_km: { min: 10.0, max: 15.0, default: 12.0 },

    heart_rate: {
      min: { min: 60, max: 120, default: 80 },
      max: { min: 120, max: 200, default: 165 }
    },

    age: { min: 18, max: 90, default: 25 },

    // GPX Generator Weights
    activity_type_weights: {
      Run: 0.6,
      Walk: 0.3,
      Ride: 0.1
    },

    // HR Zone Multipliers (% of MHR)
    hr_zones: {
      Walk: { min: 0.50, max: 0.60 },
      Ride: { min: 0.60, max: 0.70 },
      Run: { min: 0.70, max: 0.85 }
    }
  },

  vip: {
    max_district_span: 3,
    schedule_count_max: 3,
    daily_upload_limit: 5, // Higher limit for VIP

    distance_km: { min: 0.1, max: 5.0, default_min: 0.5, default_max: 10.0 },
    max_distance_km_limit: 25.0, // VIP can go further

    pace_min_km: { min: 6.0, max: 12.0, default: 8.0 },
    pace_max_km: { min: 10.0, max: 15.0, default: 12.0 },

    heart_rate: {
      min: { min: 50, max: 130, default: 80 },
      max: { min: 100, max: 220, default: 165 }
    },

    age: { min: 18, max: 90, default: 25 },

    activity_type_weights: {
      Run: 0.5,
      Walk: 0.25,
      Ride: 0.25
    },

    hr_zones: {
      Walk: { min: 0.45, max: 0.65 },
      Ride: { min: 0.55, max: 0.75 },
      Run: { min: 0.65, max: 0.90 }
    }
  }
};
