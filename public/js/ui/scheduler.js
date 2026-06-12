async function loadSchedule() {
  try {
    const status = await api('/scheduler');
    const sysL = window.sysLimits;
    document.getElementById('scheduleEnabled').checked = status.enabled;
    document.getElementById('scheduleTime').value = status.scheduleTime || (sysL?.schedule_time?.default) || '22:00';
    
    const slot2 = document.getElementById('scheduleSlot2');
    const btnAdd = document.getElementById('btnAddSchedule');
    const isVip = window.userRole === 'vip';
    if (status.scheduleCount >= 2 && isVip) {
      slot2.style.display = 'block';
      btnAdd.style.display = 'none';
      document.getElementById('scheduleTime2').value = status.scheduleTime2 || (sysL?.schedule_time_2?.default) || '14:00';
    } else {
      slot2.style.display = 'none';
      btnAdd.style.display = 'block';
    }

    document.getElementById('scheduleCountMin').value = (status.scheduleCountMin !== undefined && status.scheduleCountMin !== null) ? status.scheduleCountMin : ((sysL?.schedule_count_min?.default) !== undefined ? sysL.schedule_count_min.default : 1);
    document.getElementById('scheduleCountMax').value = (status.scheduleCountMax !== undefined && status.scheduleCountMax !== null) ? status.scheduleCountMax : ((sysL?.schedule_count_max?.default) !== undefined ? sysL.schedule_count_max.default : 2);
    
    const targetDistEnabledInput = document.getElementById('cfgTargetDistanceEnabled');
    const targetDistKmInput = document.getElementById('cfgTargetDistanceKm');
    if (targetDistEnabledInput) targetDistEnabledInput.checked = !!status.targetDistanceEnabled;
    if (targetDistKmInput) targetDistKmInput.value = status.targetDistanceKm || (sysL?.target_distance_km?.default) || '10.0';
    toggleTargetDistanceInputs();

    updateScheduleDisplay(status);
    updateSchedulerBanner();
  } catch (err) { console.error('Schedule error:', err); }
}

function updateScheduleDisplay(status) {
  const display = document.getElementById('scheduleDisplay');
  if (status?.enabled) {
    display.style.display = 'flex';
    const timeDisplay = document.getElementById('scheduleTimeDisplay');
    const labelDisplay = display.querySelector('.schedule-label');

    if (status.customTimeEnabled) {
      let dateText = status.targetDate;
      if (dateText === 'Hôm nay') {
        dateText = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      }
      timeDisplay.textContent = `Pending (until ${dateText} ${status.targetTimeCustom})`;
      timeDisplay.style.background = 'none';
      timeDisplay.style.webkitTextFillColor = 'var(--vip-gold, #f59e0b)';
      timeDisplay.style.color = 'var(--vip-gold, #f59e0b)';
      timeDisplay.style.fontSize = '1.1rem';
      if (labelDisplay) {
        labelDisplay.textContent = 'Next auto-run is paused until custom time';
      }
    } else {
      let times = [];
      times.push(status.scheduleTime);
      if (status.scheduleCount >= 2) times.push(status.scheduleTime2);
      timeDisplay.textContent = times.join(' & ');
      timeDisplay.style.background = '';
      timeDisplay.style.webkitTextFillColor = '';
      timeDisplay.style.color = '';
      timeDisplay.style.fontSize = '';
      if (labelDisplay) {
        labelDisplay.textContent = 'Next auto-run (Asia/Ho_Chi_Minh)';
      }
    }
  } else {
    display.style.display = 'none';
  }
}

function toggleTargetDistanceInputs() {
  const enabledEl = document.getElementById('cfgTargetDistanceEnabled');
  const container = document.getElementById('targetDistanceInputs');
  if (!enabledEl || !container) return;

  const enabled = enabledEl.checked;
  if (enabled) {
    container.style.opacity = '1';
    container.style.pointerEvents = 'auto';
    container.querySelectorAll('input').forEach(i => i.disabled = false);
  } else {
    container.style.opacity = '0.5';
    container.style.pointerEvents = 'none';
    container.querySelectorAll('input').forEach(i => i.disabled = true);
  }
}

async function updateSchedule() {
  const enabled = document.getElementById('scheduleEnabled').checked;
  const time = document.getElementById('scheduleTime').value;
  
  let scheduleCount = document.getElementById('scheduleSlot2').style.display === 'block' ? 2 : 1;
  if (window.userRole !== 'vip' && scheduleCount > 1) {
    scheduleCount = 1;
    document.getElementById('scheduleSlot2').style.display = 'none';
    document.getElementById('btnAddSchedule').style.display = 'block';
  }
  const time2 = document.getElementById('scheduleTime2').value;

  const countMin = parseInt(document.getElementById('scheduleCountMin').value);
  const countMax = parseInt(document.getElementById('scheduleCountMax').value);
  
  if (countMin > (window.sysLimits?.schedule_count_min?.max || 2)) {
    showToast(`Số lượng tối thiểu không được vượt quá ${window.sysLimits.schedule_count_min.max}.`, 'warning');
    document.getElementById('scheduleCountMin').value = window.sysLimits.schedule_count_min.max;
    return;
  }
  
  if (countMax > (window.sysLimits?.schedule_count_max?.max || 3)) {
    showToast(`Tài khoản của bạn giới hạn tối đa ${window.sysLimits.schedule_count_max.max} hoạt động tự động.`, 'warning');
    document.getElementById('scheduleCountMax').value = window.sysLimits.schedule_count_max.max;
    return;
  }
  
  if (countMin > countMax) {
    showToast('Min Count must not exceed Max Count', 'error');
    return;
  }

  const targetDistanceEnabled = document.getElementById('cfgTargetDistanceEnabled')?.checked || false;
  const targetDistanceKm = parseFloat(document.getElementById('cfgTargetDistanceKm')?.value || '10.0');
  
  const status = await api('/scheduler', { method: 'POST', body: { enabled, time, scheduleCount, time2, countMin, countMax, targetDistanceEnabled, targetDistanceKm } });
  if (status.error) {
    showToast(status.error, 'error');
    return;
  }
  updateScheduleDisplay(status);
  
  let msg = '';
  if (!enabled) {
    msg = 'Schedule disabled';
  } else {
    let times = [time];
    if (scheduleCount >= 2) times.push(time2);
    msg = `Schedule enabled at ${times.join(' & ')} (${countMin}-${countMax} acts)`;
  }
  showToast(msg, 'success');
}

function updateSchedulerBanner() {
  const isVip = window.userRole === 'vip';
  const limitDays = isVip ? 7 : 3;
  const bannerEl = document.getElementById('customTimeLimitBanner');
  const textEl = document.getElementById('customTimeLimitText');
  if (bannerEl && textEl) {
    textEl.textContent = `Custom Time: Hỗ trợ đặt lịch trước tối đa ${limitDays} ngày trong tương lai.`;
    bannerEl.style.display = 'flex';
  }
}

// Export to window
window.loadSchedule = loadSchedule;
window.updateScheduleDisplay = updateScheduleDisplay;
window.toggleTargetDistanceInputs = toggleTargetDistanceInputs;
window.updateSchedule = updateSchedule;
window.updateSchedulerBanner = updateSchedulerBanner;
