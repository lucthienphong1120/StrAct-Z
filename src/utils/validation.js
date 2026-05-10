/**
 * StrAct Z - Configuration Validation Utility
 */

const systemLimits = require('../config/limits');

/**
 * Validate a configuration object against system limits
 * @param {Object} updates - The partial or full config object to validate
 * @param {string} role - User role (normal, vip, admin)
 * @returns {Object} { success: boolean, error: string|null, sanitized: Object }
 */
function validateConfig(updates, role = 'normal') {
  const limits = systemLimits.getLimits(role);
  const sanitized = {};
  
  for (const [key, value] of Object.entries(updates)) {
    const rule = limits[key];
    if (!rule) {
      // If no rule exists, we skip or allow (depends on strictness)
      // For StrAct-Z, we only allow known keys to be updated via this path
      continue;
    }

    let val = value;
    const label = rule.label || key;

    // 1. Type Validation & Conversion
    try {
      switch (rule.type) {
        case 'int':
          val = parseInt(value, 10);
          if (isNaN(val)) throw new Error(`${label} must be an integer.`);
          break;
        case 'float':
          val = parseFloat(value);
          if (isNaN(val)) throw new Error(`${label} must be a number.`);
          break;
        case 'bool':
          val = String(value) === 'true';
          break;
        case 'array':
          if (typeof value === 'string') val = value.split(',').filter(v => v.trim() !== '');
          if (!Array.isArray(val)) throw new Error(`${label} must be an array or comma-separated string.`);
          break;
        case 'time':
          if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) throw new Error(`${label} must be in HH:mm format.`);
          break;
        case 'date':
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value) && value !== 'Hôm nay') throw new Error(`${label} must be in YYYY-MM-DD format.`);
          break;
      }
    } catch (err) {
      return { success: false, error: err.message };
    }

    // 2. Range Validation
    if (rule.min !== undefined) {
      if (rule.type === 'int' || rule.type === 'float') {
        if (val < rule.min) return { success: false, error: `${label} must be at least ${rule.min}${rule.unit ? ' ' + rule.unit : ''}.` };
      } else if (rule.type === 'array') {
        if (val.length < rule.min) return { success: false, error: `Please select at least ${rule.min} ${label}.` };
      }
    }

    if (rule.max !== undefined) {
      if (rule.type === 'int' || rule.type === 'float') {
        if (val > rule.max) return { success: false, error: `${label} cannot exceed ${rule.max}${rule.unit ? ' ' + rule.unit : ''}.` };
      } else if (rule.type === 'array') {
        if (val.length > rule.max) return { success: false, error: `You can select up to ${rule.max} ${label}.` };
      }
    }

    // Special check for target_date max days ago
    if (rule.type === 'date' && value !== 'Hôm nay' && typeof rule.max === 'number') {
        const targetDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((today - targetDate) / (1000 * 60 * 60 * 24));
        if (diffDays > rule.max) return { success: false, error: `${label} cannot be more than ${rule.max} days ago.` };
        if (diffDays < 0) return { success: false, error: `${label} cannot be in the future.` };
    }

    // Success - store sanitized value (back to string for DB if needed)
    sanitized[key] = rule.type === 'array' ? val.join(',') : String(val);
  }

  return { success: true, error: null, sanitized };
}

module.exports = {
  validateConfig
};
