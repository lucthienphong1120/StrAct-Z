/**
 * StrAct Z - Generate Around Location (Tạo quanh vị trí)
 * Modal Controller, Leaflet Preview Map, GPS Geolocation, and Reverse Geocoding via Nominatim
 */

let aroundMap = null;
let aroundMarker = null;
let selectedLat = null;
let selectedLng = null;
let resolvedLocationName = "";

function openAroundLocationModal() {
  const modal = document.getElementById('aroundLocationModal');
  if (!modal) return;

  // Clear previous state or default to current view center
  selectedLat = window.savedMapState?.lat || 21.0285;
  selectedLng = window.savedMapState?.lng || 105.8542;
  resolvedLocationName = "";

  // Set default values from current config inputs if available
  const currentMinDist = document.getElementById('cfgMinDist')?.value || "5.0";
  document.getElementById('aroundDistance').value = currentMinDist;

  document.getElementById('aroundActivityType').value = ""; // Default to System Config

  document.getElementById('aroundLocationText').textContent = "Đang xác định vị trí...";

  // Show modal
  modal.classList.add('active');

  // Initialize Map after transition completes
  setTimeout(() => {
    initAroundMap();
    reverseGeocode(selectedLat, selectedLng);
  }, 150);
}

function closeAroundLocationModal() {
  const modal = document.getElementById('aroundLocationModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function initAroundMap() {
  if (aroundMap) {
    aroundMap.setView([selectedLat, selectedLng], 13);
    if (aroundMarker) {
      aroundMarker.setLatLng([selectedLat, selectedLng]);
    }
    aroundMap.invalidateSize();
    return;
  }

  aroundMap = L.map('aroundLocationMap').setView([selectedLat, selectedLng], 13);
  window.aroundMap = aroundMap;

  const mapType = document.getElementById('cfgMapType')?.value || 'carto_dark';
  const layerCfg = window.MAP_LAYERS_CONFIG[mapType] || window.MAP_LAYERS_CONFIG.osm_standard;
  window.aroundMapTileLayer = L.tileLayer(layerCfg.url, layerCfg.options).addTo(aroundMap);

  // Custom orange icon for selected custom location
  const orangeIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  aroundMarker = L.marker([selectedLat, selectedLng], {
    draggable: true,
    icon: orangeIcon,
    title: 'Điểm chạy bộ'
  }).addTo(aroundMap);

  aroundMarker.on('dragend', function (e) {
    const latlng = aroundMarker.getLatLng();
    selectedLat = latlng.lat;
    selectedLng = latlng.lng;
    reverseGeocode(selectedLat, selectedLng);
  });

  aroundMap.on('click', function (e) {
    selectedLat = e.latlng.lat;
    selectedLng = e.latlng.lng;
    aroundMarker.setLatLng(e.latlng);
    reverseGeocode(selectedLat, selectedLng);
  });

  setTimeout(() => {
    aroundMap.invalidateSize();
  }, 100);
}

function getGPSLocation() {
  if (!navigator.geolocation) {
    showToast("Trình duyệt của bạn không hỗ trợ định vị GPS.", "warning");
    return;
  }

  document.getElementById('aroundLocationText').textContent = "Đang lấy toạ độ GPS...";
  showToast("Đang gửi yêu cầu định vị GPS...", "info");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      selectedLat = position.coords.latitude;
      selectedLng = position.coords.longitude;

      if (aroundMap) {
        aroundMap.setView([selectedLat, selectedLng], 14);
        if (aroundMarker) {
          aroundMarker.setLatLng([selectedLat, selectedLng]);
        }
      }
      reverseGeocode(selectedLat, selectedLng);
      showToast("Định vị vị trí hiện tại thành công!", "success");
    },
    (err) => {
      console.warn("GPS Geolocation failed:", err);
      let errMsg = "Không thể lấy vị trí hiện tại của bạn. Vui lòng cấp quyền chia sẻ vị trí (GPS) cho trình duyệt và thiết bị.";
      if (err.code === err.PERMISSION_DENIED) {
        errMsg = "⚠️ Quyền truy cập vị trí bị từ chối. Vui lòng cấp quyền chia sẻ GPS trong cài đặt trình duyệt để sử dụng tính năng này.";
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        errMsg = "⚠️ Không có tín hiệu định vị hoặc GPS bị tắt. Bạn có thể thả ghim thủ công bằng cách click lên bản đồ.";
      } else if (err.code === err.TIMEOUT) {
        errMsg = "⚠️ Hết thời gian chờ định vị (GPS phản hồi chậm). Bạn có thể thử lại hoặc click ghim thủ công lên bản đồ.";
      }
      showToast(errMsg, "warning");
      document.getElementById('aroundLocationText').textContent = resolvedLocationName || "Chưa định vị (Thử thả ghim thủ công)";
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

async function reverseGeocode(lat, lng) {
  const displayLabel = document.getElementById('aroundLocationText');
  try {
    // Call OpenStreetMap Nominatim reverse lookup
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`, {
      headers: { 'Accept-Language': 'vi,en' }
    });
    if (!res.ok) throw new Error('OSM Nominatim lookup failed');
    const data = await res.json();

    let locationStr = "";
    if (data.address) {
      const addr = data.address;
      // Resolve name elements hierarchically
      const district = addr.suburb || addr.quarter || addr.district || addr.city_district || addr.county || "";
      const city = addr.city || addr.town || addr.village || addr.state || "";

      const parts = [district, city].map(p => p.trim()).filter(Boolean);
      locationStr = parts.join(", ");

      if (!locationStr && addr.country) {
        locationStr = addr.country;
      }
    }

    resolvedLocationName = locationStr || "Ngoài Hà Nội / Du lịch";
    displayLabel.textContent = `${resolvedLocationName} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  } catch (err) {
    console.warn("Reverse geocoding failed, fallback to default labels:", err.message);
    resolvedLocationName = "Ngoài Hà Nội / Du lịch";
    displayLabel.textContent = `${resolvedLocationName} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
}

async function submitAroundLocationGen(upload = false) {
  if (selectedLat === null || selectedLng === null) {
    showToast("Vui lòng chọn một địa điểm trên bản đồ trước.", "warning");
    return;
  }

  const distanceVal = parseFloat(document.getElementById('aroundDistance').value);
  if (isNaN(distanceVal) || distanceVal < 0.2 || distanceVal > 20.0) {
    showToast("Khoảng cách chạy phải từ 0.2km đến 20km.", "warning");
    return;
  }

  const activityType = document.getElementById('aroundActivityType').value;
  const exportFormat = document.getElementById('cfgExportFormat')?.value || 'fit';

  const btnGen = document.getElementById('btnSubmitAroundGen');
  const btnUpload = document.getElementById('btnSubmitAroundUpload');

  btnGen.disabled = true;
  btnUpload.disabled = true;

  const originalTextGen = btnGen.textContent;
  const originalTextUpload = btnUpload.textContent;

  if (upload) {
    btnUpload.innerHTML = '<span class="spinner"></span> Đang tạo & Upload...';
    showToast("Đang sinh hoạt động & upload lên Strava...", "info");
  } else {
    btnGen.innerHTML = '<span class="spinner"></span> Đang tạo...';
    showToast("Đang sinh hoạt động nháp...", "info");
  }

  try {
    const payload = {
      near_me_lat: selectedLat.toString(),
      near_me_lng: selectedLng.toString(),
      location_name: resolvedLocationName,
      min_distance_km: distanceVal.toString(),
      max_distance_km: distanceVal.toString(),
      activity_type: activityType,
      export_format: exportFormat
    };

    const endpoint = upload ? '/generate-and-upload' : '/generate';
    const result = await api(endpoint, {
      method: 'POST',
      body: payload
    });

    if (result.success) {
      if (upload) {
        showToast(`Tải lên thành công! Lộ trình: ${result.activity?.activityName || resolvedLocationName}`, "success");
      } else {
        showToast(`Tạo nháp thành công! Lộ trình: ${result.activity?.name || resolvedLocationName}`, "success");
      }
      closeAroundLocationModal();

      // Refresh dashboard datasets
      if (window.loadDashboard) {
        await window.loadDashboard(true);
      }
    } else {
      showToast(result.error || "Tạo hoạt động thất bại.", "error");
    }
  } catch (err) {
    if (err.status === 409) {
      showToast("⏰ Không tìm thấy khung giờ chạy hợp lệ. Vui lòng kiểm tra Avoid Workhours.", "warning");
    } else {
      showToast("Lỗi hệ thống: " + err.message, "error");
    }
  } finally {
    btnGen.disabled = false;
    btnUpload.disabled = false;
    btnGen.textContent = originalTextGen;
    btnUpload.textContent = originalTextUpload;
  }
}

// Export functions to window
window.openAroundLocationModal = openAroundLocationModal;
window.closeAroundLocationModal = closeAroundLocationModal;
window.getGPSLocation = getGPSLocation;
window.submitAroundLocationGen = submitAroundLocationGen;
