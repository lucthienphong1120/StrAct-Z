/**
 * StrAct Z - Dashboard, Stats, and Activities
 */

async function loadDashboard(forceRefresh = false) {
  window.latestStravaActivities = []; // Store for cross-check
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
}

async function loadStats(forceRefresh = false) {
  try {
    const stats = await api('/stats');
    window.userRole = stats.role || 'normal';
    if (window.userRole === 'vip') {
      document.body.classList.add('is-vip');
    } else {
      document.body.classList.remove('is-vip');
    }

    const authText = document.getElementById('authText');
    if (authText) {
      const currentName = authText.textContent.replace(' VIP', '').trim();
      const vipTag = window.userRole === 'vip' ? ' <span style="color:var(--vip-gold); font-size:0.7rem; font-weight:800; border:1px solid var(--vip-gold); padding:1px 6px; border-radius:4px; margin-left:6px; background:rgba(245,158,11,0.1);">VIP</span>' : '';
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

async function loadDistricts() {
  try {
    window.sysDistricts = await api('/districts');
  } catch (err) {
    console.error('Failed to load districts:', err);
  }
}

async function loadActivities() {
  try {
    let allActivities = await api('/activities');
    const container = document.getElementById('activityList');
    
    // 1. Time Filtering
    const range = document.getElementById('historyFilterRange')?.value || '7_days';
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
      
      allActivities = allActivities.filter(a => {
        const actualTime = a.route_start_time || a.created_at;
        const dateStr = actualTime.endsWith('Z') ? actualTime : actualTime + 'Z';
        return new Date(dateStr) >= cutoff;
      });
    }

    const total = allActivities.length;
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
    const pageActivities = allActivities.slice(start, start + window.LOCAL_PAGE_SIZE);

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
            const name = window.sysDistricts.find(d => d.key === k)?.name || k;
            return `<span class="status-badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid var(--border); padding: 2px 6px;">📍 ${name}</span>`;
          }).join('');
      }

      // --- New Single-Badge Logic ---
      const isUploadedLocal = (a.upload_status === 'uploaded' || !!a.strava_activity_id);
      const stravaRecord = isUploadedLocal ? window.latestStravaActivities?.find(s => String(s.id) === String(a.strava_activity_id)) : null;
      
      let badge = '';
      
      if (isUploadedLocal) {
        // If we have cloud data loaded, check if it's still there
        const cloudDataAvailable = window.latestStravaActivities?.length > 0;
        if (cloudDataAvailable && !stravaRecord) {
          badge = `<span class="status-badge removed" title="Đã tạo local và upload lên cloud, sau đó xóa ở cloud">⚪ REMOVED</span>`;
        } else {
          badge = `<span class="status-badge uploaded" title="Đã tạo local và upload lên cloud">🟢 UPLOADED</span>`;
        }
      } else {
        if (a.deleted_at || a.upload_status === 'deleted') {
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
            </div>
          </div>
          <div class="activity-meta">${a.distance_km?.toFixed(1)} km</div>
          <div class="activity-meta">${a.duration_min?.toFixed(0)} min</div>
          <div class="activity-meta">${a.pace_min_km?.toFixed(1)} min/km</div>
          <div style="display:flex;gap:6px;align-items:center; flex-wrap: wrap; justify-content: flex-end;">
            ${badge}
            
            <div style="display:flex; gap:6px; margin-left: 10px;">
              ${(a.upload_status === 'generated' && !a.deleted_at) ? `<button class="btn btn-sm btn-primary" onclick="uploadActivity(${a.id})">Upload</button>` : ''}
              ${a.strava_activity_id ? `<a href="https://www.strava.com/activities/${a.strava_activity_id}" target="_blank" class="btn btn-sm btn-secondary">View</a>` : ''}
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
    
    // Store latest for cross-check (flatten if paginated, but for now we just take the current page view)
    // Actually, to be accurate we might need to know if the ID is missing across all pages.
    // But per user request, we'll map against what's loaded.
    window.latestStravaActivities = activities || [];
    
    // Update Local History to reflect Strava status
    loadActivities();

    document.getElementById('stravaPageInfo').textContent = `Page ${window.stravaCurrentPage}`;
    
    if (!activities || !activities.length) {
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
    updateActivityChart(activities, parseInt(range));
  } catch (err) {
    console.error('Insights error:', err);
  }
}

function updateActivityChart(activities, days = 14) {
  const ctx = document.getElementById('activityChart');
  if (!ctx) return;

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
        const localDate = new Date(startDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
        return localDate === date;
      })
      .reduce((sum, a) => sum + (a.moving_time / 60 || a.duration_min || 0), 0);
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

function toggleThemePreview() {
  const btn = document.getElementById('btnThemeToggle');
  
  if (window.userRole === 'vip') {
    const isNormal = document.body.classList.toggle('theme-preview-normal');
    localStorage.setItem('stractz_theme_preview', isNormal ? 'normal' : 'vip');
    if (btn) btn.innerHTML = isNormal ? '✨ Restore VIP Gold Theme' : '👁️ Preview Normal Theme';
    showToast(isNormal ? 'Switched to Normal Theme (Preview)' : 'Restored VIP Gold Theme', 'success');
  } else {
    const isVipPreview = document.body.classList.toggle('is-vip');
    if (btn) btn.innerHTML = isVipPreview ? '🔙 Switch Back to Normal' : '👁️ Preview VIP Gold Theme';
    showToast(isVipPreview ? 'Previewing VIP Gold Theme' : 'Switched back to Normal Theme', 'info');
  }
}

async function initTheme() {
  const stats = await api('/stats').catch(() => ({ role: 'normal' }));
  if (stats.role === 'vip' && localStorage.getItem('stractz_theme_preview') === 'normal') {
    document.body.classList.add('theme-preview-normal');
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
    await loadDashboard(true);
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
