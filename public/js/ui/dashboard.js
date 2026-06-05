/**
 * StrAct Z - Dashboard, Stats, and Activities
 */

async function loadDashboard(forceRefresh = false) {
  window.latestStravaActivities = []; // Store for cross-check
  window.allCloudActivities = [];     // Store for robust cross-check (insights)
  await fetchLimits();
  await loadDistricts();
  await Promise.all([
    loadStats(forceRefresh),
    loadConfig(),
    loadSchedule(),
    loadStravaActivities(forceRefresh), // Load Strava first for cross-check
    loadInsights(forceRefresh)
  ]);
  
  // loadActivities depends on latestStravaActivities
  await loadActivities();

  if (forceRefresh) {
    showToast('All data refreshed!', 'success');
  }
  
  initMap();
  resetMapView();
  
  // Log district weight ratios on page load/refresh
  if (window.debugDistrictWeightRatios) {
    window.debugDistrictWeightRatios();
  }
}

async function loadStats(forceRefresh = false) {
  try {
    const stats = await api('/stats');
    window.userRole = stats.role || 'normal';
    if (window.userRole === 'vip') {
      document.body.classList.add('is-vip');
      document.body.classList.remove('is-normal');
    } else {
      document.body.classList.add('is-normal');
      document.body.classList.remove('is-vip');
    }
    // Sync Leaflet map colors (hardcoded inline styles don't respond to CSS vars)
    if (window.updateDistrictHighlights) window.updateDistrictHighlights();

    const authText = document.getElementById('authText');
    if (authText) {
      const currentName = authText.textContent.replace(' VIP', '').trim();
      const vipTag = window.userRole === 'vip' ? ' <span class="vip-badge-inline" style="color:var(--vip-gold); font-size:0.7rem; font-weight:800; border:1px solid var(--vip-gold); padding:1px 6px; border-radius:4px; margin-left:6px; background:rgba(245,158,11,0.1);">VIP</span>' : '';
      authText.innerHTML = currentName + vipTag;
    }
    
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statUploaded').textContent = stats.uploaded;
    document.getElementById('statDistance').textContent = stats.totalDistanceKm;
    document.getElementById('statDuration').textContent = stats.totalDurationMin;

    // Google Fit connection state
    const gfDisc = document.getElementById('gfDisconnected');
    const gfConn = document.getElementById('gfConnected');
    if (gfDisc && gfConn) {
      if (stats.googleFitConnected) {
        gfDisc.style.display = 'none';
        gfConn.style.display = 'block';
        if (window.refreshGoogleFitStats) {
          window.refreshGoogleFitStats(forceRefresh);
        }
      } else {
        gfDisc.style.display = 'block';
        gfConn.style.display = 'none';
      }
    }

    const vipArea = document.getElementById('vipActivationArea');
    if (vipArea) {
      if (window.userRole === 'vip') {
        vipArea.innerHTML = `
          <div style="padding: 12px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; text-align: center;">
            <div style="color: #f59e0b; font-weight: 600; font-size: 0.9rem;">✨ VIP Account Active!</div>
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

async function loadDistricts() {
  try {
    window.sysDistricts = await api('/districts');
  } catch (err) {
    console.error('Failed to load districts:', err);
  }
}

async function loadActivities() {
  try {
    const allActivities = await api('/activities?limit=10000');
    const container = document.getElementById('activityList');
    
    if (!allActivities || allActivities.error || !Array.isArray(allActivities)) {
      console.error('Failed to load local activities:', allActivities?.error || 'Invalid API response');
      if (container) {
        container.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>Failed to load activities: ${allActivities?.error || 'Invalid response format'}</p></div>`;
      }
      return;
    }
    
    // Use window.allCloudActivities (from insights, up to 200 acts) as primary source for cross-check
    // Fallback to latestStravaActivities if allCloudActivities is empty
    const rawCloudBuffer = (window.allCloudActivities && Array.isArray(window.allCloudActivities) && window.allCloudActivities.length > 0) 
      ? window.allCloudActivities 
      : (Array.isArray(window.latestStravaActivities) ? window.latestStravaActivities : []);
    const cloudBuffer = Array.isArray(rawCloudBuffer) ? rawCloudBuffer : [];

    // 1. Detect oldest cloud time to handle out-of-range vs removed activities safely
    let oldestCloudTime = Date.now();
    if (cloudBuffer.length > 0) {
      cloudBuffer.forEach(s => {
        const sTime = new Date(s.start_date || s.created_at).getTime();
        if (sTime < oldestCloudTime) oldestCloudTime = sTime;
      });
    }

    // 2. Time Filtering
    const range = document.getElementById('historyFilterRange')?.value || '7_days';
    let filteredActivities = allActivities;
    if (range !== 'total') {
      let days = 7;
      if (range === '3_days') days = 3;
      else if (range === '5_days') days = 5;
      else if (range === '7_days') days = 7;
      else if (range === '14_days') days = 14;
      else if (range === '30_days') days = 30;
      else if (range === '90_days') days = 90;

      const cutoff = new Date();
      cutoff.setHours(0, 0, 0, 0);
      cutoff.setDate(cutoff.getDate() - (days - 1));
      
      filteredActivities = allActivities.filter(a => {
        const actualTime = a.route_start_time || a.created_at;
        const dateStr = actualTime.endsWith('Z') ? actualTime : actualTime + 'Z';
        return new Date(dateStr) >= cutoff;
      });
    }

    const total = filteredActivities.length;
    const totalPages = Math.max(1, Math.ceil(total / window.LOCAL_PAGE_SIZE));
    
    if (window.localCurrentPage > totalPages) window.localCurrentPage = totalPages;
    if (window.localCurrentPage < 1) window.localCurrentPage = 1;
    
    document.getElementById('historyCount').textContent = `${total} activities`;
    document.getElementById('localPageInfo').textContent = `Page ${window.localCurrentPage}/${totalPages}`;

    if (!total) {
      container.innerHTML = '<div class="empty-state"><div class="icon">\ud83c\udfc3</div><p>No activities in this range. Try changing the filter!</p></div>';
      return;
    }

    const start = (window.localCurrentPage - 1) * window.LOCAL_PAGE_SIZE;
    const pageActivities = filteredActivities.slice(start, start + window.LOCAL_PAGE_SIZE);

    container.innerHTML = pageActivities.map(a => {
      const actualTime = a.route_start_time || a.created_at;
      const dateStr = actualTime.endsWith('Z') ? actualTime : actualTime + 'Z';
      const dateObj = new Date(dateStr);
      const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
      const dateOnlyStr = dateObj.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      
      let districtTags = '';
      if (a.district_keys) {
         const keys = a.district_keys.split(',');
          districtTags = keys.map(k => {
            const name = window.sysDistricts.find(d => d.key === k)?.name || k;
            return `<span class="status-badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid var(--border); padding: 2px 6px;">📍 ${name}</span>`;
          }).join('');
      }

      const isUploadedLocal = (a.upload_status === 'uploaded' || !!a.strava_activity_id);
      const stravaRecord = isUploadedLocal ? cloudBuffer.find(s => String(s.id) === String(a.strava_activity_id)) : null;
      
      let badge = '';
      let showViewBtn = false;
      
      if (isUploadedLocal) {
        if (cloudBuffer.length > 0 && !stravaRecord && dateObj.getTime() >= oldestCloudTime) {
          badge = `<span class="status-badge removed" title="Đã tạo local và upload lên cloud, sau đó xóa ở cloud">⚪ REMOVED</span>`;
        } else {
          badge = `<span class="status-badge uploaded" title="Đã tạo local và upload lên cloud">🟢 UPLOADED</span>`;
          showViewBtn = true;
        }
      } else {
        if (a.upload_status === 'failed') {
          badge = `<span class="status-badge failed" title="${a.error_message || 'Không thể tạo hoạt động'}">❌ FAILED</span>`;
        } else if (a.deleted_at || a.upload_status === 'deleted') {
          badge = `<span class="status-badge deleted" title="Đã tạo local và chưa upload, sau đó xóa ở local">🔴 DELETED</span>`;
        } else {
          badge = `<span class="status-badge generated" title="Đã tạo local và chưa upload">🟡 GENERATED</span>`;
        }
      }

      return `
        <div class="activity-item">
          <div>
            <div class="activity-name">${a.activity_name || 'Unnamed'}</div>
            <div class="activity-date" style="display:flex; gap:6px; margin-top:4px; flex-wrap:wrap; align-items:center;">
               <span class="status-badge" style="background: rgba(59, 130, 246, 0.1); color: var(--accent-blue); padding: 2px 6px;">🕒 ${timeStr} ${dateOnlyStr}</span>
               ${districtTags}
               ${a.created_by ? `<span class="status-badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid var(--border); padding: 2px 6px;">${a.created_by}</span>` : ''}
            </div>
          </div>
          <div class="activity-meta">${a.distance_km?.toFixed(1)} km</div>
          <div class="activity-meta">${a.duration_min?.toFixed(0)} min</div>
          <div class="activity-meta">${a.pace_min_km?.toFixed(1)} min/km</div>
          <div style="display:flex;gap:6px;align-items:center; flex-wrap: wrap; justify-content: flex-end;">
            ${badge}
            
            <div style="display:flex; gap:6px; margin-left: 10px;">
              ${(a.upload_status === 'generated' && !a.deleted_at) ? `<button class="btn btn-sm btn-primary" onclick="uploadActivity(${a.id})">Upload</button>` : ''}
              ${showViewBtn ? `<a href="https://www.strava.com/activities/${a.strava_activity_id}" target="_blank" class="btn btn-sm btn-secondary">View</a>` : ''}
              ${(a.upload_status === 'generated' && !a.deleted_at) ? 
                `<button class="btn btn-sm btn-danger" style="padding:4px 8px;" title="Delete locally" onclick="deleteActivity(${a.id}, false)">🗑️</button>` : 
                `<span class="tooltip-icon tooltip-left" data-tooltip="Hoạt động đã upload chỉ có thể xóa trực tiếp trên Strava.com. Sau khi xóa trên Strava, hãy Refresh Cloud Data để cập nhật trạng thái tại đây.">?</span>`
              }
            </div>
          </div>
        </div>`;
    }).join('');

    const prevBtn = document.querySelector('button[onclick="changeLocalPage(-1)"]');
    const nextBtn = document.querySelector('button[onclick="changeLocalPage(1)"]');
    if (prevBtn) {
      prevBtn.disabled = window.localCurrentPage <= 1;
      prevBtn.style.opacity = window.localCurrentPage <= 1 ? '0.4' : '1';
      prevBtn.style.cursor = window.localCurrentPage <= 1 ? 'not-allowed' : 'pointer';
    }
    if (nextBtn) {
      nextBtn.disabled = window.localCurrentPage >= totalPages;
      nextBtn.style.opacity = window.localCurrentPage >= totalPages ? '0.4' : '1';
      nextBtn.style.cursor = window.localCurrentPage >= totalPages ? 'not-allowed' : 'pointer';
    }
  } catch (err) { console.error('Activities error:', err); }
}

function onHistoryFilterChange() {
  window.localCurrentPage = 1;
  loadActivities();
}

function changeLocalPage(delta) {
  window.localCurrentPage += delta;
  if (window.localCurrentPage < 1) window.localCurrentPage = 1;
  loadActivities();
}

function onStravaFilterChange() {
  window.stravaCurrentPage = 1;
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

      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (days - 1));
      afterQuery = `&after=${Math.floor(d.getTime() / 1000)}`;
    }

    const refreshQuery = forceRefresh ? '&refresh=true' : '';
    let activities = await api(`/strava-activities?page=${window.stravaCurrentPage}&per_page=10${afterQuery}${refreshQuery}`);
    
    if (!activities || activities.error) {
      window.latestStravaActivities = [];
      loadActivities();
      container.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>Failed to load Strava activities: ${activities?.error || 'Unknown error'}</p></div>`;
      return;
    }
    
    // Store latest for cross-check (flatten if paginated, but for now we just take the current page view)
    // Actually, to be accurate we might need to know if the ID is missing across all pages.
    // But per user request, we'll map against what's loaded.
    window.latestStravaActivities = activities || [];
    
    // Update Local History to reflect Strava status
    loadActivities();

    document.getElementById('stravaPageInfo').textContent = `Page ${window.stravaCurrentPage}`;
    
    if (!activities.length) {
      container.innerHTML = '<div class="empty-state"><div class="icon">☁️</div><p>No activities found on Strava.</p></div>';
      return;
    }
    
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

    const prevBtn = document.querySelector('button[onclick="changeStravaPage(-1)"]');
    const nextBtn = document.querySelector('button[onclick="changeStravaPage(1)"]');
    if (prevBtn) {
      prevBtn.disabled = window.stravaCurrentPage <= 1;
      prevBtn.style.opacity = window.stravaCurrentPage <= 1 ? '0.4' : '1';
      prevBtn.style.cursor = window.stravaCurrentPage <= 1 ? 'not-allowed' : 'pointer';
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
  if (window.stravaCurrentPage + delta < 1) return;
  window.stravaCurrentPage += delta;
  loadStravaActivities();
}

async function loadInsights(forceRefresh = false) {
  const range = document.getElementById('insightsTimeRange').value || 14;
  try {
    const refreshQuery = forceRefresh ? '&refresh=true' : '';
    const activities = await api(`/insights?days=${range}${refreshQuery}`);
    
    if (!activities || activities.error) {
      window.allCloudActivities = [];
      updateActivityChart([], parseInt(range));
      console.warn('Insights error:', activities?.error);
      return;
    }

    window.allCloudActivities = activities || []; // Store for cross-check in loadActivities
    updateActivityChart(activities, parseInt(range));
  } catch (err) {
    console.error('Insights error:', err);
  }
}

function updateActivityChart(activities, days = 14) {
  const ctx = document.getElementById('activityChart');
  if (!ctx) return;

  const cleanActivities = Array.isArray(activities) ? activities : [];

  const rangeDays = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    rangeDays.push(d.toLocaleDateString('en-CA'));
  }

  const activitiesByDate = {};
  rangeDays.forEach(date => {
    activitiesByDate[date] = cleanActivities.filter(a => {
      const startDate = a.start_date || a.created_at;
      if (!startDate) return false;
      const localDate = new Date(startDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      return localDate === date;
    });
  });

  const maxDailyCount = Math.max(...rangeDays.map(d => activitiesByDate[d].length), 1);

  const barDatasets = [];
  for (let i = 0; i < maxDailyCount; i++) {
    const data = [];
    const backgroundColors = [];
    const borderColors = [];

    rangeDays.forEach(date => {
      const dayActs = activitiesByDate[date] || [];
      if (dayActs.length > i) {
        data.push(1);
        const act = dayActs[i];
        if (act && act.is_stract_z) {
          backgroundColors.push('rgba(252, 76, 2, 0.35)');
          borderColors.push('rgba(252, 76, 2, 1)');
        } else {
          backgroundColors.push('rgba(139, 92, 246, 0.35)');
          borderColors.push('rgba(139, 92, 246, 1)');
        }
      } else {
        data.push(0);
        backgroundColors.push('rgba(252, 76, 2, 0.35)');
        borderColors.push('rgba(252, 76, 2, 1)');
      }
    });

    barDatasets.push({
      type: 'bar',
      label: `Activity Slot ${i + 1}`,
      data: data,
      backgroundColor: backgroundColors,
      borderColor: borderColors,
      borderWidth: 1,
      borderRadius: 2,
      stack: 'activities_stack',
      yAxisID: 'y2',
      barPercentage: 0.5
    });
  }

  const dailyDist = rangeDays.map(date => {
    return activitiesByDate[date].reduce((sum, a) => sum + (a.distance / 1000 || a.distance_km || 0), 0);
  });

  if (window.activityChart) {
    window.activityChart.destroy();
  }

  window.activityChart = new Chart(ctx, {
    data: {
      labels: rangeDays.map(d => d.split('-').slice(1).reverse().join('/')),
      datasets: [
        {
          type: 'bar',
          label: 'StrAct Z',
          data: [],
          backgroundColor: 'rgba(252, 76, 2, 0.35)',
          borderColor: 'rgba(252, 76, 2, 1)',
          borderWidth: 1
        },
        {
          type: 'bar',
          label: 'Strava Cloud',
          data: [],
          backgroundColor: 'rgba(139, 92, 246, 0.35)',
          borderColor: 'rgba(139, 92, 246, 1)',
          borderWidth: 1
        },
        ...barDatasets,
        {
          type: 'line',
          label: 'Distance (km)',
          data: dailyDist,
          backgroundColor: 'rgba(234, 179, 8, 0.05)',
          borderColor: 'rgba(234, 179, 8, 1)',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: false,
          yAxisID: 'y',
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
          title: { display: true, text: 'km', color: 'rgba(234, 179, 8, 0.8)', font: { size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 } }
        },
        y2: {
          type: 'linear',
          display: false,
          stacked: true,
          beginAtZero: true
        },
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 } }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'rgba(255, 255, 255, 0.6)',
            font: { size: 10 },
            boxWidth: 12,
            filter: (item) => !item.text.includes('Slot')
          }
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
            label: (context) => {
              const label = context.dataset.label;
              const val = context.parsed.y;
              if (label.includes('Distance')) return `${label}: ${val.toFixed(1)} km`;
              if (label.includes('StrAct Z') || label.includes('Strava Cloud') || label.includes('Slot')) {
                if (label === 'Activity Slot 1') {
                  const idx = context.dataIndex;
                  const date = rangeDays[idx];
                  const totalActs = activitiesByDate[date].length;
                  const dayActs = activitiesByDate[date] || [];
                  const stractZCount = dayActs.filter(a => a.is_stract_z).length;
                  const cloudCount = dayActs.length - stractZCount;
                  return `Activities: ${totalActs} (StrAct Z: ${stractZCount}, Cloud: ${cloudCount})`;
                }
                return null;
              }
              return `${label}: ${val}`;
            }
          }
        }
      }
    }
  });
}

function toggleThemePreview() {
  const btn = document.getElementById('btnThemeToggle');
  
  if (window.userRole === 'vip') {
    const isNormal = document.body.classList.toggle('theme-preview-normal');
    if (isNormal) {
      document.body.classList.add('is-normal');
      document.body.classList.remove('is-vip');
    } else {
      document.body.classList.remove('is-normal');
      document.body.classList.add('is-vip');
    }
    localStorage.setItem('stractz_theme_preview', isNormal ? 'normal' : 'vip');
    if (btn) btn.innerHTML = isNormal ? '✨ Restore VIP Gold Theme' : '👁️ Preview Normal Theme';
    showToast(isNormal ? 'Switched to Normal Theme (Preview)' : 'Restored VIP Gold Theme', 'success');
  } else {
    const isVipPreview = document.body.classList.toggle('is-vip');
    document.body.classList.toggle('is-normal', !isVipPreview);
    if (btn) btn.innerHTML = isVipPreview ? '🔙 Switch Back to Normal' : '👁️ Preview VIP Gold Theme';
    showToast(isVipPreview ? 'Previewing VIP Gold Theme' : 'Switched back to Normal Theme', 'info');
  }
  // Sync Leaflet map polygon colors after theme switch
  if (window.updateDistrictHighlights) window.updateDistrictHighlights();
}

async function initTheme() {
  try {
    const stats = await api('/stats').catch(() => ({ role: 'normal' }));
    if (stats.role === 'vip') {
      if (localStorage.getItem('stractz_theme_preview') === 'normal') {
        document.body.classList.add('is-normal');
        document.body.classList.add('theme-preview-normal');
      } else {
        document.body.classList.add('is-vip');
      }
    } else {
      document.body.classList.add('is-normal');
    }
    // Ensure map polygon colors reflect the correct theme
    if (window.updateDistrictHighlights) window.updateDistrictHighlights();
  } catch (e) {
    document.body.classList.add('is-normal');
  }
}

// ─── Actions (Moved here for proximity to activities) ───

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
    } else if (result.code === 'NO_VALID_TIME_SLOT') {
      showToast('⏰ ' + result.error, 'warning');
      loadActivities(); // Show the failed record
    } else {
      showToast(result.error || 'Generation failed', 'error');
    }
  } catch (err) {
    if (err.status === 409) {
      showToast('⏰ Không còn khung giờ hợp lệ trong ngày hôm nay. Kiểm tra lại cài đặt Avoid Workhours.', 'warning');
      loadActivities();
    } else {
      showToast('Generation failed: ' + err.message, 'error');
    }
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
    } else if (result.code === 'NO_VALID_TIME_SLOT') {
      showToast('⏰ ' + result.error, 'warning');
    } else {
      if (result.message === 'VIP_REQUIRED') {
        showToast('Daily limit reached (2 activities/day). Contact Admin to upgrade.', 'warning');
      } else {
        showToast(result.error || result.message || 'Upload failed', 'error');
      }
    }
    await loadDashboard(true);
  } catch (err) {
    if (err.status === 409) {
      showToast('⏰ Không còn khung giờ hợp lệ trong ngày hôm nay. Kiểm tra lại cài đặt Avoid Workhours.', 'warning');
      await loadDashboard(true);
    } else {
      showToast('Failed: ' + err.message, 'error');
    }
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

async function debugDistrictWeightRatios() {
  try {
    const config = await api('/config');
    const allActivities = await api('/activities?limit=200');
    const districts = window.sysDistricts || await api('/districts');
    if (!districts || districts.length === 0) return;

    const allowedDistricts = config.selected_districts 
      ? config.selected_districts.split(',').filter(Boolean) 
      : districts.map(d => d.key);

    const areas = config.activity_areas ? JSON.parse(config.activity_areas) : [];
    
    // Find last uploaded/removed activity for adjacent boost
    const lastUploaded = allActivities.find(a => a.upload_status === 'uploaded' || a.upload_status === 'removed');
    const lastDistrictKeys = lastUploaded ? lastUploaded.district_keys : null;
    const boostAdjacent = config.boost_adjacent !== 'false';

    const EARTH_RADIUS = 6371000;
    const toRad = deg => deg * Math.PI / 180;
    const haversineDistance = (lat1, lng1, lat2, lng2) => {
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    
    const getCircleIntersectionArea = (r1, r2, d) => {
      if (d >= r1 + r2) return 0;
      if (d <= Math.abs(r1 - r2)) return Math.PI * Math.pow(Math.min(r1, r2), 2);
      const r1Sq = r1 * r1;
      const r2Sq = r2 * r2;
      const dSq = d * d;
      const a1 = r1Sq * Math.acos((dSq + r1Sq - r2Sq) / (2 * d * r1));
      const a2 = r2Sq * Math.acos((dSq + r2Sq - r1Sq) / (2 * d * r2));
      const p = (r1 + r2 + d) / 2;
      const triangleArea = 2 * Math.sqrt(p * (p - r1) * (p - r2) * (p - d));
      return a1 + a2 - triangleArea;
    };

    const ADJACENT_DISTRICTS = {
      'hoan_kiem': ['ba_dinh', 'hai_ba_trung', 'dong_da', 'long_bien'],
      'ba_dinh': ['hoan_kiem', 'dong_da', 'cau_giay', 'tay_ho', 'long_bien'],
      'dong_da': ['ba_dinh', 'hoan_kiem', 'hai_ba_trung', 'thanh_xuan', 'cau_giay'],
      'hai_ba_trung': ['hoan_kiem', 'dong_da', 'thanh_xuan', 'hoang_mai', 'long_bien'],
      'hoang_mai': ['hai_ba_trung', 'thanh_xuan', 'long_bien', 'thanh_tri'],
      'thanh_xuan': ['dong_da', 'hai_ba_trung', 'hoang_mai', 'cau_giay', 'ha_dong', 'nam_tu_liem', 'thanh_tri'],
      'cau_giay': ['ba_dinh', 'dong_da', 'thanh_xuan', 'tay_ho', 'nam_tu_liem', 'bac_tu_liem'],
      'tay_ho': ['ba_dinh', 'cau_giay', 'bac_tu_liem', 'long_bien', 'dong_anh'],
      'long_bien': ['tay_ho', 'ba_dinh', 'hoan_kiem', 'hai_ba_trung', 'hoang_mai', 'gia_lam', 'dong_anh'],
      'ha_dong': ['thanh_xuan', 'nam_tu_liem', 'thanh_tri', 'thanh_oai', 'chuong_my', 'hoai_duc'],
      'bac_tu_liem': ['tay_ho', 'cau_giay', 'nam_tu_liem', 'hoai_duc', 'dan_phuong', 'dong_anh'],
      'nam_tu_liem': ['cau_giay', 'thanh_xuan', 'ha_dong', 'bac_tu_liem', 'hoai_duc'],
      'thanh_tri': ['hoang_mai', 'thanh_xuan', 'ha_dong', 'thanh_oai', 'thuong_tin', 'gia_lam'],
      'gia_lam': ['long_bien', 'dong_anh', 'thanh_tri', 'thuong_tin'],
      'dong_anh': ['tay_ho', 'long_bien', 'gia_lam', 'bac_tu_liem', 'dan_phuong'],
      'hoai_duc': ['bac_tu_liem', 'nam_tu_liem', 'ha_dong', 'dan_phuong', 'chuong_my'],
      'dan_phuong': ['bac_tu_liem', 'hoai_duc', 'dong_anh'],
      'chuong_my': ['ha_dong', 'hoai_duc', 'thanh_oai'],
      'thanh_oai': ['ha_dong', 'chuong_my', 'thanh_tri', 'thuong_tin'],
      'thuong_tin': ['thanh_tri', 'thanh_oai', 'gia_lam']
    };

    const details = [];
    let totalWeight = 0;

    districts.forEach(d => {
      const isAllowed = allowedDistricts.includes(d.key);
      let weight = 1.0;
      let areaBoost = 0;
      let adjacentBoost = 0;
      
      const distRadiusM = (d.radiusKm || 1.5) * 1000;

      const sysL = window.sysLimits;
      const areaWeights = sysL?.activity_areas?.weights || {
        home: { fully: 7.0, mostly: 5.2, partially: 2.8 },
        work: { fully: 5.5, mostly: 3.2, partially: 1.5 }
      };
      const adjacentWeight = sysL?.boost_adjacent?.adjacent_weight || 1.8;
      const sameWeight = sysL?.boost_adjacent?.same_weight || 2.7;

      areas.forEach(area => {
        const distToArea = haversineDistance(d.lat, d.lng, area.lat, area.lng);
        const intersection = getCircleIntersectionArea(distRadiusM, area.radius, distToArea);
        const minArea = Math.PI * Math.pow(Math.min(distRadiusM, area.radius), 2);
        const ratio = minArea > 0 ? intersection / minArea : 0;
        
        if (ratio > 0) {
          let boost = 0;
          if (area.type === 'home') {
            if (ratio >= 0.85) boost = areaWeights.home.fully;
            else if (ratio >= 0.35) boost = areaWeights.home.mostly;
            else boost = areaWeights.home.partially;
          } else if (area.type === 'work') {
            if (ratio >= 0.85) boost = areaWeights.work.fully;
            else if (ratio >= 0.35) boost = areaWeights.work.mostly;
            else boost = areaWeights.work.partially;
          }
          weight += boost;
          areaBoost += boost;
        }
      });

      if (boostAdjacent && lastDistrictKeys) {
        const lastKeys = typeof lastDistrictKeys === 'string' && lastDistrictKeys.startsWith('[')
          ? JSON.parse(lastDistrictKeys)
          : lastDistrictKeys.split(',');
        
        if (Array.isArray(lastKeys)) {
          let boostValue = 0;
          for (const lk of lastKeys) {
            if (lk === d.key) {
              boostValue = Math.max(boostValue, sameWeight);
            } else if (ADJACENT_DISTRICTS[lk] && ADJACENT_DISTRICTS[lk].includes(d.key)) {
              boostValue = Math.max(boostValue, adjacentWeight);
            }
          }
          weight += boostValue;
          adjacentBoost += boostValue;
        }
      }

      if (isAllowed) {
        totalWeight += weight;
      }

      details.push({
        key: d.key,
        name: d.name,
        isAllowed,
        weight,
        areaBoost,
        adjacentBoost
      });
    });

    console.log(`%c[District Weights Debug]%c - Boost Adjacent: ${boostAdjacent ? 'ON' : 'OFF'} | Areas: ${areas.length} | Last district(s): ${lastDistrictKeys || 'None'}`, 
      'font-weight: bold; color: #fb923c; font-size: 1.1em;', 'color: inherit;');

    const allowedDetails = details
      .filter(item => item.isAllowed)
      .map(item => {
        const percentage = totalWeight > 0 ? parseFloat(((item.weight / totalWeight) * 100).toFixed(2)) : 0;
        let boosts = [];
        if (item.areaBoost > 0) boosts.push(`Home/Work: +${item.areaBoost.toFixed(1)}`);
        if (item.adjacentBoost > 0) boosts.push(`Adjacent: +${item.adjacentBoost.toFixed(1)}`);
        return {
          'Quận': item.name,
          'Key': item.key,
          'Trọng số': parseFloat(item.weight.toFixed(2)),
          'Tỉ lệ (%)': `${percentage}%`,
          'Boosts': boosts.join(', ') || 'None'
        };
      });

    if (allowedDetails.length > 0) {
      console.table(allowedDetails);
    } else {
      console.log('Không có quận nào được chọn trong Allowed Districts.');
    }

  } catch (err) {
    console.error('[District Weights Debug] Error calculating weights:', err);
  }
}

// Export to window
window.loadDashboard = loadDashboard;
window.loadStats = loadStats;
window.loadDistricts = loadDistricts;
window.loadActivities = loadActivities;
window.changeLocalPage = changeLocalPage;
window.onHistoryFilterChange = onHistoryFilterChange;
window.onStravaFilterChange = onStravaFilterChange;
window.refreshCloudData = refreshCloudData;
window.loadStravaActivities = loadStravaActivities;
window.changeStravaPage = changeStravaPage;
window.loadInsights = loadInsights;
window.updateActivityChart = updateActivityChart;
window.toggleThemePreview = toggleThemePreview;
window.initTheme = initTheme;
window.generateOnly = generateOnly;
window.generateAndUpload = generateAndUpload;
window.uploadActivity = uploadActivity;
window.deleteActivity = deleteActivity;
window.debugDistrictWeightRatios = debugDistrictWeightRatios;
