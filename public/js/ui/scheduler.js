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
  
  if (countMax > window.sysLimits.schedule_count_max.max) {
    showToast(`Your account is limited to ${window.sysLimits.schedule_count_max.max} daily scheduled activities.`, 'warning');
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
