/**
 * Strava Auto Activity Generator - Frontend Logic
 */

// ─── API Helpers ────────────────────────────────────────

async function api(endpoint, options = {}) {
  const res = await fetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return res.json();
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
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      ${athlete?.avatar ? `<img src="${athlete.avatar}" style="width:48px;height:48px;border-radius:50%;border:2px solid var(--strava-orange);" alt="avatar">` : '<div style="width:48px;height:48px;border-radius:50%;background:var(--strava-orange);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🏃</div>'}
      <div>
        <div style="font-weight:600;">${athlete?.name || 'Strava User'}</div>
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

async function loadDashboard() {
  await Promise.all([loadStats(), loadDistricts(), loadConfig(), loadSchedule(), loadActivities(), loadStravaActivities()]);
}

async function loadDistricts() {
  try {
    const districts = await api('/districts');
    const select = document.getElementById('cfgDistrict');
    if (!select) return;
    select.innerHTML = districts.map(d => `<option value="${d.key}">${d.name}</option>`).join('');
  } catch (err) { console.error('Districts error:', err); }
}

async function loadStats() {
  try {
    const stats = await api('/stats');
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statUploaded').textContent = stats.uploaded;
    document.getElementById('statDistance').textContent = stats.totalDistanceKm;
    document.getElementById('statDuration').textContent = stats.totalDurationMin;
  } catch (err) { console.error('Stats error:', err); }
}

const HANOI_DISTRICTS = [
  { key: 'hoan_kiem', name: 'Hoàn Kiếm' },
  { key: 'hai_ba_trung', name: 'Hai Bà Trưng' },
  { key: 'hoang_mai', name: 'Hoàng Mai' },
  { key: 'dong_da', name: 'Đống Đa' },
  { key: 'ba_dinh', name: 'Ba Đình' },
  { key: 'thanh_xuan', name: 'Thanh Xuân' },
  { key: 'cau_giay', name: 'Cầu Giấy' },
  { key: 'tay_ho', name: 'Tây Hồ' },
  { key: 'long_bien', name: 'Long Biên', defaultOff: true },
  { key: 'ha_dong', name: 'Hà Đông' },
  { key: 'bac_tu_liem', name: 'Bắc Từ Liêm', defaultOff: true },
  { key: 'nam_tu_liem', name: 'Nam Từ Liêm', defaultOff: true }
];

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
      
      HANOI_DISTRICTS.forEach(d => {
        let isChecked = '';
        if (config.selected_districts !== undefined) {
          isChecked = selectedKeys.includes(d.key) ? 'checked' : '';
        } else {
          isChecked = d.defaultOff ? '' : 'checked';
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
    document.getElementById('cfgMinHR').value = config.min_heart_rate || '80';
    document.getElementById('cfgMaxHR').value = config.max_heart_rate || '160';
    
    if (document.getElementById('cfgSimWeather')) {
      document.getElementById('cfgSimWeather').checked = config.sim_weather !== 'false';
    }
    if (document.getElementById('cfgSimRedLights')) {
      document.getElementById('cfgSimRedLights').checked = config.sim_redlights !== 'false';
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
  if (parseInt(config.max_district_span, 10) > 2) {
    showToast('Max 2 districts allowed. Contact Admin to upgrade (VIP feature).', 'warning');
    document.getElementById('cfgMaxSpan').value = 2;
    return false;
  }
  
  const minDist = parseFloat(config.min_distance_km);
  const maxDist = parseFloat(config.max_distance_km);
  if (minDist < 0.2 || minDist > 4) { showToast('Min Distance must be between 0.2 and 4 km', 'error'); return false; }
  if (maxDist < 1 || maxDist > 15) { showToast('Max Distance must be between 1 and 15 km', 'error'); return false; }
  if (minDist >= maxDist) { showToast('Min Distance must be less than Max Distance', 'error'); return false; }
  
  const minPace = parseFloat(config.min_pace);
  const maxPace = parseFloat(config.max_pace);
  if (minPace < 6 || minPace > 12) { showToast('Min Pace must be between 6 and 12 min/km', 'error'); return false; }
  if (maxPace < 10 || maxPace > 15) { showToast('Max Pace must be between 10 and 15 min/km', 'error'); return false; }
  if (minPace > maxPace) { showToast('Min Pace must be less than or equal to Max Pace', 'error'); return false; }

  if (config.heart_rate_enabled === 'true') {
    const minHR = parseInt(config.min_heart_rate, 10);
    const maxHR = parseInt(config.max_heart_rate, 10);
    if (minHR < 60 || minHR > 120) { showToast('Min Heart Rate must be between 60 and 120', 'error'); return false; }
    if (maxHR < 120 || maxHR > 200) { showToast('Max Heart Rate must be between 120 and 200', 'error'); return false; }
    if (minHR >= maxHR) { showToast('Min Heart Rate must be less than Max Heart Rate', 'error'); return false; }
  }

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
    min_heart_rate: document.getElementById('cfgMinHR').value,
    max_heart_rate: document.getElementById('cfgMaxHR').value,
    sim_weather: document.getElementById('cfgSimWeather')?.checked ? 'true' : 'false',
    sim_redlights: document.getElementById('cfgSimRedLights')?.checked ? 'true' : 'false',
  };

  if (!validateInputs(config)) return;

  await api('/config', { method: 'POST', body: config });
  showToast('Configuration saved!', 'success');
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
  const countMin = document.getElementById('scheduleCountMin').value;
  const countMax = document.getElementById('scheduleCountMax').value;
  
  if (parseInt(countMax) > 3 || parseInt(countMin) > 3) {
    showToast('VIP Required: Max 3 activities at once.', 'warning');
    document.getElementById('scheduleCountMax').value = Math.min(3, parseInt(countMax));
    document.getElementById('scheduleCountMin').value = Math.min(3, parseInt(countMin));
    return;
  }
  
  if (parseInt(countMin) > parseInt(countMax)) {
    showToast('Min Count must not exceed Max Count', 'error');
    return;
  }
  
  const status = await api('/scheduler', { method: 'POST', body: { enabled, time, countMin, countMax } });
  updateScheduleDisplay(status);
  showToast(enabled ? `Schedule enabled at ${time} (${countMin}-${countMax} acts)` : 'Schedule disabled', 'success');
}

// ─── Activities ─────────────────────────────────────────

let localCurrentPage = 1;
const LOCAL_PAGE_SIZE = 10;

async function loadActivities() {
  try {
    const allActivities = await api('/activities');
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
      const actualTime = a.route_start_time || a.created_at;
      const dateStr = actualTime.endsWith('Z') ? actualTime : actualTime + 'Z';
      const dateObj = new Date(dateStr);
      const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
      const dateOnlyStr = dateObj.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      
      let districtTags = '';
      if (a.district_keys) {
         const keys = a.district_keys.split(',');
         districtTags = keys.map(k => {
           const name = HANOI_DISTRICTS.find(d => d.key === k)?.name || k;
           return `<span class="status-badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid var(--border); padding: 2px 6px;">\ud83d\udccd ${name}</span>`;
         }).join('');
      }

      const statusClass = a.upload_status;
      return `
        <div class="activity-item">
          <div>
            <div class="activity-name">${a.activity_name || 'Unnamed'}</div>
            <div class="activity-date" style="display:flex; gap:6px; margin-top:4px; flex-wrap:wrap; align-items:center;">
               <span class="status-badge" style="background: rgba(59, 130, 246, 0.1); color: var(--accent-blue); padding: 2px 6px;">\u23f1\ufe0f ${timeStr} ${dateOnlyStr}</span>
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
            <button class="btn btn-sm btn-danger" style="padding:4px 8px;" onclick="deleteActivity(${a.id}, ${!!a.strava_activity_id})">\ud83d\uddd1\ufe0f</button>
          </div>
        </div>`;
    }).join('');
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

async function loadStravaActivities() {
  const container = document.getElementById('stravaActivityList');
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading...</p></div>';
  
  try {
    const range = document.getElementById('stravaFilterRange').value;
    let afterQuery = '';
    if (range !== 'total') {
      const now = new Date();
      let days = 30;
      if (range === '3_days') days = 3;
      else if (range === '5_days') days = 5;
      else if (range === '7_days') days = 7;
      else if (range === '1_month') days = 30;
      else if (range === '3_months') days = 90;
      
      const afterTimestamp = Math.floor((now.getTime() - days * 24 * 60 * 60 * 1000) / 1000);
      afterQuery = `&after=${afterTimestamp}`;
    }

    let activities = await api(`/strava-activities?page=${stravaCurrentPage}&per_page=10${afterQuery}`);
    document.getElementById('stravaPageInfo').textContent = `Page ${stravaCurrentPage}`;
    
    if (!activities || !activities.length) {
      container.innerHTML = '<div class="empty-state"><div class="icon">☁️</div><p>No activities found on Strava.</p></div>';
      return;
    }
    
    // Sort descending (latest first)
    activities.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
    
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
    work_start1: isCustomTime ? undefined : document.getElementById('cfgWorkStart1').value,
    work_end1: isCustomTime ? undefined : document.getElementById('cfgWorkEnd1').value,
    work_start2: isCustomTime ? undefined : document.getElementById('cfgWorkStart2').value,
    work_end2: isCustomTime ? undefined : document.getElementById('cfgWorkEnd2').value,
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
    min_heart_rate: document.getElementById('cfgMinHR').value,
    max_heart_rate: document.getElementById('cfgMaxHR').value,
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
    loadActivities();
    loadStats();
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
    loadActivities();
    loadStats();
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
      loadActivities();
      loadStats();
      loadStravaActivities();
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
  if (parseInt(el.value, 10) > 2) {
    showToast('Max 2 districts allowed. Contact Admin to upgrade.', 'warning');
    el.value = 2;
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
});
