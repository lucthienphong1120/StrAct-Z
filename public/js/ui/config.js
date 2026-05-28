/**
 * StrAct Z - Configuration Panel Logic
 */

async function fetchLimits() {
  try {
    window.sysLimits = await api('/system-limits');
    applyLimitsToUI();
  } catch (err) { console.error('Limits fetch error:', err); }
}

function applyLimitsToUI() {
  if (!window.sysLimits) return;

  const sysL = window.sysLimits;

  // Sync Input ranges
  const syncRange = (id, key) => {
    const el = document.getElementById(id);
    if (el && sysL[key]) {
      el.min = sysL[key].min;
      el.max = sysL[key].max;
    }
  };

  syncRange('cfgMaxSpan', 'max_district_span');
  syncRange('cfgOverlapProtection', 'overlap_protection_minutes');
  syncRange('cfgRestTime', 'rest_time_percent');
  syncRange('cfgMinDist', 'min_distance_km');
  syncRange('cfgMaxDist', 'max_distance_km');
  syncRange('scheduleCountMin', 'schedule_count_min');
  syncRange('scheduleCountMax', 'schedule_count_max');
  syncRange('cfgUserAge', 'user_age');
  syncRange('cfgMinPace', 'min_pace');
  syncRange('cfgMaxPace', 'max_pace');

  const dailyLimit = document.getElementById('cfgDailyLimit');
  if (dailyLimit) dailyLimit.value = sysL.daily_upload_limit.max;

  // Target Date Constraints
  const targetDateInput = document.getElementById('cfgTargetDate');
  if (targetDateInput) {
    const today = new Date();
    const maxDaysAgo = sysL.target_date.max;
    const minDate = new Date();
    minDate.setDate(today.getDate() - maxDaysAgo);
    targetDateInput.min = minDate.toLocaleDateString('en-CA');
    targetDateInput.max = today.toLocaleDateString('en-CA');
  }

  // Build Dynamic Tooltips from Metadata
  updateDynamicTooltips();

  // Populate HR Zones Display (using 'normal' values as requested)
  const hrZones = sysL.heart_rate_zones.normal;
  const setZone = (id, zone) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${Math.round(zone.min * 100)}-${Math.round(zone.max * 100)}%`;
  };
  setZone('hrZoneWalk', hrZones.Walk);
  setZone('hrZoneRide', hrZones.Ride);
  setZone('hrZoneRun', hrZones.Run);
  
  // Map Info Display is now handled by updateMapStatsUI() in map.js
  if (window.updateMapStatsUI) window.updateMapStatsUI();

  attachRealTimeValidation();
}

function updateDynamicTooltips() {
  if (!window.sysLimits) return;

  const tipMapping = {
    daily_upload_limit: 'tipDailyLimit',
    selected_districts: 'tipDistricts',
    max_district_span: 'tipMaxSpan',
    overlap_protection_minutes: 'tipSafeTime',
    rest_time_percent: 'tipRestTime',
    use_osrm: 'tipOsrm',
    random_time_bounds: 'tipRandTime',
    avoid_workhours: 'tipAvoidWork',
    target_date: 'tipTargetDate',
    target_time_custom: 'tipCustomTime',
    min_distance_km: 'tipMinDist',
    max_distance_km: 'tipMaxDist',
    activity_type: 'tipActivityType',
    device_name: 'tipDeviceName',
    heart_rate_enabled: 'tipHeartRate',
    user_age: 'tipUserAge',
    max_heart_rate: 'tipMaxHR',
    min_pace: 'tipMinPace',
    max_pace: 'tipMaxPace',
    sim_weather: 'tipSimWeather',
    sim_redlights: 'tipSimRedLights',
    schedule_time: 'tipScheduleTime',
    schedule_count_min: 'tipScheduleMin',
    schedule_count_max: 'tipScheduleMax',
    heart_rate_zones: 'tipHeartRateZones',
    dist_multipliers: 'tipDistMultipliers',
    pace_multipliers: 'tipPaceMultipliers',
    activity_areas: 'tipActivityAreas',
    map_locked: 'tipMapLocked',
    home_count: 'tipHomePoints',
    work_count: 'tipWorkPoints',
    scale_radius: 'tipScaleRadius',
    boost_adjacent: 'tipBoostAdjacent',
    local_history: 'tipLocalHistory',
    strava_cloud: 'tipStravaCloud'
  };

  for (const [key, tipId] of Object.entries(tipMapping)) {
    const cfg = window.sysLimits[key];
    const tipEl = document.getElementById(tipId);
    if (!cfg || !tipEl) continue;

    const tooltipText = buildTooltipText(cfg);
    tipEl.setAttribute('data-tooltip', tooltipText);
  }
}

function buildTooltipText(cfg) {
  if (!cfg.label) return '';
  
  if (cfg.type === 'info') {
    const lines = [cfg.label];
    if (cfg.desc_extra) lines.push(cfg.desc_extra);
    return lines.join('\n');
  }
  
  if (cfg.type === 'map') {
    const lines = [cfg.label];
    if (cfg.desc_extra) lines.push(cfg.desc_extra);
    if (cfg.example) lines.push(cfg.example);

    const role = window.sysLimits?._role || 'normal';
    const mapping = cfg[role];
    if (mapping) {
      lines.push('');
      for (const [key, val] of Object.entries(mapping)) {
        let valStr = val;
        if (typeof val === 'object' && val !== null) {
          if (val.min !== undefined && val.max !== undefined) {
            valStr = `${Math.round(val.min * 100)}-${Math.round(val.max * 100)}%`;
          } else {
            valStr = JSON.stringify(val);
          }
        }
        lines.push(`• ${key}: ${valStr}`);
      }
    }
    return lines.join('\n');
  }

  const lines = [cfg.label];
  if (cfg.desc_extra) {
    if (cfg.desc_extra.startsWith('Tác dụng:')) lines.push(cfg.desc_extra);
    else lines.push(`(${cfg.desc_extra})`);
  }
  
  lines.push(`Kiểu: ${cfg.type}`);
  
  let defVal = cfg.default_label || cfg.default;
  if (typeof defVal === 'object' && defVal !== null) {
    if (defVal.start && defVal.end) defVal = `${defVal.start} - ${defVal.end}`;
    else if (defVal.start1) defVal = `${defVal.start1}-${defVal.end1} & ${defVal.start2}-${defVal.end2}`;
    else defVal = JSON.stringify(defVal);
  }
  
  const unitStr = (cfg.unit && defVal !== 'Hôm nay') ? ' ' + cfg.unit : '';
  lines.push(`Mặc định: ${defVal}${unitStr}`);
  
  const rangeStr = buildRangeString(cfg);
  if (rangeStr) lines.push(`Phạm vi: ${rangeStr}`);
  
  return lines.join('\n');
}

function buildRangeString(cfg) {
  const min = cfg.full_min !== undefined ? cfg.full_min : cfg.full_min_range;
  const max = cfg.full_max !== undefined ? cfg.full_max : cfg.full_max_range;
  const isVarying = (v) => v && typeof v === 'object' && ('normal' in v || 'vip' in v);

  if (isVarying(min) || isVarying(max)) {
    const getVal = (v, r) => (v && typeof v === 'object' ? v[r] : v) ?? 0;
    const format = (r) => {
      const mn = getVal(min, r);
      const mx = getVal(max, r);
      return mn === mx ? mn : `${mn}-${mx}`;
    };
    return `Normal: ${format('normal')}${cfg.unit ? ' ' + cfg.unit : ''}, VIP: ${format('vip')}${cfg.unit ? ' ' + cfg.unit : ''}`;
  } else if (min !== undefined && max !== undefined) {
    if (min === max) return `${min}${cfg.unit ? ' ' + cfg.unit : ''}`;
    return `${min} - ${max}${cfg.unit ? ' ' + cfg.unit : ''}`;
  }
  return null;
}

async function loadConfig() {
  try {
    const config = await api('/config');
    
    const container = document.getElementById('cfgDistricts');
    if (container) {
      const selectedKeys = config.selected_districts ? config.selected_districts.split(',') : [];
      container.innerHTML = '';
      container.style.display = 'grid';
      container.style.gridTemplateColumns = 'repeat(3, 1fr)';
      container.style.gap = '10px';
      
      window.sysDistricts.forEach(d => {
        let isChecked = '';
        if (config.selected_districts !== undefined) {
          isChecked = selectedKeys.includes(d.key) ? 'checked' : '';
        } else {
          const isDefault = d.groups && d.groups.includes('default');
          isChecked = isDefault ? 'checked' : '';
        }
        
        const label = document.createElement('label');
        label.className = 'toggle';
        label.style.fontSize = '0.8rem';
        label.style.marginBottom = '5px';
        label.innerHTML = `
          <input type="checkbox" class="district-cb" value="${d.key}" ${isChecked}>
          <div class="toggle-track" style="transform:scale(0.8)"></div>
          <span>${d.name}</span>
        `;
        
        const cb = label.querySelector('input');
        cb.addEventListener('change', () => {
          updateSelectedDistrictKeys();
          updateDistrictHighlights();
        });
        
        container.appendChild(label);
      });
      
      updateSelectedDistrictKeys();
    }

    const maxSpanInput = document.getElementById('cfgMaxSpan');
    if (maxSpanInput) maxSpanInput.value = config.max_district_span || '1';

    const osrmToggle = document.getElementById('cfgOsrm');
    if (osrmToggle) osrmToggle.checked = config.use_osrm !== 'false';

    const boostAdjacentToggle = document.getElementById('cfgBoostAdjacent');
    if (boostAdjacentToggle) boostAdjacentToggle.checked = config.boost_adjacent !== 'false';
    
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    const setChecked = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = val;
    };

    const today = new Date().toLocaleDateString('en-CA');
    setVal('cfgTargetDate', today);
    
    setChecked('cfgCustomTime', config.custom_time_enabled === 'true');
    setVal('cfgCustomMinTime', config.target_time_custom || '00:00');
    toggleCustomTime();
    setVal('cfgRandMinTime', config.min_time || '04:30');
    setVal('cfgRandMaxTime', config.max_time || '21:30');
    setVal('cfgWorkStart1', config.work_start1 || '08:00');
    setVal('cfgWorkEnd1', config.work_end1 || '11:30');
    setVal('cfgWorkStart2', config.work_start2 || '13:30');
    setVal('cfgWorkEnd2', config.work_end2 || '17:30');

    setVal('cfgMinDist', config.min_distance_km || '0.5');
    setVal('cfgMaxDist', config.max_distance_km || '10');
    setVal('cfgMinPace', config.min_pace || '7.0');
    setVal('cfgMaxPace', config.max_pace || '15.0');
    setVal('cfgActivityType', config.activity_type || 'Random');
    setVal('cfgDeviceName', config.device_name || 'Garmin Forerunner 975');
    setChecked('cfgHeartRate', config.heart_rate_enabled === 'true');
    setVal('cfgUserAge', config.user_age || '25');
    updateMHR(); 
    
    setChecked('cfgSimWeather', config.sim_weather !== 'false');
    setChecked('cfgSimRedLights', config.sim_redlights !== 'false');
    
    toggleHRInputs();


    setVal('cfgOverlapProtection', config.overlap_protection_minutes || '30');
    setVal('cfgRestTime', config.rest_time_percent || '50');

    if (config.map_lat && config.map_lng && config.map_zoom) {
      window.savedMapState = {
        lat: parseFloat(config.map_lat),
        lng: parseFloat(config.map_lng),
        zoom: parseInt(config.map_zoom)
      };
    }

    if (config.map_locked !== undefined) {
      window.isMapLocked = config.map_locked !== 'false';
      if (window.applyMapLock) window.applyMapLock();
      if (window.updateLockUI) window.updateLockUI();
    }

    if (config.activity_areas) {
      renderCircles(config.activity_areas);
    }
    
    if (window.updateMapStatsUI) window.updateMapStatsUI();
  } catch (err) { console.error('Config error:', err); }
}

function validateTimeBounds(minTimeStr, maxTimeStr, targetDateStr, isCustomTime) {
  if (minTimeStr && maxTimeStr) {
    const [minH, minM] = minTimeStr.split(':').map(Number);
    const [maxH, maxM] = maxTimeStr.split(':').map(Number);
    // Allow equal for fixed time scheduling
    if (minH * 60 + minM > maxH * 60 + maxM) {
      showToast('Start Time cannot be later than End Time!', 'error');
      return false;
    }
  }

  const now = new Date();
  if (isCustomTime && targetDateStr && maxTimeStr) {
    const targetDateObj = new Date(`${targetDateStr}T${maxTimeStr}:00.000+07:00`);
    if (targetDateObj > now) {
      showToast('Time cannot be in the future!', 'error');
      return false;
    }

    // New validation: Target Time must be within Random Time Bounds
    const randMinStr = document.getElementById('cfgRandMinTime').value;
    const randMaxStr = document.getElementById('cfgRandMaxTime').value;
    if (randMinStr && randMaxStr) {
      const [rMinH, rMinM] = randMinStr.split(':').map(Number);
      const [rMaxH, rMaxM] = randMaxStr.split(':').map(Number);
      const [cMinH, cMinM] = minTimeStr.split(':').map(Number);
      const [cMaxH, cMaxM] = maxTimeStr.split(':').map(Number);

      const rMin = rMinH * 60 + rMinM;
      const rMax = rMaxH * 60 + rMaxM;
      const cMin = cMinH * 60 + cMinM;
      const cMax = cMaxH * 60 + cMaxM;

      if (cMin < rMin || cMax > rMax) {
        showToast(`Target Time phải nằm trong khoảng ${randMinStr} - ${randMaxStr}`, 'error');
        return false;
      }
    }
  } else if (!isCustomTime && minTimeStr) {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const minDateObj = new Date(`${todayStr}T${minTimeStr}:00.000+07:00`);
    if (minDateObj > now) {
      showToast('Start Time is currently in the future! Please adjust.', 'error');
      return false;
    }
  }
  return true;
}

function validateInputs(config, isRealTime = false) {
  const sysL = window.sysLimits;
  if (!sysL) return true;

  // Key mapping from config object to DOM element IDs
  const idMap = {
    max_district_span: 'cfgMaxSpan',
    min_distance_km: 'cfgMinDist',
    max_distance_km: 'cfgMaxDist',
    min_pace: 'cfgMinPace',
    max_pace: 'cfgMaxPace',
    user_age: 'cfgUserAge',
    overlap_protection_minutes: 'cfgOverlapProtection',
    rest_time_percent: 'cfgRestTime'
  };

  const keyMap = {
    max_district_span: 'max_district_span',
    min_distance_km: 'min_distance_km',
    max_distance_km: 'max_distance_km',
    min_pace: 'min_pace',
    max_pace: 'max_pace',
    user_age: 'user_age',
    overlap_protection_minutes: 'overlap_protection_minutes',
    rest_time_percent: 'rest_time_percent',
    selected_districts: 'selected_districts'
  };

  let isValid = true;

  for (const [cfgKey, sysKey] of Object.entries(keyMap)) {
    const rule = sysL[sysKey];
    const el = document.getElementById(idMap[cfgKey]);
    if (!rule) continue;

    const value = config[cfgKey];
    const label = rule.label || sysKey;

    // Clear previous invalid state
    if (el) el.classList.remove('invalid');

    // 1. Type specific parsing
    let parsedVal = value;
    if (rule.type === 'int') parsedVal = parseInt(value, 10);
    else if (rule.type === 'float') parsedVal = parseFloat(value);
    else if (rule.type === 'array') parsedVal = value ? value.split(',') : [];

    // 2. Range Validation
    let error = null;
    if (rule.min !== undefined) {
      if (rule.type === 'int' || rule.type === 'float') {
        if (parsedVal < rule.min) error = `${label} phải từ ${rule.min} đến ${rule.max}${rule.unit ? ' ' + rule.unit : ''}`;
      } else if (rule.type === 'array') {
        if (parsedVal.length < rule.min) error = `Vui lòng chọn ít nhất ${rule.min} ${label}`;
      }
    }

    if (!error && rule.max !== undefined) {
      if (rule.type === 'int' || rule.type === 'float') {
        if (parsedVal > rule.max) error = `${label} không được vượt quá ${rule.max}${rule.unit ? ' ' + rule.unit : ''}`;
      } else if (rule.type === 'array') {
        if (parsedVal.length > rule.max) error = `Bạn chỉ được chọn tối đa ${rule.max} ${label} cho tài khoản hiện tại.`;
      }
    }

    if (error) {
      if (el) el.classList.add('invalid');
      if (!isRealTime) {
        showToast(error, rule.type === 'array' ? 'warning' : 'error');
        return false;
      }
      isValid = false;
    }
  }

  // Cross-field validation (Distance)
  const minDistEl = document.getElementById('cfgMinDist');
  const maxDistEl = document.getElementById('cfgMaxDist');
  if (parseFloat(config.min_distance_km) >= parseFloat(config.max_distance_km)) {
    if (minDistEl) minDistEl.classList.add('invalid');
    if (maxDistEl) maxDistEl.classList.add('invalid');
    if (!isRealTime) {
      showToast('Min Distance phải nhỏ hơn Max Distance', 'error');
      return false;
    }
    isValid = false;
  }

  // Cross-field validation (Pace)
  const minPaceEl = document.getElementById('cfgMinPace');
  const maxPaceEl = document.getElementById('cfgMaxPace');
  if (parseFloat(config.min_pace) > parseFloat(config.max_pace)) {
    if (minPaceEl) minPaceEl.classList.add('invalid');
    if (maxPaceEl) maxPaceEl.classList.add('invalid');
    if (!isRealTime) {
      showToast('Min Pace phải nhỏ hơn hoặc bằng Max Pace', 'error');
      return false;
    }
    isValid = false;
  }

  return isValid;
}

function attachRealTimeValidation() {
  const inputs = [
    'cfgMaxSpan', 'cfgOverlapProtection', 'cfgRestTime', 'cfgMinDist', 'cfgMaxDist', 
    'cfgMinPace', 'cfgMaxPace', 'cfgUserAge'
  ];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    const validate = () => {
      const config = {
        max_district_span: document.getElementById('cfgMaxSpan').value,
        overlap_protection_minutes: document.getElementById('cfgOverlapProtection').value,
        rest_time_percent: document.getElementById('cfgRestTime').value,
        min_distance_km: document.getElementById('cfgMinDist').value,
        max_distance_km: document.getElementById('cfgMaxDist').value,
        min_pace: document.getElementById('cfgMinPace').value,
        max_pace: document.getElementById('cfgMaxPace').value,
        user_age: document.getElementById('cfgUserAge').value,
        selected_districts: Array.from(document.querySelectorAll('.district-cb:checked')).map(cb => cb.value).join(',')
      };
      validateInputs(config, true);
    };

    el.addEventListener('input', validate);
    el.addEventListener('change', validate);
    el.addEventListener('blur', validate);
  });
}

async function saveConfig() {
  const min_time = document.getElementById('cfgRandMinTime').value;
  const max_time = document.getElementById('cfgRandMaxTime').value;
  if (!validateTimeBounds(min_time, max_time, null, false)) return;

  const selected_districts = Array.from(document.querySelectorAll('.district-cb:checked')).map(cb => cb.value).join(',');
  const config = {
    selected_districts,
    max_district_span: document.getElementById('cfgMaxSpan').value,
    use_osrm: document.getElementById('cfgOsrm').checked ? 'true' : 'false',
    boost_adjacent: document.getElementById('cfgBoostAdjacent')?.checked ? 'true' : 'false',
    min_time: document.getElementById('cfgRandMinTime').value,
    max_time: document.getElementById('cfgRandMaxTime').value,
    work_start1: document.getElementById('cfgWorkStart1').value,
    work_end1: document.getElementById('cfgWorkEnd1').value,
    work_start2: document.getElementById('cfgWorkStart2').value,
    work_end2: document.getElementById('cfgWorkEnd2').value,
    min_distance_km: document.getElementById('cfgMinDist').value,
    max_distance_km: document.getElementById('cfgMaxDist').value,
    min_pace: document.getElementById('cfgMinPace').value,
    max_pace: document.getElementById('cfgMaxPace').value,
    activity_type: document.getElementById('cfgActivityType').value,
    device_name: document.getElementById('cfgDeviceName').value,
    heart_rate_enabled: document.getElementById('cfgHeartRate').checked ? 'true' : 'false',
    max_heart_rate: document.getElementById('cfgMaxHR').value,
    user_age: document.getElementById('cfgUserAge').value,
    sim_weather: document.getElementById('cfgSimWeather')?.checked ? 'true' : 'false',
    sim_redlights: document.getElementById('cfgSimRedLights')?.checked ? 'true' : 'false',

    custom_time_enabled: document.getElementById('cfgCustomTime').checked ? 'true' : 'false',
    target_time_custom: document.getElementById('cfgCustomMinTime').value,
    overlap_protection_minutes: document.getElementById('cfgOverlapProtection')?.value || '30',
    rest_time_percent: document.getElementById('cfgRestTime')?.value || '50',
  };

  if (!validateInputs(config)) return;

  try {
    const res = await api('/config', { method: 'POST', body: config });
    if (res && res.success) {
      showToast('Configuration saved!', 'success');
    } else {
      showToast(res?.error || 'Failed to save configuration', 'error');
    }
  } catch (err) {
    console.error('Save config error:', err);
    showToast('Save failed: ' + err.message, 'error');
  }
}

function getOverrideConfig() {
  const selected_districts = Array.from(document.querySelectorAll('.district-cb:checked')).map(cb => cb.value).join(',');
  const isCustomTime = document.getElementById('cfgCustomTime').checked;
  const overrideConfig = {
    target_date: isCustomTime ? document.getElementById('cfgTargetDate').value : undefined,
    min_time: isCustomTime ? document.getElementById('cfgCustomMinTime').value : document.getElementById('cfgRandMinTime').value,
    max_time: isCustomTime ? document.getElementById('cfgCustomMinTime').value : document.getElementById('cfgRandMaxTime').value,
    work_start1: document.getElementById('cfgWorkStart1').value,
    work_end1: document.getElementById('cfgWorkEnd1').value,
    work_start2: document.getElementById('cfgWorkStart2').value,
    work_end2: document.getElementById('cfgWorkEnd2').value,
    selected_districts,
    max_district_span: document.getElementById('cfgMaxSpan').value,
    use_osrm: document.getElementById('cfgOsrm').checked ? 'true' : 'false',
    boost_adjacent: document.getElementById('cfgBoostAdjacent')?.checked ? 'true' : 'false',
    min_distance_km: document.getElementById('cfgMinDist').value,
    max_distance_km: document.getElementById('cfgMaxDist').value,
    min_pace: document.getElementById('cfgMinPace').value,
    max_pace: document.getElementById('cfgMaxPace').value,
    activity_type: document.getElementById('cfgActivityType').value,
    device_name: document.getElementById('cfgDeviceName').value,
    heart_rate_enabled: document.getElementById('cfgHeartRate').checked ? 'true' : 'false',
    user_age: document.getElementById('cfgUserAge').value,
    max_heart_rate: document.getElementById('cfgMaxHR').value,
    sim_weather: document.getElementById('cfgSimWeather')?.checked ? 'true' : 'false',
    sim_redlights: document.getElementById('cfgSimRedLights')?.checked ? 'true' : 'false',
    overlap_protection_minutes: document.getElementById('cfgOverlapProtection')?.value,
    rest_time_percent: document.getElementById('cfgRestTime')?.value,
  };

  if (!validateTimeBounds(overrideConfig.min_time, overrideConfig.max_time, overrideConfig.target_date, isCustomTime)) {
    return null;
  }
  
  if (!validateInputs(overrideConfig)) {
    return null;
  }
  
  return overrideConfig;
}

async function resetToDefault() {
  if (!confirm('Are you sure you want to reset all settings to default? (Map areas & history will be preserved)')) return;

  showToast('Resetting configuration...', 'info');
  try {
    const res = await api('/config/reset', { method: 'POST' });
    if (res.success) {
      showToast('Configuration reset successfully', 'success');
      window.savedMapState = { lat: 21.0285, lng: 105.8542, zoom: 12 };
      await loadDashboard(true);
    } else {
      showToast(res.error || 'Reset failed', 'error');
    }
  } catch (err) {
    showToast('Reset failed: ' + err.message, 'error');
  }
}

function updateMHR() {
  const age = parseInt(document.getElementById('cfgUserAge').value || '25', 10);
  const mhr = 220 - age;
  document.getElementById('cfgMaxHR').value = mhr;
}

function checkMaxSpan() {
  const el = document.getElementById('cfgMaxSpan');
  if (parseInt(el.value, 10) > window.sysLimits.max_district_span) {
    showToast(`Max ${window.sysLimits.max_district_span} districts allowed for your account.`, 'warning');
    el.value = window.sysLimits.max_district_span;
  }
}

function toggleCustomTime() {
  const isCustom = document.getElementById('cfgCustomTime').checked;
  const customInputs = document.getElementById('timeCustomInputs');
  const randomInputs = document.getElementById('timeRandomInputs');
  
  if (isCustom) {
    customInputs.style.opacity = '1';
    customInputs.style.pointerEvents = 'auto';
    randomInputs.style.opacity = '0.4';
    randomInputs.style.pointerEvents = 'none';
  } else {
    customInputs.style.opacity = '0.4';
    customInputs.style.pointerEvents = 'none';
    randomInputs.style.opacity = '1';
    randomInputs.style.pointerEvents = 'auto';
  }
}

function updateActivityTypeHint() {
  const type = document.getElementById('cfgActivityType').value;
  const hint = document.getElementById('activityTypeHint');
  if (type === 'Random') {
    hint.textContent = '\ud83c\udfb2 60% Run, 30% Walk, 10% Ride';
    hint.style.display = 'block';
  } else {
    hint.textContent = '100% ' + type;
    hint.style.display = 'block';
  }
}

function toggleHRInputs() {
  const hrEnabled = document.getElementById('cfgHeartRate').checked;
  const ageInput = document.getElementById('cfgUserAge');
  const mhrInput = document.getElementById('cfgMaxHR');
  
  if (ageInput) {
    ageInput.disabled = !hrEnabled;
    ageInput.closest('.form-group').style.opacity = hrEnabled ? '1' : '0.4';
  }
  if (mhrInput) {
    mhrInput.closest('.form-group').style.opacity = hrEnabled ? '1' : '0.4';
  }
}

// Export to window
window.fetchLimits = fetchLimits;
window.applyLimitsToUI = applyLimitsToUI;
window.loadConfig = loadConfig;
window.saveConfig = saveConfig;
window.getOverrideConfig = getOverrideConfig;
window.resetToDefault = resetToDefault;
window.updateMHR = updateMHR;
window.checkMaxSpan = checkMaxSpan;
window.toggleCustomTime = toggleCustomTime;
window.updateActivityTypeHint = updateActivityTypeHint;
window.toggleHRInputs = toggleHRInputs;
window.buildTooltipText = buildTooltipText;
window.buildRangeString = buildRangeString;
window.validateTimeBounds = validateTimeBounds;
window.validateInputs = validateInputs;

// Google Fit Handlers
function connectGoogleFit() {
  const win = window.open('/api/auth/google', 'GoogleFitAuth', 'width=600,height=700');
}

async function disconnectGoogleFit() {
  if (confirm('Are you sure you want to disconnect Google Fit?')) {
    await api('/auth/google', { method: 'DELETE' });
    showToast('Google Fit disconnected', 'info');
    loadStats(); // refresh UI
  }
}

async function refreshGoogleFitStats(forceRefresh = false) {
  const statusText = document.getElementById('gfStatusText');
  const stepsEl = document.getElementById('gfTodaySteps');
  const syncEl = document.getElementById('gfLastSync');
  
  if (!statusText) return;
  if (forceRefresh) statusText.textContent = 'Refreshing...';
  
  try {
    const refreshQuery = forceRefresh ? '?refresh=true' : '';
    const data = await api(`/google-fit/stats${refreshQuery}`);
    if (data.error) throw new Error(data.error);
    
    if (stepsEl) stepsEl.textContent = data.steps.toLocaleString();
    if (syncEl) {
      const time = new Date(data.lastUpdate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
      syncEl.textContent = `Last sync: ${time}`;
    }
    if (statusText) {
      statusText.textContent = 'Status: Active & Syncing';
      statusText.style.color = 'var(--accent-green)';
    }
  } catch (err) {
    console.error('Google Fit stats error:', err);
    if (statusText) {
      statusText.textContent = 'Status: Sync Error';
      statusText.style.color = 'var(--accent-red)';
    }
  }
}

// Reliable cross-window communication for Auth
const authChannel = new BroadcastChannel('stract_z_auth');
authChannel.onmessage = (event) => {
  console.log('[AuthChannel] Received:', event.data);
  if (event.data === 'google_fit_connected') {
    showToast('Google Fit connected successfully!', 'success');
    setTimeout(() => location.reload(), 1000);
  }
};

window.addEventListener('message', async (event) => {
  console.log('[Auth] Received postMessage:', event.data);
  if (event.data === 'google_fit_connected') {
    showToast('Google Fit connected successfully!', 'success');
    setTimeout(() => location.reload(), 1000);
  }
});

window.connectGoogleFit = connectGoogleFit;
window.disconnectGoogleFit = disconnectGoogleFit;
window.refreshGoogleFitStats = refreshGoogleFitStats;
window.updateDynamicTooltips = updateDynamicTooltips;
