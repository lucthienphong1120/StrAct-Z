/**
 * StrAct Z - Authentication Logic
 */

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
      const vipTag = window.userRole === 'vip' ? ' <span style="color:var(--vip-gold); font-size:0.7rem; font-weight:800; border:1px solid var(--vip-gold); padding:1px 6px; border-radius:4px; margin-left:6px; background:rgba(245,158,11,0.1);">VIP</span>' : '';
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
  const el = document.getElementById('accountProfile');
  const roleBadge = window.userRole === 'vip' ? '<span class="status-badge" style="background:var(--gradient-vip); color:rgba(0,0,0,0.8); padding:2px 10px; font-size:0.65rem; border:none; margin-left:8px; box-shadow: 0 0 10px rgba(245,158,11,0.4); font-weight:800;">VIP GOLD</span>' : '';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      ${athlete?.avatar ? `<img src="${athlete.avatar}" style="width:48px;height:48px;border-radius:50%;border:2px solid var(--strava-orange);" alt="avatar">` : '<div style="width:48px;height:48px;border-radius:50%;background:var(--strava-orange);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🏃</div>'}
      <div>
        <div style="font-weight:600; display:flex; align-items:center;">${athlete?.name || 'Strava User'} ${roleBadge}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);">ID: ${athlete?.id || 'N/A'}</div>
      </div>
    </div>
  `;

  // Sync Daily Limit value and Tooltips after limits are loaded
  if (window.sysLimits) {
    const dailyLimit = document.getElementById('cfgDailyLimit');
    if (dailyLimit) dailyLimit.value = window.sysLimits.daily_upload_limit.max;
    if (window.updateDynamicTooltips) {
      window.updateDynamicTooltips();
    }
  }
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

// Export to window
window.checkAuth = checkAuth;
window.renderAccountInfo = renderAccountInfo;
window.systemLogout = systemLogout;
window.disconnect = disconnect;
window.activateVip = activateVip;
window.updatePassword = updatePassword;
