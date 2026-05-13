/**
 * StrAct Z - Scheduler Controls Logic
 */

async function loadSchedule() {
  try {
    const status = await api('/scheduler');
    document.getElementById('scheduleEnabled').checked = status.enabled;
    document.getElementById('scheduleTime').value = status.scheduleTime || '22:00';
    
    const slot2 = document.getElementById('scheduleSlot2');
    const btnAdd = document.getElementById('btnAddSchedule');
    if (status.enabled2) {
      slot2.style.display = 'block';
      btnAdd.style.display = 'none';
      document.getElementById('scheduleTime2').value = status.scheduleTime2 || '06:00';
    } else {
      slot2.style.display = 'none';
      btnAdd.style.display = 'block';
    }

    document.getElementById('scheduleCountMin').value = (status.scheduleCountMin !== undefined && status.scheduleCountMin !== null) ? status.scheduleCountMin : 1;
    document.getElementById('scheduleCountMax').value = (status.scheduleCountMax !== undefined && status.scheduleCountMax !== null) ? status.scheduleCountMax : 2;
    updateScheduleDisplay(status);
  } catch (err) { console.error('Schedule error:', err); }
}

function updateScheduleDisplay(status) {
  const display = document.getElementById('scheduleDisplay');
  if (status?.enabled || status?.enabled2) {
    display.style.display = 'flex';
    let times = [];
    if (status.enabled) times.push(status.scheduleTime);
    if (status.enabled2) times.push(status.scheduleTime2);
    document.getElementById('scheduleTimeDisplay').textContent = times.join(' & ');
  } else {
    display.style.display = 'none';
  }
}

async function updateSchedule() {
  const enabled = document.getElementById('scheduleEnabled').checked;
  const time = document.getElementById('scheduleTime').value;
  
  const enabled2 = document.getElementById('scheduleSlot2').style.display === 'block';
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
  
  const status = await api('/scheduler', { method: 'POST', body: { enabled, time, enabled2, time2, countMin, countMax } });
  if (status.error) {
    showToast(status.error, 'error');
    return;
  }
  updateScheduleDisplay(status);
  showToast('Schedule updated successfully', 'success');
}

// Export to window
window.loadSchedule = loadSchedule;
window.updateScheduleDisplay = updateScheduleDisplay;
window.updateSchedule = updateSchedule;
