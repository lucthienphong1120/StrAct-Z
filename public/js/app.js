/**
 * Strava Auto Activity Generator - Main Entry Point
 * Refactored into modules in /js/core and /js/ui
 */

// ─── Global State ───────────────────────────────────────

window.userRole = 'normal';
window.sysLimits = null;
window.sysDistricts = [];

window.map = null;
window.selectedDistrictKeys = [];
window.districtGeoJsonLayer = null;
window.activityCircles = [];
window.isMapLocked = true;
window.savedMapState = { lat: 21.0285, lng: 105.8542, zoom: 12 };

window.localCurrentPage = 1;
window.LOCAL_PAGE_SIZE = 10;
window.stravaCurrentPage = 1;
window.activityChart = null;

// ─── Initialization ─────────────────────────────────────

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('success') === 'connected') {
    showToast('Successfully connected to Strava!', 'success');
    history.replaceState(null, '', '/');
  }
  if (params.get('error')) {
    showToast('Error: ' + params.get('error'), 'error');
    history.replaceState(null, '', '/');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkUrlParams();
  checkAuth();
  
  // Attach HR toggle listener
  const hrToggle = document.getElementById('cfgHeartRate');
  if (hrToggle) {
    hrToggle.addEventListener('change', toggleHRInputs);
  }

  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('Service Worker registered', reg))
      .catch((err) => console.error('Service Worker registration failed', err));
  }
});

// Orchestrator function called by checkAuth when authenticated
// window.loadDashboard is defined in ui/dashboard.js
