/**
 * StrAct Z - Map & Activity Areas Logic
 */

function initMap() {
  if (window.map || !document.getElementById('activityMap')) return;
  
  window.map = L.map('activityMap').setView([window.savedMapState.lat, window.savedMapState.lng], window.savedMapState.zoom);
  
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(window.map);

  applyMapLock();
  renderDistrictBorders();

  setTimeout(() => window.map.invalidateSize(), 100);
}

function toggleMapLock() {
  window.isMapLocked = !window.isMapLocked;
  applyMapLock();
  updateLockUI();
  updateMapStatsUI();
}

function applyMapLock() {
  if (!window.map) return;
  const map = window.map;
  if (window.isMapLocked) {
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    if (map.tap) map.tap.disable();
  } else {
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    map.scrollWheelZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
    if (map.tap) map.tap.enable();
  }
}

function updateLockUI() {
  const btn = document.getElementById('btnLockMap');
  if (btn) {
    btn.innerHTML = window.isMapLocked ? '🔒 Map Locked' : '🔓 Map Unlocked';
    btn.classList.toggle('btn-secondary', window.isMapLocked);
    btn.classList.toggle('btn-outline-secondary', !window.isMapLocked);
  }
}

async function renderDistrictBorders() {
  if (!window.map) return;
  try {
    const res = await fetch('/geo/hanoi_full_districts.geojson');
    if (!res.ok) throw new Error('Could not load districts GeoJSON');
    const geojson = await res.json();
    
    if (window.districtGeoJsonLayer) window.map.removeLayer(window.districtGeoJsonLayer);
    
    window.districtGeoJsonLayer = L.geoJSON(geojson, {
      style: feature => getDistrictStyle(feature),
      onEachFeature: (feature, layer) => {
        if (feature.properties && feature.properties.name) {
          layer.bindTooltip(feature.properties.name, {
            sticky: true,
            className: 'district-tooltip',
            direction: 'top',
            offset: [0, -10]
          });
        }
      }
    }).addTo(window.map);
  } catch (err) {
    console.error('Failed to render district borders:', err);
  }
}

function getDistrictStyle(feature) {
  const borderColor = (window.userRole === 'vip') ? '#fbbf24' : '#22d3ee';
  
  const name = feature.properties.name;
  const district = window.sysDistricts.find(d => name.includes(d.name));
  const isSelected = district && window.selectedDistrictKeys.includes(district.key);
  
  return {
    color: borderColor,
    weight: isSelected ? 2 : 0.8,
    opacity: isSelected ? 0.9 : 0.2,
    fillColor: borderColor,
    fillOpacity: isSelected ? 0.08 : 0.01,
    interactive: true
  };
}

function updateDistrictHighlights() {
  if (window.districtGeoJsonLayer) {
    window.districtGeoJsonLayer.setStyle(feature => getDistrictStyle(feature));
  }
}

function resetMapView() {
  if (window.map) {
    window.map.setView([window.savedMapState.lat, window.savedMapState.lng], window.savedMapState.zoom);
  }
}

function renderCircles(areasData) {
  if (!window.map) initMap();
  
  window.activityCircles.forEach(item => {
    window.map.removeLayer(item.circle);
    window.map.removeLayer(item.marker);
  });
  window.activityCircles = [];

  try {
    const areas = typeof areasData === 'string' ? JSON.parse(areasData) : (areasData || []);
    areas.forEach(area => {
      createCircleLayer(area.lat, area.lng, area.radius, area.type);
    });
  } catch (e) { console.error('Error rendering circles:', e); }
  updateMapStatsUI();
}

function createCircleLayer(lat, lng, radius, type) {
  const color = type === 'home' ? '#ff7800' : '#3b82f6';
  
  const circle = L.circle([lat, lng], {
    color: color,
    fillColor: color,
    fillOpacity: 0.15,
    radius: radius,
    weight: 2
  }).addTo(window.map);

  const marker = L.marker([lat, lng], {
    draggable: true,
    title: type.toUpperCase()
  }).addTo(window.map);

  const item = { circle, marker, type };
  window.activityCircles.push(item);

  marker.on('drag', (e) => {
    circle.setLatLng(e.latlng);
  });

  const popupId = `radius-val-${window.activityCircles.length - 1}`;
  marker.bindPopup(`
    <div style="text-align:center; min-width:150px;">
      <b style="color:${color}">${type.toUpperCase()}</b><br>
      <div style="margin:8px 0; font-size:0.8rem;">
        Radius: <b id="${popupId}">${radius}</b>m<br>
        <input type="range" value="${radius}" min="2000" max="4000" step="100" 
          style="width:100%; margin-top:5px; accent-color:var(--strava-orange);" 
          oninput="document.getElementById('${popupId}').innerText = this.value; updateCircleRadius(${window.activityCircles.length - 1}, this.value)">
      </div>
      <button class="btn btn-sm btn-secondary" style="margin-top:5px; padding:2px 8px; color:var(--accent-red); font-size:0.7rem;" onclick="removeCircle(${window.activityCircles.length - 1})">🗑️ Delete Area</button>
    </div>
  `);
}

function addActivityCircle(type) {
  if (!window.map) return;
  if (type !== 'home' && type !== 'work') return;

  const count = window.activityCircles.filter(c => c.type === type).length;
  if (count >= 1) return showToast(`Only 1 ${type} area allowed`, 'warning');

  createCircleLayer(center.lat, center.lng, 2000, type);
  updateMapStatsUI();
  showToast(`Added ${type} area`, 'info');
}

function updateCircleRadius(index, newRadius) {
  if (window.activityCircles[index]) {
    let r = parseInt(newRadius);
    if (r < 2000) r = 2000;
    if (r > 4000) r = 4000;
    window.activityCircles[index].circle.setRadius(r);
  }
}

function removeCircle(index) {
  if (window.activityCircles[index]) {
    window.map.removeLayer(window.activityCircles[index].circle);
    window.map.removeLayer(window.activityCircles[index].marker);
    window.activityCircles.splice(index, 1);
    const currentData = window.activityCircles.map(c => ({
      lat: c.marker.getLatLng().lat,
      lng: c.marker.getLatLng().lng,
      radius: c.circle.getRadius(),
      type: c.type
    }));
    renderCircles(currentData);
    updateMapStatsUI();
  }
}

async function saveActivityAreas() {
  const data = window.activityCircles.map(c => ({
    lat: c.marker.getLatLng().lat,
    lng: c.marker.getLatLng().lng,
    radius: c.circle.getRadius(),
    type: c.type
  }));

  const center = window.map.getCenter();
  const zoom = window.map.getZoom();

  try {
    const res = await api('/config', {
      method: 'POST',
      body: { 
        activity_areas: JSON.stringify(data),
        map_lat: center.lat.toString(),
        map_lng: center.lng.toString(),
        map_zoom: zoom.toString()
      }
    });
    
    if (res.error) showToast(res.error, 'error');
    else {
      showToast('Activity areas & map view saved!', 'success');
      window.savedMapState = { lat: center.lat, lng: center.lng, zoom: zoom };
    }
  } catch (err) {
    showToast('Failed to save areas: ' + err.message, 'error');
  }
}

function updateSelectedDistrictKeys() {
  window.selectedDistrictKeys = Array.from(document.querySelectorAll('.district-cb:checked')).map(cb => cb.value);
}

function updateMapStatsUI() {
  const sysL = window.sysLimits;
  if (!sysL) return;

  const infoMapLocked = document.getElementById('infoMapLocked');
  if (infoMapLocked) {
    infoMapLocked.textContent = window.isMapLocked ? 'LOCKED' : 'UNLOCKED';
    infoMapLocked.style.color = window.isMapLocked ? '#f87171' : '#4ade80';
  }

  const homeCount = window.activityCircles.filter(c => c.type === 'home').length;
  const infoHomeCount = document.getElementById('infoHomeCount');
  if (infoHomeCount) {
    infoHomeCount.textContent = `${homeCount}/${sysL.home_count.max}`;
    infoHomeCount.style.color = homeCount >= sysL.home_count.max ? '#fb923c' : 'var(--text-primary)';
  }

  const workCount = window.activityCircles.filter(c => c.type === 'work').length;
  const infoWorkCount = document.getElementById('infoWorkCount');
  if (infoWorkCount) {
    infoWorkCount.textContent = `${workCount}/${sysL.work_count.max}`;
    infoWorkCount.style.color = workCount >= sysL.work_count.max ? '#60a5fa' : 'var(--text-primary)';
  }

  const infoScaleRadius = document.getElementById('infoScaleRadius');
  if (infoScaleRadius) {
    infoScaleRadius.textContent = `${sysL.scale_radius.max}m`;
  }
}

// Export to window
window.initMap = initMap;
window.toggleMapLock = toggleMapLock;
window.applyMapLock = applyMapLock;
window.updateLockUI = updateLockUI;
window.renderDistrictBorders = renderDistrictBorders;
window.updateDistrictHighlights = updateDistrictHighlights;
window.resetMapView = resetMapView;
window.renderCircles = renderCircles;
window.createCircleLayer = createCircleLayer;
window.addActivityCircle = addActivityCircle;
window.updateCircleRadius = updateCircleRadius;
window.removeCircle = removeCircle;
window.saveActivityAreas = saveActivityAreas;
window.updateSelectedDistrictKeys = updateSelectedDistrictKeys;
