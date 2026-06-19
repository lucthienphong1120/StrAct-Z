/**
 * StrAct Z - Map & Activity Areas Logic
 */

const MAP_LAYERS_CONFIG = {
  osm_standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }
  },
  carto_dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }
  },
  carto_voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }
  },
  carto_positron: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }
  },
  esri_satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 18
    }
  }
};

window.MAP_LAYERS_CONFIG = MAP_LAYERS_CONFIG;

function initMap() {
  if (window.map || !document.getElementById('activityMap')) return;

  window.map = L.map('activityMap').setView([window.savedMapState.lat, window.savedMapState.lng], window.savedMapState.zoom);

  const mapType = (window.savedMapState && window.savedMapState.map_type) || 'carto_dark';
  const layerCfg = MAP_LAYERS_CONFIG[mapType] || MAP_LAYERS_CONFIG.osm_standard;
  window.mapTileLayer = L.tileLayer(layerCfg.url, layerCfg.options).addTo(window.map);

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
    map.closePopup();

    window.activityCircles.forEach(item => {
      if (item.marker) {
        if (item.marker.dragging) item.marker.dragging.disable();
        item.marker.closePopup();
        item.marker.unbindPopup();
      }
    });
  } else {
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    map.scrollWheelZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
    if (map.tap) map.tap.enable();

    window.activityCircles.forEach((item, index) => {
      if (item.marker) {
        if (item.marker.dragging) item.marker.dragging.enable();
        bindPopupToMarker(item, index);
      }
    });
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
  const isVipTheme = document.body.classList.contains('is-vip') && !document.body.classList.contains('theme-preview-basic');
  const borderColor = isVipTheme ? '#fbbf24' : '#22d3ee';

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

function bindPopupToMarker(item, index) {
  const color = item.type === 'home' ? '#ff7800' : '#3b82f6';
  const popupId = `radius-val-${index}`;
  item.marker.bindPopup(`
    <div style="text-align:center; min-width:150px;">
      <b style="color:${color}">${item.type.toUpperCase()}</b><br>
      <div style="margin:8px 0; font-size:0.8rem;">
        Radius: <b id="${popupId}">${item.circle.getRadius()}</b>m<br>
        <input type="range" value="${item.circle.getRadius()}" min="${window.sysLimits?.scale_radius?.min || 2000}" max="${window.sysLimits?.scale_radius?.max || 4000}" step="100" 
          style="width:100%; margin-top:5px; accent-color:var(--strava-orange);" 
          oninput="document.getElementById('${popupId}').innerText = this.value; updateCircleRadius(${index}, this.value)">
      </div>
      <button class="btn btn-sm btn-secondary" style="margin-top:5px; padding:2px 8px; color:var(--accent-red); font-size:0.7rem;" onclick="removeCircle(${index})">🗑️ Delete Area</button>
    </div>
  `);
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

  applyMapLock();
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
    draggable: !window.isMapLocked,
    title: type.toUpperCase()
  }).addTo(window.map);

  const item = { circle, marker, type };
  window.activityCircles.push(item);
  const index = window.activityCircles.length - 1;

  marker.on('drag', (e) => {
    circle.setLatLng(e.latlng);
  });

  if (!window.isMapLocked) {
    bindPopupToMarker(item, index);
  }
}

function addActivityCircle(type) {
  if (window.isMapLocked) {
    return showToast('Không thể thêm khu vực khi bản đồ đang khóa.', 'warning');
  }
  if (!window.map || !window.sysLimits) return;
  if (type !== 'home' && type !== 'work') return;

  const count = window.activityCircles.filter(c => c.type === type).length;
  const max = type === 'home' ? window.sysLimits.home_count.max : window.sysLimits.work_count.max;

  if (count >= max) {
    return showToast(`Bạn đã đạt giới hạn tối đa (${max}) khu vực ${type.toUpperCase()}`, 'warning');
  }

  const center = window.map.getCenter();
  createCircleLayer(center.lat, center.lng, window.sysLimits?.scale_radius?.min || 2000, type);
  updateMapStatsUI();
  showToast(`Đã thêm khu vực ${type.toUpperCase()}`, 'info');
}

function updateCircleRadius(index, newRadius) {
  if (window.isMapLocked) return;
  if (window.activityCircles[index]) {
    let r = parseInt(newRadius);
    const maxR = window.sysLimits?.scale_radius?.max || 4000;
    const minR = window.sysLimits?.scale_radius?.min || 2000;
    if (r < minR) r = minR;
    if (r > maxR) r = maxR;
    window.activityCircles[index].circle.setRadius(r);
  }
}

function removeCircle(index) {
  if (window.isMapLocked) return;
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
    const startNearFavoriteEl = document.getElementById('cfgStartNearFavoritePlace');
    const start_near_favorite_place = startNearFavoriteEl ? (startNearFavoriteEl.checked ? 'true' : 'false') : 'true';
    const map_type = document.getElementById('cfgMapType')?.value || 'osm_standard';

    const res = await api('/config', {
      method: 'POST',
      body: {
        activity_areas: JSON.stringify(data),
        map_lat: center.lat.toString(),
        map_lng: center.lng.toString(),
        map_zoom: zoom.toString(),
        map_locked: 'true',
        start_near_favorite_place,
        map_type
      }
    });

    if (res.error) showToast(res.error, 'error');
    else {
      showToast('Activity areas & map view saved!', 'success');
      window.savedMapState = { lat: center.lat, lng: center.lng, zoom: zoom, map_type: map_type };

      // Auto-lock map after saving
      window.isMapLocked = true;
      applyMapLock();
      updateLockUI();
      updateMapStatsUI();
    }
  } catch (err) {
    showToast('Failed to save areas: ' + err.message, 'error');
  }
}

async function changeMapType(newType, skipSave = false) {
  const selectEl = document.getElementById('cfgMapType');
  if (selectEl) selectEl.value = newType;

  if (window.savedMapState) {
    window.savedMapState.map_type = newType;
  }

  if (!window.map) return;

  if (window.mapTileLayer) {
    window.map.removeLayer(window.mapTileLayer);
  }

  const layerCfg = MAP_LAYERS_CONFIG[newType] || MAP_LAYERS_CONFIG.osm_standard;
  window.mapTileLayer = L.tileLayer(layerCfg.url, layerCfg.options).addTo(window.map);
  window.mapTileLayer.bringToBack();

  // Also update around map if it is initialized
  if (window.aroundMap && window.aroundMapTileLayer) {
    window.aroundMap.removeLayer(window.aroundMapTileLayer);
    window.aroundMapTileLayer = L.tileLayer(layerCfg.url, layerCfg.options).addTo(window.aroundMap);
    window.aroundMapTileLayer.bringToBack();
  }

  if (!skipSave) {
    try {
      await api('/config', {
        method: 'POST',
        body: { map_type: newType }
      });
    } catch (err) {
      console.error('Failed to auto-save map type:', err);
    }
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
    infoMapLocked.style.fontWeight = '700';
  }

  const homeCount = window.activityCircles.filter(c => c.type === 'home').length;
  const infoHomeCount = document.getElementById('infoHomeCount');
  if (infoHomeCount) {
    infoHomeCount.textContent = `${homeCount}/${sysL.home_count.max}`;
    infoHomeCount.style.color = homeCount >= sysL.home_count.max ? '#fb923c' : 'var(--text-primary)';
    infoHomeCount.style.fontWeight = '700';
  }

  const workCount = window.activityCircles.filter(c => c.type === 'work').length;
  const infoWorkCount = document.getElementById('infoWorkCount');
  if (infoWorkCount) {
    infoWorkCount.textContent = `${workCount}/${sysL.work_count.max}`;
    infoWorkCount.style.color = workCount >= sysL.work_count.max ? '#60a5fa' : 'var(--text-primary)';
    infoWorkCount.style.fontWeight = '700';
  }

  const infoScaleRadius = document.getElementById('infoScaleRadius');
  if (infoScaleRadius) {
    infoScaleRadius.textContent = `${sysL.scale_radius.max}m`;
    infoScaleRadius.style.color = 'var(--text-primary)';
    infoScaleRadius.style.fontWeight = '700';
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
window.changeMapType = changeMapType;
window.updateSelectedDistrictKeys = updateSelectedDistrictKeys;
