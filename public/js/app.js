/**
 * Strava Auto Activity Generator - Frontend Logic
 */

// ─── API Helpers ────────────────────────────────────────

async function api(endpoint, options = {}) {
  try {
    const res = await fetch(`/api${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: res.statusText }));
      return { error: errorData.error || `HTTP ${res.status}` };
    }
    return res.json();
  } catch (err) {
    console.error(`API Error (${endpoint}):`, err);
    return { error: err.message };
  }
}

// ─── Toast Notifications ────────────────────────────────

const TOAST_ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
const TOAST_DURATION = { success: 4000, error: 6000, info: 3500, warning: 5000 };

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || 'ℹ️'}</span>
    <span class="toast-body">${message}</span>
    <button class="toast-close" title="Dismiss">✕</button>
  `;

  const dismiss = () => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 380);
  };

  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  container.appendChild(toast);
  setTimeout(dismiss, TOAST_DURATION[type] || 4000);
}

// ─── Auth ───────────────────────────────────────────────

async function checkAuth() {
  try {
    const res = await fetch('/auth/status');
    const data = await res.json();
    const badge = document.getElementById('authBadge');
    const authText = document.getElementById('authText');
    
    if (data.authenticated) {
      badge.className = 'auth-badge';
      authText.textContent = data.athlete?.name || 'Connected';
      document.getElementById('connectScreen').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
      document.getElementById('btnLogout').style.display = 'block';
      
      // Update header name with VIP indicator
      const vipTag = userRole === 'vip' ? ' <span style="color:var(--vip-gold); font-size:0.7rem; font-weight:800; border:1px solid var(--vip-gold); padding:1px 6px; border-radius:4px; margin-left:6px; background:rgba(245,158,11,0.1);">VIP</span>' : '';
      authText.innerHTML = (data.athlete?.name || 'Connected') + vipTag;
      
      renderAccountInfo(data.athlete);
      loadDashboard();
    } else {
      badge.className = 'auth-badge disconnected';
      authText.textContent = 'Disconnected';
      document.getElementById('connectScreen').style.display = 'flex';
      document.getElementById('dashboard').style.display = 'none';
      document.getElementById('btnLogout').style.display = 'block';
    }
  } catch (err) {
    console.error('Auth check failed:', err);
  }
}

function renderAccountInfo(athlete) {
  const el = document.getElementById('accountInfo');
  const roleBadge = userRole === 'vip' ? '<span class="status-badge" style="background:var(--gradient-vip); color:rgba(0,0,0,0.8); padding:2px 10px; font-size:0.65rem; border:none; margin-left:8px; box-shadow: 0 0 10px rgba(245,158,11,0.4); font-weight:800;">VIP GOLD</span>' : '';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      ${athlete?.avatar ? `<img src="${athlete.avatar}" style="width:48px;height:48px;border-radius:50%;border:2px solid var(--strava-orange);" alt="avatar">` : '<div style="width:48px;height:48px;border-radius:50%;background:var(--strava-orange);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🏃</div>'}
      <div>
        <div style="font-weight:600; display:flex; align-items:center;">${athlete?.name || 'Strava User'} ${roleBadge}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);">ID: ${athlete?.id || 'N/A'}</div>
      </div>
    </div>
    <button class="btn btn-danger btn-sm btn-block" onclick="disconnect()">Disconnect Strava</button>
    <button class="btn btn-outline-danger btn-sm btn-block" style="margin-top:10px;" onclick="systemLogout()">Logout System</button>
  `;
}

async function systemLogout() {
  try {
    await fetch('/auth/system/logout', { method: 'POST' });
    window.location.href = '/login.html';
  } catch (err) {
    console.error('Logout error:', err);
  }
}

async function disconnect() {
  try {
    if (!confirm('Disconnect Strava account?')) return;
    await fetch('/auth/disconnect', { method: 'POST' });
    checkAuth();
    showToast('Strava disconnected');
  } catch (err) {
    showToast('Failed to disconnect Strava', 'error');
  }
}

// ─── Dashboard ──────────────────────────────────────────

let userRole = 'normal';
let sysLimits = null;

async function fetchLimits() {
  try {
    sysLimits = await api('/system-limits');
    applyLimitsToUI();
  } catch (err) { console.error('Limits fetch error:', err); }
}

function applyLimitsToUI() {
  if (!sysLimits) return;

  // Sync Input ranges
  const syncRange = (id, key) => {
    const el = document.getElementById(id);
    if (el && sysLimits[key]) {
      el.min = sysLimits[key].min;
      el.max = sysLimits[key].max;
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
  if (dailyLimit) dailyLimit.value = sysLimits.daily_upload_limit.max;

  // Target Date Constraints
  const targetDateInput = document.getElementById('cfgTargetDate');
  if (targetDateInput) {
    const today = new Date();
    const maxDaysAgo = sysLimits.target_date.max;
    const minDate = new Date();
    minDate.setDate(today.getDate() - maxDaysAgo);
    targetDateInput.min = minDate.toLocaleDateString('en-CA');
    targetDateInput.max = today.toLocaleDateString('en-CA');
  }

  // Build Dynamic Tooltips from Metadata
  updateDynamicTooltips();

  // Populate HR Zones Display (using 'normal' values as requested)
  const hrZones = sysLimits.heart_rate_zones.normal;
  const setZone = (id, zone) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${Math.round(zone.min * 100)}-${Math.round(zone.max * 100)}%`;
  };
  setZone('hrZoneWalk', hrZones.Walk);
  setZone('hrZoneRide', hrZones.Ride);
  setZone('hrZoneRun', hrZones.Run);
}

function updateDynamicTooltips() {
  if (!sysLimits) return;

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
    const cfg = sysLimits[key];
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
    // If it's a fixed value (min === max), just show that value
    if (min === max) return `${min}${cfg.unit ? ' ' + cfg.unit : ''}`;
    return `${min} - ${max}${cfg.unit ? ' ' + cfg.unit : ''}`;
  }
  return null;
}

async function loadDashboard(forceRefresh = false) {
  await fetchLimits();
  await loadDistricts();
  await Promise.all([
    loadStats(),
    loadConfig(),
    loadSchedule(),
    loadActivities(),
    loadStravaActivities(forceRefresh),
    loadInsights(forceRefresh)
  ]);
  initMap();
  resetMapView();
}

async function loadStats() {
  try {
    const stats = await api('/stats');
    userRole = stats.role || 'normal';
    if (userRole === 'vip') {
      document.body.classList.add('is-vip');
    } else {
      document.body.classList.remove('is-vip');
    }

    // Refresh header name with VIP indicator
    const authText = document.getElementById('authText');
    if (authText) {
      const currentName = authText.textContent.replace(' VIP', '').trim();
      const vipTag = userRole === 'vip' ? ' <span style="color:var(--vip-gold); font-size:0.7rem; font-weight:800; border:1px solid var(--vip-gold); padding:1px 6px; border-radius:4px; margin-left:6px; background:rgba(245,158,11,0.1);">VIP</span>' : '';
      authText.innerHTML = currentName + vipTag;
    }
    
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statUploaded').textContent = stats.uploaded;
    document.getElementById('statDistance').textContent = stats.totalDistanceKm;
    document.getElementById('statDuration').textContent = stats.totalDurationMin;

    // Update VIP Activation Area
    const vipArea = document.getElementById('vipActivationArea');
    if (vipArea) {
      if (userRole === 'vip') {
        vipArea.innerHTML = `
          <div style="padding: 12px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; text-align: center;">
            <div style="color: #f59e0b; font-weight: 600; font-size: 0.9rem;">✨ You already VIP account!</div>
            <div style="margin-top:4px; font-size:0.75rem; color:var(--text-muted);">Thank you for supporting StrAct Z.</div>
          </div>
          <div style="margin-top:12px; display:flex; flex-direction:column; gap:8px;">
            <button id="btnThemeToggle" class="btn btn-sm btn-outline-gold btn-block" onclick="toggleThemePreview()">
              ${document.body.classList.contains('theme-preview-normal') ? '✨ Restore VIP Gold Theme' : '👁️ Preview Normal Theme'}
            </button>
          </div>
          <div style="margin-top:10px; font-size:0.75rem; color:var(--text-muted); text-align:right;">
            Contact for VIP: <a href="mailto:stract-z@crfnetwork.com" style="color:inherit;text-decoration:none;">stract-z@crfnetwork.com</a>
          </div>`;
      } else {
        vipArea.innerHTML = `
          <label class="form-label">Activate VIP Code</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="cfgVipCode" class="form-input" placeholder="Enter VIP Code" style="flex:1; font-family:monospace;">
            <button class="btn btn-sm btn-accent" onclick="activateVip()">Activate</button>
          </div>
          <div style="margin-top:12px;">
            <button id="btnThemeToggle" class="btn btn-sm btn-secondary btn-block" onclick="toggleThemePreview()">
              ${document.body.classList.contains('is-vip') ? '🔙 Switch Back to Normal' : '👁️ Preview VIP Gold Theme'}
            </button>
          </div>
          <div style="margin-top:10px; font-size:0.75rem; color:var(--text-muted); text-align:right;">
            Contact for VIP: <a href="mailto:stract-z@crfnetwork.com" style="color:inherit;text-decoration:none;">stract-z@crfnetwork.com</a>
          </div>`;
      }
    }
  } catch (err) { console.error('Stats error:', err); }
}

let sysDistricts = [];

async function loadDistricts() {
  try {
    sysDistricts = await api('/districts');
  } catch (err) {
    console.error('Failed to load districts:', err);
  }
}

async function loadConfig() {
  try {
    const config = await api('/config');
    
    // Render District Checkboxes
    const container = document.getElementById('cfgDistricts');
    if (container) {
      const selectedKeys = config.selected_districts ? config.selected_districts.split(',') : [];
      container.innerHTML = '';
      container.style.display = 'grid';
      container.style.gridTemplateColumns = 'repeat(3, 1fr)';
      container.style.gap = '10px';
      
      sysDistricts.forEach(d => {
        let isChecked = '';
        if (config.selected_districts !== undefined) {
          isChecked = selectedKeys.includes(d.key) ? 'checked' : '';
        } else {
          // If no saved config, use the 'default' group flag from the registry
          const isDefault = d.groups && d.groups.includes('default');
          isChecked = isDefault ? 'checked' : '';
        }
        
        container.innerHTML += `
          <label class="toggle" style="font-size:0.8rem; margin-bottom:5px;">
            <input type="checkbox" class="district-cb" value="${d.key}" ${isChecked}>
            <div class="toggle-track" style="transform:scale(0.8)"></div>
            <span>${d.name}</span>
          </label>
        `;
      });
    }

    const maxSpanInput = document.getElementById('cfgMaxSpan');
    if (maxSpanInput) maxSpanInput.value = config.max_district_span || '1';

    const osrmToggle = document.getElementById('cfgOsrm');
    if (osrmToggle) osrmToggle.checked = config.use_osrm !== 'false';
    
    // Set Target Date to today by default
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
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
    
    // Initial HR state
    toggleHRInputs();

    if (document.getElementById('cfgOverlapProtection')) {
      document.getElementById('cfgOverlapProtection').value = config.overlap_protection_minutes || '30';
    }

    if (config.map_lat && config.map_lng && config.map_zoom) {
      savedMapState = {
        lat: parseFloat(config.map_lat),
        lng: parseFloat(config.map_lng),
        zoom: parseInt(config.map_zoom)
      };
    }

    // Render Map Areas
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
  const sysL = sysLimits;
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
    district_key: 'random', // Legacy field override
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

// ─── Schedule ───────────────────────────────────────────

async function loadSchedule() {
  try {
    const status = await api('/scheduler');
    document.getElementById('scheduleEnabled').checked = status.enabled;
    document.getElementById('scheduleTime').value = status.scheduleTime || '06:00';
    document.getElementById('scheduleCountMin').value = status.scheduleCountMin || 1;
    document.getElementById('scheduleCountMax').value = status.scheduleCountMax || 1;
    updateScheduleDisplay(status);
  } catch (err) { console.error('Schedule error:', err); }
}

function updateScheduleDisplay(status) {
  const display = document.getElementById('scheduleDisplay');
  if (status?.enabled) {
    display.style.display = 'flex';
    document.getElementById('scheduleTimeDisplay').textContent = status.scheduleTime || '06:00';
  } else {
    display.style.display = 'none';
  }
}

async function updateSchedule() {
  const enabled = document.getElementById('scheduleEnabled').checked;
  const time = document.getElementById('scheduleTime').value;
  const countMin = parseInt(document.getElementById('scheduleCountMin').value);
  const countMax = parseInt(document.getElementById('scheduleCountMax').value);
  
  if (countMax > sysLimits.schedule_count_max.max) {
    showToast(`Your account is limited to ${sysLimits.schedule_count_max.max} daily scheduled activities.`, 'warning');
    document.getElementById('scheduleCountMax').value = sysLimits.schedule_count_max.max;
    return;
  }
  
  if (countMin > countMax) {
    showToast('Min Count must not exceed Max Count', 'error');
    return;
  }
  
  const status = await api('/scheduler', { method: 'POST', body: { enabled, time, countMin, countMax } });
  if (status.error) {
    showToast(status.error, 'error');
    return;
  }
  updateScheduleDisplay(status);
  showToast(enabled ? `Schedule enabled at ${time} (${countMin}-${countMax} acts)` : 'Schedule disabled', 'success');
}

// ─── Activities ─────────────────────────────────────────

let localCurrentPage = 1;
const LOCAL_PAGE_SIZE = 10;

async function loadActivities() {
  try {
    const allActivities = await api('/activities');
    console.log(`[Local] Fetched ${allActivities.length} activities`);
    const container = document.getElementById('activityList');
    const total = allActivities.length;
    const totalPages = Math.max(1, Math.ceil(total / LOCAL_PAGE_SIZE));
    
    // Clamp page
    if (localCurrentPage > totalPages) localCurrentPage = totalPages;
    if (localCurrentPage < 1) localCurrentPage = 1;
    
    document.getElementById('historyCount').textContent = `${total} activities`;
    document.getElementById('localPageInfo').textContent = `Page ${localCurrentPage}/${totalPages}`;

    if (!total) {
      container.innerHTML = '<div class="empty-state"><div class="icon">\ud83c\udfc3</div><p>No activities yet. Generate your first one!</p></div>';
      return;
    }

    const start = (localCurrentPage - 1) * LOCAL_PAGE_SIZE;
    const pageActivities = allActivities.slice(start, start + LOCAL_PAGE_SIZE);

    container.innerHTML = pageActivities.map(a => {
      // ... (keep existing mapping logic)
      const actualTime = a.route_start_time || a.created_at;
      const dateStr = actualTime.endsWith('Z') ? actualTime : actualTime + 'Z';
      const dateObj = new Date(dateStr);
      const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
      const dateOnlyStr = dateObj.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      
      let districtTags = '';
      if (a.district_keys) {
         const keys = a.district_keys.split(',');
          districtTags = keys.map(k => {
            const name = sysDistricts.find(d => d.key === k)?.name || k;
            return `<span class="status-badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid var(--border); padding: 2px 6px;">📍 ${name}</span>`;
          }).join('');
      }

      const statusClass = a.upload_status;
      return `
        <div class="activity-item">
          <div>
            <div class="activity-name">${a.activity_name || 'Unnamed'}</div>
            <div class="activity-date" style="display:flex; gap:6px; margin-top:4px; flex-wrap:wrap; align-items:center;">
               <span class="status-badge" style="background: rgba(59, 130, 246, 0.1); color: var(--accent-blue); padding: 2px 6px;">🕒 ${timeStr} ${dateOnlyStr}</span>
               ${districtTags}
            </div>
          </div>
          <div class="activity-meta">${a.distance_km?.toFixed(1)} km</div>
          <div class="activity-meta">${a.duration_min?.toFixed(0)} min</div>
          <div class="activity-meta">${a.pace_min_km?.toFixed(1)} min/km</div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span class="status-badge ${statusClass}">${a.upload_status}</span>
            ${a.upload_status === 'generated' ? `<button class="btn btn-sm btn-primary" onclick="uploadActivity(${a.id})">Upload</button>` : ''}
            ${a.strava_activity_id ? `<a href="https://www.strava.com/activities/${a.strava_activity_id}" target="_blank" class="btn btn-sm btn-secondary">View</a>` : ''}
            ${a.upload_status === 'generated' ? 
              `<button class="btn btn-sm btn-danger" style="padding:4px 8px;" title="Delete locally" onclick="deleteActivity(${a.id}, false)">🗑️</button>` : 
              `<span class="tooltip-icon tooltip-left" data-tooltip="Hoạt động đã upload phải được xóa trực tiếp trên Strava.com">?</span>`
            }
          </div>
        </div>`;
    }).join('');

    // Dim Navigator buttons
    const prevBtn = document.querySelector('button[onclick="changeLocalPage(-1)"]');
    const nextBtn = document.querySelector('button[onclick="changeLocalPage(1)"]');
    if (prevBtn) {
      prevBtn.disabled = localCurrentPage <= 1;
      prevBtn.style.opacity = localCurrentPage <= 1 ? '0.4' : '1';
      prevBtn.style.cursor = localCurrentPage <= 1 ? 'not-allowed' : 'pointer';
    }
    if (nextBtn) {
      nextBtn.disabled = localCurrentPage >= totalPages;
      nextBtn.style.opacity = localCurrentPage >= totalPages ? '0.4' : '1';
      nextBtn.style.cursor = localCurrentPage >= totalPages ? 'not-allowed' : 'pointer';
    }
  } catch (err) { console.error('Activities error:', err); }
}

function changeLocalPage(delta) {
  localCurrentPage += delta;
  if (localCurrentPage < 1) localCurrentPage = 1;
  loadActivities();
}

let stravaCurrentPage = 1;

function onStravaFilterChange() {
  stravaCurrentPage = 1;
  loadStravaActivities();
}

async function refreshCloudData() {
  showToast('Refreshing cloud data...', 'info');
  await Promise.all([
    loadStravaActivities(true),
    loadInsights(true)
  ]);
  showToast('Cloud data updated!', 'success');
}

async function loadStravaActivities(forceRefresh = false) {
  const container = document.getElementById('stravaActivityList');
  if (!container) return;
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading...</p></div>';
  
  try {
    const range = document.getElementById('stravaFilterRange').value;
    let afterQuery = '';
    if (range !== 'total') {
      let days = 7;
      if (range === '3_days') days = 3;
      else if (range === '5_days') days = 5;
      else if (range === '7_days') days = 7;
      else if (range === '14_days') days = 14;
      else if (range === '30_days') days = 30;
      else if (range === '90_days') days = 90;

      // Set "after" to local midnight of N days ago
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (days - 1));
      afterQuery = `&after=${Math.floor(d.getTime() / 1000)}`;
    }

    const refreshQuery = forceRefresh ? '&refresh=true' : '';
    let activities = await api(`/strava-activities?page=${stravaCurrentPage}&per_page=10${afterQuery}${refreshQuery}`);
    document.getElementById('stravaPageInfo').textContent = `Page ${stravaCurrentPage}`;
    
    if (!activities || !activities.length) {
      container.innerHTML = '<div class="empty-state"><div class="icon">☁️</div><p>No activities found on Strava.</p></div>';
      return;
    }
    
    // Sort descending (latest first)
    activities.sort((a, b) => {
      const dateA = new Date(a.start_date || a.created_at || 0);
      const dateB = new Date(b.start_date || b.created_at || 0);
      return dateB - dateA;
    });
    
    container.innerHTML = activities.map(a => {
      const date = new Date(a.start_date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const distance = (a.distance / 1000).toFixed(1);
      const duration = (a.moving_time / 60).toFixed(0);
      const pace = a.average_speed > 0 ? (1000 / a.average_speed / 60).toFixed(1) : '0';
      return `
        <div class="activity-item">
          <div>
            <div class="activity-name">${a.name}</div>
            <div class="activity-date">${date}</div>
          </div>
          <div class="activity-meta">${distance} km</div>
          <div class="activity-meta">${duration} min</div>
          <div class="activity-meta">${pace} min/km</div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span class="status-badge uploaded">${a.type}</span>
            <a href="https://www.strava.com/activities/${a.id}" target="_blank" class="btn btn-sm btn-secondary">View</a>
          </div>
        </div>`;
    }).join('');

    // Dim Navigator buttons
    const prevBtn = document.querySelector('button[onclick="changeStravaPage(-1)"]');
    const nextBtn = document.querySelector('button[onclick="changeStravaPage(1)"]');
    if (prevBtn) {
      prevBtn.disabled = stravaCurrentPage <= 1;
      prevBtn.style.opacity = stravaCurrentPage <= 1 ? '0.4' : '1';
      prevBtn.style.cursor = stravaCurrentPage <= 1 ? 'not-allowed' : 'pointer';
    }
    if (nextBtn) {
      const hasMore = (activities && activities.length === 10);
      nextBtn.disabled = !hasMore;
      nextBtn.style.opacity = !hasMore ? '0.4' : '1';
      nextBtn.style.cursor = !hasMore ? 'not-allowed' : 'pointer';
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>Failed to load Strava activities: ${err.message}</p></div>`;
  }
}

function changeStravaPage(delta) {
  if (stravaCurrentPage + delta < 1) return;
  stravaCurrentPage += delta;
  loadStravaActivities();
}

// ─── Actions ────────────────────────────────────────────

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

async function generateOnly() {
  const btn = document.getElementById('btnGenerate');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating...';
  showToast('Generating GPX...', 'info');

  try {
    const overrideConfig = getOverrideConfig();
    if (!overrideConfig) {
      btn.disabled = false;
      btn.innerHTML = '⚡ Generate Now';
      return;
    }

    const result = await api('/generate', { method: 'POST', body: overrideConfig });
    if (result.success) {
      showToast(`Generated: ${result.activity.name} (${result.activity.distanceKm}km)`, 'success');
      loadActivities();
      loadStats();
    } else {
      showToast(result.error || 'Generation failed', 'error');
    }
  } catch (err) {
    showToast('Generation failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '📝 Generate GPX Only';
  }
}

async function generateAndUpload() {
  const btn = document.getElementById('btnGenerateUpload');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating & Uploading...';
  showToast('Generating & uploading to Strava...', 'info');

  try {
    const overrideConfig = getOverrideConfig();
    if (!overrideConfig) {
      btn.disabled = false;
      btn.innerHTML = '🚀 Generate & Upload to Strava';
      return;
    }
    
    const result = await api('/generate-and-upload', { method: 'POST', body: overrideConfig });
    if (result.success) {
      showToast(`Uploaded to Strava! Activity: ${result.activity?.activityName || 'Done'}`, 'success');
    } else {
      if (result.message === 'VIP_REQUIRED') {
        showToast('Daily limit reached (2 activities/day). Contact Admin to upgrade.', 'warning');
      } else {
        showToast(result.message || 'Upload failed', 'error');
      }
    }
    await loadDashboard(true); // Full refresh
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🚀 Generate & Upload to Strava';
  }
}

async function uploadActivity(id) {
  showToast('Uploading to Strava...', 'info');
  try {
    const result = await api(`/upload/${id}`, { method: 'POST' });
    if (result.success) {
      showToast('Uploaded successfully!', 'success');
    } else {
      showToast(result.error || 'Upload failed', 'error');
    }
    await loadDashboard(true);
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
  }
}

async function deleteActivity(id, hasStrava) {
  // Removed confirm() because browser blocking it causes silent failures.

  showToast('Deleting activity...', 'info');

  try {
    const result = await api(`/activities/${id}?strava=${hasStrava}`, { method: 'DELETE' });
    if (result.success) {
      if (result.stravaError) {
        showToast(result.message || 'Deleted locally, Strava error', 'warning');
      } else {
        showToast(result.message || 'Activity deleted', 'success');
      }
      await loadDashboard(true);
    } else {
      showToast(result.error || 'Failed to delete activity', 'error');
    }
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

async function updatePassword() {
  const newPassword = document.getElementById('cfgNewPassword').value;
  if (!newPassword || newPassword.length < 5) {
    return showToast('Password must be at least 5 characters', 'warning');
  }
  try {
    const result = await api('/account/password', {
      method: 'PUT',
      body: { newPassword }
    });
    if (result.success) {
      showToast(result.message, 'success');
      document.getElementById('cfgNewPassword').value = '';
    } else {
      showToast(result.error || 'Failed to update password', 'error');
    }
  } catch (err) {
    showToast('Failed to update password: ' + err.message, 'error');
  }
}

// ─── UI Helpers ─────────────────────────────────────────

function checkMaxSpan() {
  const el = document.getElementById('cfgMaxSpan');
  if (parseInt(el.value, 10) > sysLimits.max_district_span) {
    showToast(`Max ${sysLimits.max_district_span} districts allowed for your account.`, 'warning');
    el.value = sysLimits.max_district_span;
  }
}

function toggleCustomTime() {
  const isCustom = document.getElementById('cfgCustomTime').checked;
  const customInputs = document.getElementById('timeCustomInputs');
  const randomInputs = document.getElementById('timeRandomInputs');
  
  if (isCustom) {
    // Custom time active: dim random, enable custom
    customInputs.style.opacity = '1';
    customInputs.style.pointerEvents = 'auto';
    randomInputs.style.opacity = '0.4';
    randomInputs.style.pointerEvents = 'none';
  } else {
    // Random time active (default): dim custom, enable random
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

// ─── URL Params ─────────────────────────────────────────

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('success') === 'connected') {
    showToast('Successfully connected to Strava!', 'success');
    history.replaceState(null, '', '/');
  }
  if (params.get('error')) {
    showToast('Error: ' + params.get('error'), 'error');
    history.replaceState(null, '', '/');
  }
}

// ─── Init ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  checkUrlParams();
  checkAuth();
  
  // Attach HR toggle listener
  const hrToggle = document.getElementById('cfgHeartRate');
  if (hrToggle) {
    hrToggle.addEventListener('change', toggleHRInputs);
  }
});
// ─── Map & Activity Areas ─────────────────────────────────

let map = null;
let activityCircles = [];
let isMapLocked = true;
let savedMapState = { lat: 21.0285, lng: 105.8542, zoom: 12 };

function initMap() {
  if (map || !document.getElementById('activityMap')) return;
  
  map = L.map('activityMap').setView([savedMapState.lat, savedMapState.lng], savedMapState.zoom);
  
  // Use CartoDB Dark Matter for a premium, high-contrast look that matches the UI
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Apply default lock
  applyMapLock();

  // Render district highlights
  renderDistrictBorders();

  // Small delay to ensure container is ready
  setTimeout(() => map.invalidateSize(), 100);
}

function toggleMapLock() {
  isMapLocked = !isMapLocked;
  applyMapLock();
  updateLockUI();
}

function applyMapLock() {
  if (!map) return;
  if (isMapLocked) {
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    if (map.tap) map.tap.disable();
  } else {
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    map.scrollWheelZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
    if (map.tap) map.tap.enable();
  }
}

function updateLockUI() {
  const btn = document.getElementById('btnLockMap');
  if (btn) {
    btn.innerHTML = isMapLocked ? '🔒 Map Locked' : '🔓 Map Unlocked';
    btn.classList.toggle('btn-secondary', isMapLocked);
    btn.classList.toggle('btn-outline-secondary', !isMapLocked);
  }
}

async function renderDistrictBorders() {
  if (!map) return;
  try {
    // Load GeoJSON for urban districts (extracted administrative polygons)
    const res = await fetch('/geo/hanoi_urban_districts.geojson');
    if (!res.ok) throw new Error('Could not load districts GeoJSON');
    const geojson = await res.json();
    
    // Choose color based on user role (Gold for VIP, Cyan for Normal)
    const borderColor = (typeof userRole !== 'undefined' && userRole === 'vip') ? '#fbbf24' : '#22d3ee';
    
    L.geoJSON(geojson, {
      style: {
        color: borderColor,    // High contrast color
        weight: 1.5,           // Thinner but cleaner border
        opacity: 0.8,          // Clear boundary
        fillColor: borderColor,
        fillOpacity: 0.04,     // Reduced by half for better internal visibility
        interactive: true      // Enable interaction for tooltips
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties && feature.properties.name) {
          layer.bindTooltip(feature.properties.name, {
            sticky: true,
            className: 'district-tooltip',
            direction: 'top',
            offset: [0, -10]
          });
        }
      }
    }).addTo(map);
  } catch (err) {
    console.error('Failed to render district borders:', err);
  }
}

function resetMapView() {
  if (map) {
    map.setView([savedMapState.lat, savedMapState.lng], savedMapState.zoom);
  }
}


function renderCircles(areasData) {
  if (!map) initMap();
  
  // Clear existing
  activityCircles.forEach(item => {
    map.removeLayer(item.circle);
    map.removeLayer(item.marker);
  });
  activityCircles = [];

  try {
    const areas = typeof areasData === 'string' ? JSON.parse(areasData) : (areasData || []);
    areas.forEach(area => {
      createCircleLayer(area.lat, area.lng, area.radius, area.type);
    });
  } catch (e) { console.error('Error rendering circles:', e); }
}

function createCircleLayer(lat, lng, radius, type) {
  const color = type === 'home' ? '#ff7800' : '#3b82f6'; // Home: Orange, Work: Blue
  
  // Circle for area visualization
  const circle = L.circle([lat, lng], {
    color: color,
    fillColor: color,
    fillOpacity: 0.15,
    radius: radius,
    weight: 2
  }).addTo(map);

  // Marker for dragging and deletion
  const marker = L.marker([lat, lng], {
    draggable: true,
    title: type.toUpperCase()
  }).addTo(map);

  const item = { circle, marker, type };
  activityCircles.push(item);

  marker.on('drag', (e) => {
    circle.setLatLng(e.latlng);
  });

  const popupId = `radius-val-${activityCircles.length - 1}`;
  marker.bindPopup(`
    <div style="text-align:center; min-width:150px;">
      <b style="color:${color}">${type.toUpperCase()}</b><br>
      <div style="margin:8px 0; font-size:0.8rem;">
        Radius: <b id="${popupId}">${radius}</b>m<br>
        <input type="range" value="${radius}" min="2000" max="4000" step="100" 
          style="width:100%; margin-top:5px; accent-color:var(--strava-orange);" 
          oninput="document.getElementById('${popupId}').innerText = this.value; updateCircleRadius(${activityCircles.length - 1}, this.value)">
      </div>
      <button class="btn btn-sm btn-secondary" style="margin-top:5px; padding:2px 8px; color:var(--accent-red); font-size:0.7rem;" onclick="removeCircle(${activityCircles.length - 1})">🗑️ Delete Area</button>
    </div>
  `);
}

function addActivityCircle(type) {
  if (!map) return;
  
  // Only home or work allowed
  if (type !== 'home' && type !== 'work') return;

  const count = activityCircles.filter(c => c.type === type).length;
  if (count >= 1) return showToast(`Only 1 ${type} area allowed`, 'warning');

  const center = map.getCenter();
  createCircleLayer(center.lat, center.lng, 2000, type);
  showToast(`Added ${type} area`, 'info');
}

function updateCircleRadius(index, newRadius) {
  if (activityCircles[index]) {
    let r = parseInt(newRadius);
    if (r < 2000) r = 2000;
    if (r > 4000) r = 4000;
    activityCircles[index].circle.setRadius(r);
  }
}

function removeCircle(index) {
  if (activityCircles[index]) {
    map.removeLayer(activityCircles[index].circle);
    map.removeLayer(activityCircles[index].marker);
    activityCircles.splice(index, 1);
    // Re-render to fix indices in popups
    const currentData = activityCircles.map(c => ({
      lat: c.marker.getLatLng().lat,
      lng: c.marker.getLatLng().lng,
      radius: c.circle.getRadius(),
      type: c.type
    }));
    renderCircles(currentData);
  }
}

async function saveActivityAreas() {
  const data = activityCircles.map(c => ({
    lat: c.marker.getLatLng().lat,
    lng: c.marker.getLatLng().lng,
    radius: c.circle.getRadius(),
    type: c.type
  }));

  const center = map.getCenter();
  const zoom = map.getZoom();

  try {
    const res = await api('/config', {
      method: 'POST',
      body: { 
        activity_areas: JSON.stringify(data),
        map_lat: center.lat.toString(),
        map_lng: center.lng.toString(),
        map_zoom: zoom.toString()
      }
    });
    
    if (res.error) showToast(res.error, 'error');
    else {
      showToast('Activity areas & map view saved!', 'success');
      savedMapState = { lat: center.lat, lng: center.lng, zoom: zoom };
    }
  } catch (err) {
    showToast('Failed to save areas: ' + err.message, 'error');
  }
}

async function resetToDefault() {
  if (!confirm('Are you sure you want to reset all settings to default? (Map areas will be preserved)')) return;

  showToast('Resetting configuration...', 'info');
  try {
    const res = await api('/config/reset', { method: 'POST' });
    if (res.success) {
      showToast('Configuration reset successfully', 'success');
      // Reset local map state to Hanoi defaults
      savedMapState = { lat: 21.0285, lng: 105.8542, zoom: 12 };
      await loadDashboard(true);
    } else {
      showToast(res.error || 'Reset failed', 'error');
    }
  } catch (err) {
    showToast('Reset failed: ' + err.message, 'error');
  }
}
// ─── Statistics Chart ────────────────────────────────────

async function loadInsights(forceRefresh = false) {
  const range = document.getElementById('insightsTimeRange').value || 14;
  try {
    const refreshQuery = forceRefresh ? '&refresh=true' : '';
    const activities = await api(`/insights?days=${range}${refreshQuery}`);
    updateActivityChart(activities, parseInt(range));
  } catch (err) {
    console.error('Insights error:', err);
  }
}

let activityChart = null;

function updateActivityChart(activities, days = 14) {
  const ctx = document.getElementById('activityChart');
  if (!ctx) return;

  // Group by date for specified range (Hanoi time)
  const rangeDays = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    rangeDays.push(d.toLocaleDateString('en-CA'));
  }

  const dailyDist = rangeDays.map(date => {
    return activities
      .filter(a => {
        const startDate = a.start_date || a.created_at;
        if (!startDate) return false;
        // Convert Strava UTC date to Hanoi local date string (YYYY-MM-DD)
        const localDate = new Date(startDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        return localDate === date;
      })
      .reduce((sum, a) => sum + (a.distance / 1000 || a.distance_km || 0), 0);
  });

  const dailyTime = rangeDays.map(date => {
    return activities
      .filter(a => {
        const startDate = a.start_date || a.created_at;
        if (!startDate) return false;
        // Convert Strava UTC date to Hanoi local date string (YYYY-MM-DD)
        const localDate = new Date(startDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        return localDate === date;
      })
      .reduce((sum, a) => sum + (a.moving_time / 60 || a.duration_min || 0), 0);
  });

  if (activityChart) {
    activityChart.destroy();
  }

  activityChart = new Chart(ctx, {
    data: {
      labels: rangeDays.map(d => d.split('-').slice(1).reverse().join('/')), // MM/DD -> DD/MM
      datasets: [
        {
          type: 'bar',
          label: 'Distance (km)',
          data: dailyDist,
          backgroundColor: 'rgba(252, 76, 2, 0.5)',
          borderColor: 'rgba(252, 76, 2, 1)',
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Duration (min)',
          data: dailyTime,
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: true,
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: 'km', color: 'rgba(252, 76, 2, 0.8)', font: { size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 } }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          beginAtZero: true,
          title: { display: true, text: 'min', color: 'rgba(59, 130, 246, 0.8)', font: { size: 10 } },
          grid: { drawOnChartArea: false },
          ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 } }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 }, boxWidth: 12 }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(252, 76, 2, 0.4)',
          borderWidth: 1,
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(1)} ${context.dataset.label.includes('km') ? 'km' : 'min'}`
          }
        }
      }
    }
  });
}
function updateMHR() {
  const age = parseInt(document.getElementById('cfgUserAge').value || '25', 10);
  const mhr = 220 - age;
  document.getElementById('cfgMaxHR').value = mhr;
}

async function activateVip() {
  const code = document.getElementById('cfgVipCode').value;
  if (!code) return showToast('Please enter a VIP code', 'warning');
  
  showToast('Activating...', 'info');
  try {
    const result = await api('/account/activate-vip', { method: 'POST', body: { code } });
    if (result.success) {
      showToast(result.message, 'success');
      document.getElementById('cfgVipCode').value = '';
      setTimeout(() => location.reload(), 2000);
    } else {
      showToast(result.error || 'Activation failed', 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
}

function toggleThemePreview() {
  const btn = document.getElementById('btnThemeToggle');
  
  if (userRole === 'vip') {
    const isNormal = document.body.classList.toggle('theme-preview-normal');
    localStorage.setItem('stractz_theme_preview', isNormal ? 'normal' : 'vip');
    if (btn) btn.innerHTML = isNormal ? '✨ Restore VIP Gold Theme' : '👁️ Preview Normal Theme';
    showToast(isNormal ? 'Switched to Normal Theme (Preview)' : 'Restored VIP Gold Theme', 'success');
  } else {
    // Normal user logic
    const isVipPreview = document.body.classList.toggle('is-vip');
    // We DON'T save to localStorage for normal users
    if (btn) btn.innerHTML = isVipPreview ? '🔙 Switch Back to Normal' : '👁️ Preview VIP Gold Theme';
    showToast(isVipPreview ? 'Previewing VIP Gold Theme' : 'Switched back to Normal Theme', 'info');
  }
}

// Initialize theme preview if saved (VIP Only)
async function initTheme() {
  // Wait for stats to load role
  const stats = await api('/stats').catch(() => ({ role: 'normal' }));
  if (stats.role === 'vip' && localStorage.getItem('stractz_theme_preview') === 'normal') {
    document.body.classList.add('theme-preview-normal');
  }
}
initTheme();

// ─── PWA Service Worker Registration ────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('Service Worker registered', reg))
      .catch((err) => console.error('Service Worker registration failed', err));
  });
}

