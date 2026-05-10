/**
 * StrAct Z - Scheduler Controls Logic
 */

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
  
  if (countMin > window.sysLimits.schedule_count_min.max) {
    showToast(`Số lượng tối thiểu không được vượt quá ${window.sysLimits.schedule_count_min.max}.`, 'warning');
    document.getElementById('scheduleCountMin').value = window.sysLimits.schedule_count_min.max;
    return;
  }
  
  if (countMax > window.sysLimits.schedule_count_max.max) {
    showToast(`Tài khoản của bạn giới hạn tối đa ${window.sysLimits.schedule_count_max.max} hoạt động tự động.`, 'warning');
    document.getElementById('scheduleCountMax').value = window.sysLimits.schedule_count_max.max;
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

// Export to window
window.loadSchedule = loadSchedule;
window.updateScheduleDisplay = updateScheduleDisplay;
window.updateSchedule = updateSchedule;
