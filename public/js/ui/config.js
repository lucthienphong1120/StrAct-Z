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
}

function updateDynamicTooltips() {
  if (!window.sysLimits) return;

  const tipMapping = {
    daily_upload_limit: 'tipDailyLimit',
    allowed_districts: 'tipDistricts',
    max_district_span: 'tipMaxSpan',
    overlap_protection_minutes: 'tipSafeTime',
    use_osrm: 'tipOsrm',
    random_time_bounds: 'tipRandTime',
    avoid_workhours: 'tipAvoidWork',
    target_date: 'tipTargetDate',
    custom_time_enabled: 'tipCustomTime',
    min_distance_km: 'tipMinDist',
    max_distance_km: 'tipMaxDist',
    activity_type: 'tipActivityType',
    heart_rate_enabled: 'tipHeartRate',
    user_age: 'tipUserAge',
    min_pace: 'tipMinPace',
    max_pace: 'tipMaxPace',
    sim_weather: 'tipSimWeather',
    sim_redlights: 'tipSimRedLights',
    schedule_time: 'tipScheduleTime',
    schedule_count_min: 'tipScheduleMin',
    schedule_count_max: 'tipScheduleMax',
    heart_rate_zones: 'tipHeartRateZones'
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
  
  const lines = [cfg.label];
  if (cfg.desc_extra) lines.push(`(${cfg.desc_extra})`);
  lines.push(`Kiểu: ${cfg.type}`);
  
  let defVal = cfg.default_label || cfg.default;
  if (typeof defVal === 'object') {
    if (defVal.start && defVal.end) defVal = `${defVal.start} - ${defVal.end}`;
    else if (defVal.start1) defVal = `${defVal.start1}-${defVal.end1} & ${defVal.start2}-${defVal.end2}`;
    else defVal = JSON.stringify(defVal);
  }
  
  lines.push(`Mặc định: ${defVal}${cfg.unit ? ' ' + cfg.unit : ''}`);
  
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
    const nRange = `${getVal(min, 'normal')}-${getVal(max, 'normal')}`;
    const vRange = `${getVal(min, 'vip')}-${getVal(max, 'vip')}`;
    return `normal: ${nRange}${cfg.unit ? ' ' + cfg.unit : ''}, vip: ${vRange}${cfg.unit ? ' ' + cfg.unit : ''}`;
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
    
    const today = new Date().toLocaleDateString('en-CA');
    document.getElementById('cfgTargetDate').value = today;
    
    document.getElementById('cfgCustomMinTime').value = config.min_time || '04:30';
    document.getElementById('cfgCustomMaxTime').value = config.max_time || '21:30';
    document.getElementById('cfgRandMinTime').value = config.min_time || '04:30';
    document.getElementById('cfgRandMaxTime').value = config.max_time || '21:30';
    document.getElementById('cfgWorkStart1').value = config.work_start1 || '08:00';
    document.getElementById('cfgWorkEnd1').value = config.work_end1 || '11:30';
    document.getElementById('cfgWorkStart2').value = config.work_start2 || '13:30';
    document.getElementById('cfgWorkEnd2').value = config.work_end2 || '17:30';

    document.getElementById('cfgMinDist').value = config.min_distance_km || '0.5';
    document.getElementById('cfgMaxDist').value = config.max_distance_km || '10';
    document.getElementById('cfgMinPace').value = config.min_pace || '7.0';
    document.getElementById('cfgMaxPace').value = config.max_pace || '15.0';
    document.getElementById('cfgActivityType').value = config.activity_type || 'Random';
    document.getElementById('cfgHeartRate').checked = config.heart_rate_enabled === 'true';
    document.getElementById('cfgUserAge').value = config.user_age || '25';
    updateMHR(); 
    
    if (document.getElementById('cfgSimWeather')) {
      document.getElementById('cfgSimWeather').checked = config.sim_weather !== 'false';
    }
    if (document.getElementById('cfgSimRedLights')) {
      document.getElementById('cfgSimRedLights').checked = config.sim_redlights !== 'false';
    }
    
    toggleHRInputs();

    if (document.getElementById('cfgOverlapProtection')) {
      document.getElementById('cfgOverlapProtection').value = config.overlap_protection_minutes || '30';
    }

    if (config.map_lat && config.map_lng && config.map_zoom) {
      window.savedMapState = {
        lat: parseFloat(config.map_lat),
        lng: parseFloat(config.map_lng),
        zoom: parseInt(config.map_zoom)
      };
    }

    if (config.activity_areas) {
      renderCircles(config.activity_areas);
    }
  } catch (err) { console.error('Config error:', err); }
}

function validateTimeBounds(minTimeStr, maxTimeStr, targetDateStr, isCustomTime) {
  if (minTimeStr && maxTimeStr) {
    const [minH, minM] = minTimeStr.split(':').map(Number);
    const [maxH, maxM] = maxTimeStr.split(':').map(Number);
    if (minH * 60 + minM >= maxH * 60 + maxM) {
      showToast('Start Time must be earlier than End Time!', 'error');
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

function validateInputs(config) {
  const sysL = window.sysLimits;
  if (!sysL) return true;

  if (parseInt(config.max_district_span, 10) > sysL.max_district_span.max) {
    showToast(`Tối đa ${sysL.max_district_span.max} quận cho tài khoản của bạn.`, 'warning');
    document.getElementById('cfgMaxSpan').value = sysL.max_district_span.max;
    return false;
  }
  
  const minDist = parseFloat(config.min_distance_km);
  const maxDist = parseFloat(config.max_distance_km);
  
  if (minDist < sysL.min_distance_km.min || minDist > sysL.min_distance_km.max) { 
    showToast(`Min Distance phải từ ${sysL.min_distance_km.min} đến ${sysL.min_distance_km.max} km`, 'error'); 
    return false; 
  }
  if (maxDist < sysL.max_distance_km.min || maxDist > sysL.max_distance_km.max) { 
    showToast(`Max Distance phải từ ${sysL.max_distance_km.min} đến ${sysL.max_distance_km.max} km`, 'error'); 
    return false; 
  }
  if (minDist >= maxDist) { showToast('Min Distance phải nhỏ hơn Max Distance', 'error'); return false; }
  
  const minPace = parseFloat(config.min_pace);
  const maxPace = parseFloat(config.max_pace);
  if (minPace < sysL.min_pace.min || minPace > sysL.min_pace.max) { 
    showToast(`Min Pace phải từ ${sysL.min_pace.min} đến ${sysL.min_pace.max} min/km`, 'error'); 
    return false; 
  }
  if (maxPace < sysL.max_pace.min || maxPace > sysL.max_pace.max) { 
    showToast(`Max Pace phải từ ${sysL.max_pace.min} đến ${sysL.max_pace.max} min/km`, 'error'); 
    return false; 
  }
  if (minPace > maxPace) { showToast('Min Pace phải nhỏ hơn hoặc bằng Max Pace', 'error'); return false; }

  return true;
}

async function saveConfig() {
  const min_time = document.getElementById('cfgRandMinTime').value;
  const max_time = document.getElementById('cfgRandMaxTime').value;
  if (!validateTimeBounds(min_time, max_time, null, false)) return;

  const selected_districts = Array.from(document.querySelectorAll('.district-cb:checked')).map(cb => cb.value).join(',');
  const config = {
    selected_districts,
    district_key: 'random',
    max_district_span: document.getElementById('cfgMaxSpan').value,
    use_osrm: document.getElementById('cfgOsrm').checked ? 'true' : 'false',
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
    heart_rate_enabled: document.getElementById('cfgHeartRate').checked ? 'true' : 'false',
    max_heart_rate: document.getElementById('cfgMaxHR').value,
    user_age: document.getElementById('cfgUserAge').value,
    sim_weather: document.getElementById('cfgSimWeather')?.checked ? 'true' : 'false',
    sim_redlights: document.getElementById('cfgSimRedLights')?.checked ? 'true' : 'false',
    overlap_protection_minutes: document.getElementById('cfgOverlapProtection')?.value || '30',
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
    max_time: isCustomTime ? document.getElementById('cfgCustomMaxTime').value : document.getElementById('cfgRandMaxTime').value,
    work_start1: document.getElementById('cfgWorkStart1').value,
    work_end1: document.getElementById('cfgWorkEnd1').value,
    work_start2: document.getElementById('cfgWorkStart2').value,
    work_end2: document.getElementById('cfgWorkEnd2').value,
    selected_districts,
    max_district_span: document.getElementById('cfgMaxSpan').value,
    district_key: 'random',
    use_osrm: document.getElementById('cfgOsrm').checked ? 'true' : 'false',
    min_distance_km: document.getElementById('cfgMinDist').value,
    max_distance_km: document.getElementById('cfgMaxDist').value,
    min_pace: document.getElementById('cfgMinPace').value,
    max_pace: document.getElementById('cfgMaxPace').value,
    activity_type: document.getElementById('cfgActivityType').value,
    heart_rate_enabled: document.getElementById('cfgHeartRate').checked ? 'true' : 'false',
    user_age: document.getElementById('cfgUserAge').value,
    max_heart_rate: document.getElementById('cfgMaxHR').value,
    overlap_protection_minutes: document.getElementById('cfgOverlapProtection')?.value,
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
  if (!confirm('Are you sure you want to reset all settings to default? (Map areas will be preserved)')) return;

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
