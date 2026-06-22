/**
 * StrAct Z - API & Toast Utilities
 */

// ─── API Helper ────────────────────────────────────────

async function api(endpoint, options = {}) {
  try {
    const res = await fetch(`/api${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: res.statusText }));
      return {
        error: errorData.error || `HTTP ${res.status}`,
        code: errorData.code,
        message: errorData.message,
        ...errorData
      };
    }
    return res.json();
  } catch (err) {
    console.error(`API Error (${endpoint}):`, err);
    return { error: err.message };
  }
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

async function getApiTokens() {
  return api('/api-tokens');
}

async function createApiToken(name, ipWhitelist) {
  return api('/api-tokens', {
    method: 'POST',
    body: { name, ip_whitelist: ipWhitelist }
  });
}

async function revokeApiToken(tokenId) {
  return api(`/api-tokens/${tokenId}`, {
    method: 'DELETE'
  });
}

// Export to window
window.api = api;
window.showToast = showToast;
window.getApiTokens = getApiTokens;
window.createApiToken = createApiToken;
window.revokeApiToken = revokeApiToken;
