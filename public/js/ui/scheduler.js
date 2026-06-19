async function loadSchedule() {
  try {
    const status = await api('/scheduler');
    window.lastSavedScheduleStatus = status;
    const sysL = window.sysLimits;
    document.getElementById('scheduleEnabled').checked = status.enabled;
    document.getElementById('scheduleTime').value = status.scheduleTime || (sysL?.schedule_time?.default) || '22:00';
    
    const limitToggle = document.getElementById('cfgLimitScheduleTimeWindow');
    if (limitToggle) {
      limitToggle.checked = status.limitScheduleTimeWindow !== false;
    }

    const slot2 = document.getElementById('scheduleSlot2');
    const slot3 = document.getElementById('scheduleSlot3');
    const isVip = window.userRole === 'vip';
    
    document.getElementById('scheduleTime2').value = status.scheduleTime2 || (sysL?.schedule_time_2?.default) || '14:00';
    if (document.getElementById('scheduleTime3')) {
      document.getElementById('scheduleTime3').value = status.scheduleTime3 || (sysL?.schedule_time_3?.default) || '06:00';
    }

    if (status.scheduleCount === 2) {
      slot2.style.display = 'block';
      slot3.style.display = 'none';
    } else if (status.scheduleCount >= 3 && isVip) {
      slot2.style.display = 'block';
      slot3.style.display = 'block';
    } else {
      slot2.style.display = 'none';
      slot3.style.display = 'none';
    }
    updateAddButtonVisibility();

    document.getElementById('scheduleCountMin').value = (status.scheduleCountMin !== undefined && status.scheduleCountMin !== null) ? status.scheduleCountMin : ((sysL?.schedule_count_min?.default) !== undefined ? sysL.schedule_count_min.default : 1);
    document.getElementById('scheduleCountMax').value = (status.scheduleCountMax !== undefined && status.scheduleCountMax !== null) ? status.scheduleCountMax : ((sysL?.schedule_count_max?.default) !== undefined ? sysL.schedule_count_max.default : 2);
    
    const targetDistEnabledInput = document.getElementById('cfgTargetDistanceEnabled');
    const targetDistKmInput = document.getElementById('cfgTargetDistanceKm');
    if (targetDistEnabledInput) targetDistEnabledInput.checked = !!status.targetDistanceEnabled;
    if (targetDistKmInput) targetDistKmInput.value = status.targetDistanceKm || (sysL?.target_distance_km?.default) || '10.0';
    toggleTargetDistanceInputs();

    updateScheduleDisplay(status);
    updateSchedulerBanner();
    
    // Attach listeners once
    if (!window.scheduleListenersAttached) {
      attachScheduleRealTimeListeners();
      window.scheduleListenersAttached = true;
    }
  } catch (err) { console.error('Schedule error:', err); }
}

function updateScheduleDisplay(status) {
  const display = document.getElementById('scheduleDisplay');
  if (status?.enabled) {
    display.style.display = 'flex';
    const timeDisplay = document.getElementById('scheduleTimeDisplay');
    const labelDisplay = display.querySelector('.schedule-label');

    if (status.customTimeEnabled && status.customTimePending) {
      const dateText = status.targetDate;
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
      if (status.scheduleCount >= 3) times.push(status.scheduleTime3);
      const parseHM = (t) => {
        const [h, m] = (t || '00:00').split(':').map(Number);
        return h * 60 + m;
      };
      times.sort((a, b) => parseHM(a) - parseHM(b));
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

async function updateSchedule(showToastOnSuccess = true) {
  const enabled = document.getElementById('scheduleEnabled').checked;
  const time = document.getElementById('scheduleTime').value;
  
  const slot2Visible = document.getElementById('scheduleSlot2').style.display === 'block';
  const slot3Visible = document.getElementById('scheduleSlot3').style.display === 'block';
  
  let scheduleCount = 1;
  if (slot2Visible) scheduleCount = 2;
  if (slot3Visible && window.userRole === 'vip') scheduleCount = 3;

  const maxAllowed = window.userRole === 'vip' ? 3 : 2;
  if (scheduleCount > maxAllowed) {
    scheduleCount = maxAllowed;
  }
  
  const time2 = document.getElementById('scheduleTime2').value;
  const time3 = document.getElementById('scheduleTime3')?.value || '06:00';
  const limitScheduleTimeWindow = document.getElementById('cfgLimitScheduleTimeWindow')?.checked !== false;

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
  
  const status = await api('/scheduler', { 
    method: 'POST', 
    body: { 
      enabled, 
      time, 
      scheduleCount, 
      time2, 
      time3, 
      limitScheduleTimeWindow, 
      countMin, 
      countMax, 
      targetDistanceEnabled, 
      targetDistanceKm 
    } 
  });
  if (status.error) {
    showToast(status.error, 'error');
    return;
  }
  window.lastSavedScheduleStatus = status;
  updateScheduleDisplay(status);
  
  if (showToastOnSuccess) {
    let msg = '';
    if (!enabled) {
      msg = 'Auto schedule disabled';
    } else {
      let times = [time];
      if (scheduleCount >= 2) times.push(time2);
      if (scheduleCount >= 3) times.push(time3);
      const parseHM = (t) => {
        const [h, m] = (t || '00:00').split(':').map(Number);
        return h * 60 + m;
      };
      times.sort((a, b) => parseHM(a) - parseHM(b));
      msg = `Auto schedule saved and enabled at ${times.join(' & ')} (${countMin}-${countMax} acts)`;
    }
    showToast(msg, 'success');
  } else {
    showToast(enabled ? 'Auto schedule enabled' : 'Auto schedule disabled', 'success');
  }
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

function refreshScheduleDisplayFromUI() {
  const enabled = document.getElementById('scheduleEnabled')?.checked || false;
  const customTimeEnabled = window.lastSavedScheduleStatus?.customTimeEnabled || false;
  const targetDate = window.lastSavedScheduleStatus?.targetDate || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  const targetTimeCustom = window.lastSavedScheduleStatus?.targetTimeCustom || '00:00';
  
  const scheduleTime = document.getElementById('scheduleTime')?.value || '22:00';
  const scheduleTime2 = document.getElementById('scheduleTime2')?.value || '14:00';
  const scheduleTime3 = document.getElementById('scheduleTime3')?.value || '06:00';
  
  const slot2Visible = document.getElementById('scheduleSlot2')?.style.display === 'block';
  const slot3Visible = document.getElementById('scheduleSlot3')?.style.display === 'block';
  
  let scheduleCount = 1;
  if (slot2Visible) scheduleCount = 2;
  if (slot3Visible && window.userRole === 'vip') scheduleCount = 3;
  
  const dateText = targetDate;
  const customStartMs = new Date(`${dateText}T${targetTimeCustom}:00.000+07:00`).getTime();
  const nowMs = Date.now();
  const customTimePending = customTimeEnabled && (nowMs < customStartMs);
  
  const status = {
    enabled,
    customTimeEnabled,
    targetDate,
    targetTimeCustom,
    customTimePending,
    scheduleTime,
    scheduleTime2,
    scheduleTime3,
    scheduleCount
  };
  
  updateScheduleDisplay(status);
}

function attachScheduleRealTimeListeners() {
  const inputs = [
    'scheduleTime', 'scheduleTime2', 'scheduleTime3', 'scheduleCountMin', 'scheduleCountMax',
    'cfgTargetDistanceEnabled', 'cfgTargetDistanceKm', 'cfgLimitScheduleTimeWindow'
  ];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const update = () => {
      refreshScheduleDisplayFromUI();
    };
    el.addEventListener('input', update);
    el.addEventListener('change', update);
  });
}

function addScheduleSlot() {
  const slot2 = document.getElementById('scheduleSlot2');
  const slot3 = document.getElementById('scheduleSlot3');
  
  if (slot2.style.display === 'none') {
    slot2.style.display = 'block';
  } else if (slot3.style.display === 'none') {
    if (window.userRole !== 'vip') {
      showToast('Khung giờ thứ 3 chỉ dành cho tài khoản VIP.', 'warning');
      return;
    }
    slot3.style.display = 'block';
  }
  
  updateAddButtonVisibility();
  refreshScheduleDisplayFromUI();
}

function removeScheduleSlot(slotNum) {
  if (slotNum === 2) {
    const slot2 = document.getElementById('scheduleSlot2');
    const slot3 = document.getElementById('scheduleSlot3');
    if (slot3.style.display === 'block') {
      // Shift slot 3 value to slot 2 and hide slot 3
      document.getElementById('scheduleTime2').value = document.getElementById('scheduleTime3').value;
      slot3.style.display = 'none';
    } else {
      slot2.style.display = 'none';
    }
  } else if (slotNum === 3) {
    document.getElementById('scheduleSlot3').style.display = 'none';
  }
  
  updateAddButtonVisibility();
  refreshScheduleDisplayFromUI();
}

function updateAddButtonVisibility() {
  const slot2Visible = document.getElementById('scheduleSlot2').style.display === 'block';
  const slot3Visible = document.getElementById('scheduleSlot3').style.display === 'block';
  const btnAdd = document.getElementById('btnAddSchedule');
  const maxAllowed = window.userRole === 'vip' ? 3 : 2;
  
  let currentCount = 1;
  if (slot2Visible) currentCount++;
  if (slot3Visible) currentCount++;
  
  if (currentCount < maxAllowed) {
    btnAdd.style.display = 'block';
  } else {
    btnAdd.style.display = 'none';
  }
}

// Export to window
window.loadSchedule = loadSchedule;
window.updateScheduleDisplay = updateScheduleDisplay;
window.toggleTargetDistanceInputs = toggleTargetDistanceInputs;
window.updateSchedule = updateSchedule;
window.updateSchedulerBanner = updateSchedulerBanner;
window.refreshScheduleDisplayFromUI = refreshScheduleDisplayFromUI;
window.attachScheduleRealTimeListeners = attachScheduleRealTimeListeners;
window.addScheduleSlot = addScheduleSlot;
window.removeScheduleSlot = removeScheduleSlot;
window.updateAddButtonVisibility = updateAddButtonVisibility;
