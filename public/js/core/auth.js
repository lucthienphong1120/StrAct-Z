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
      renderGoogleFitAccount(data.googleFitConnected, data.googleFitUser);
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
  const roleBadge = window.userRole === 'vip' ? '<span class="status-badge" style="background:var(--gradient-vip); color:rgba(0,0,0,0.8); padding:2px 10px; font-size:0.65rem; border:none; margin-left:8px; box-shadow: 0 0 10px rgba(245,158,11,0.4); font-weight:800;">VIP GOLD</span>' : '';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      ${athlete?.avatar ? `<img src="${athlete.avatar}" style="width:48px;height:48px;border-radius:50%;border:2px solid var(--strava-orange);" alt="avatar">` : '<div style="width:48px;height:48px;border-radius:50%;background:var(--strava-orange);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🏃</div>'}
      <div>
        <div style="font-weight:600; display:flex; align-items:center;">${athlete?.name || 'Strava User'} ${roleBadge}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);">ID: ${athlete?.id || 'N/A'}</div>
      </div>
    </div>
    <button class="btn btn-block btn-outline-danger btn-sm" onclick="disconnect()">Disconnect Strava</button>
  `;
}

function renderGoogleFitAccount(connected, user) {
  const el = document.getElementById('googleFitInfo');
  if (!el) return;

  if (!connected) {
    el.innerHTML = `
      <div id="gfDisconnected">
        <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px;">Đồng bộ dữ liệu hoạt động và số bước chân sang Google Fit.</p>
        <button onclick="connectGoogleFit()" class="btn btn-block btn-secondary" style="gap:10px;">
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.173.282-1.712V4.956H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.044l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.956l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
          Connect Google Fit
        </button>
      </div>
    `;
    return;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      ${user?.avatar ? `<img src="${user.avatar}" style="width:48px;height:48px;border-radius:50%;border:2px solid #4285F4;" alt="avatar">` : '<div style="width:48px;height:48px;border-radius:50%;background:#4285F4;display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:white;">📉</div>'}
      <div>
        <div style="font-weight:600; display:flex; align-items:center;">${user?.name || 'Google Fit User'}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);" id="gfStatusText">Active & Syncing</div>
      </div>
    </div>
    <div style="background:var(--bg-secondary); border-radius:8px; padding:12px; margin-bottom:16px; border:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.85rem; color:var(--text-secondary);">Today's Steps</span>
        <span id="gfTodaySteps" style="font-weight:700; color:var(--text-primary); font-family:monospace; font-size:1.1rem;">--</span>
      </div>
      <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.7rem; color:var(--text-muted);" id="gfLastSync">Last sync: --:--</span>
      </div>
    </div>
    <button class="btn btn-block btn-outline-danger btn-sm" onclick="disconnectGoogleFit()">Disconnect Google Fit</button>
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
