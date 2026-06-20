/**
 * StrAct Z - Generate Around Location (Tạo quanh vị trí)
 * Modal Controller, Leaflet Preview Map, GPS Geolocation, and Reverse Geocoding via Nominatim
 */
const VN_PROVINCE_CODES = {
  'VN-HN': 'Thành phố Hà Nội',
  'VN-SG': 'Thành phố Hồ Chí Minh',
  'VN-DN': 'Thành phố Đà Nẵng',
  'VN-HP': 'Thành phố Hải Phòng',
  'VN-CT': 'Thành phố Cần Thơ',
  'VN-01': 'Tỉnh Lai Châu',
  'VN-02': 'Tỉnh Lào Cai',
  'VN-03': 'Tỉnh Hà Giang',
  'VN-04': 'Tỉnh Cao Bằng',
  'VN-05': 'Tỉnh Sơn La',
  'VN-06': 'Tỉnh Yên Bái',
  'VN-07': 'Tỉnh Tuyên Quang',
  'VN-09': 'Tỉnh Lạng Sơn',
  'VN-13': 'Tỉnh Quảng Ninh',
  'VN-14': 'Tỉnh Hòa Bình',
  'VN-18': 'Tỉnh Ninh Bình',
  'VN-20': 'Tỉnh Thái Bình',
  'VN-21': 'Tỉnh Thanh Hóa',
  'VN-22': 'Tỉnh Nghệ An',
  'VN-23': 'Tỉnh Hà Tĩnh',
  'VN-24': 'Tỉnh Quảng Bình',
  'VN-25': 'Tỉnh Quảng Trị',
  'VN-26': 'Tỉnh Thừa Thiên Huế',
  'VN-27': 'Tỉnh Quảng Nam',
  'VN-28': 'Tỉnh Kon Tum',
  'VN-29': 'Tỉnh Quảng Ngãi',
  'VN-30': 'Tỉnh Gia Lai',
  'VN-31': 'Tỉnh Bình Định',
  'VN-32': 'Tỉnh Phú Yên',
  'VN-33': 'Tỉnh Đắk Lắk',
  'VN-34': 'Tỉnh Khánh Hòa',
  'VN-35': 'Tỉnh Lâm Đồng',
  'VN-36': 'Tỉnh Ninh Thuận',
  'VN-37': 'Tỉnh Tây Ninh',
  'VN-39': 'Tỉnh Đồng Nai',
  'VN-40': 'Tỉnh Bình Thuận',
  'VN-41': 'Tỉnh Long An',
  'VN-43': 'Tỉnh Bà Rịa - Vũng Tàu',
  'VN-44': 'Tỉnh An Giang',
  'VN-45': 'Tỉnh Đồng Tháp',
  'VN-46': 'Tỉnh Tiền Giang',
  'VN-47': 'Tỉnh Kiên Giang',
  'VN-49': 'Tỉnh Vĩnh Long',
  'VN-50': 'Tỉnh Bến Tre',
  'VN-51': 'Tỉnh Trà Vinh',
  'VN-52': 'Tỉnh Sóc Trăng',
  'VN-53': 'Tỉnh Bắc Kạn',
  'VN-54': 'Tỉnh Bắc Giang',
  'VN-55': 'Tỉnh Bạc Liêu',
  'VN-56': 'Tỉnh Bắc Ninh',
  'VN-57': 'Tỉnh Bình Dương',
  'VN-58': 'Tỉnh Bình Phước',
  'VN-59': 'Tỉnh Cà Mau',
  'VN-61': 'Tỉnh Hải Dương',
  'VN-63': 'Tỉnh Hà Nam',
  'VN-66': 'Tỉnh Hưng Yên',
  'VN-67': 'Tỉnh Nam Định',
  'VN-68': 'Tỉnh Phú Thọ',
  'VN-69': 'Tỉnh Thái Nguyên',
  'VN-70': 'Tỉnh Vĩnh Phúc',
  'VN-71': 'Tỉnh Điện Biên',
  'VN-72': 'Tỉnh Đắk Nông',
  'VN-73': 'Tỉnh Hậu Giang'
};

let aroundMap = null;
let aroundMarker = null;
let selectedLat = null;
let selectedLng = null;
let resolvedLocationName = "";

function openAroundLocationModal() {
  const modal = document.getElementById('aroundLocationModal');
  if (!modal) return;

  // Read previous saved location or fallback to Bach Mai, Hai Bae Trung, Hanoi
  const savedLat = localStorage.getItem('preview_saved_lat');
  const savedLng = localStorage.getItem('preview_saved_lng');
  if (savedLat && savedLng) {
    selectedLat = parseFloat(savedLat);
    selectedLng = parseFloat(savedLng);
  } else {
    // Fallback: Bach Mai, Hai Ba Trung, Hanoi
    selectedLat = 21.0035;
    selectedLng = 105.8488;
  }
  resolvedLocationName = "";

  // Reset bypass avoid workhours checkbox to unchecked
  const bypassInput = document.getElementById('aroundBypassWorkhours');
  if (bypassInput) bypassInput.checked = false;

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

  const mapType = document.getElementById('cfgMapType')?.value || (window.sysLimits?.map_type?.default) || 'carto_dark';
  const layerCfg = window.MAP_LAYERS_CONFIG[mapType] || window.MAP_LAYERS_CONFIG.carto_dark;
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

      try {
        localStorage.setItem('preview_saved_lat', selectedLat.toString());
        localStorage.setItem('preview_saved_lng', selectedLng.toString());
      } catch (e) {
        console.error("Failed to save GPS location to localStorage:", e);
      }

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
      // Resolve ward/district/suburb hierarchically
      const district = addr.suburb || addr.quarter || addr.neighbourhood || addr.city_district || addr.district || addr.county || "";
      const city = addr.city || addr.town || addr.village || "";
      
      let state = addr.state || addr.province || addr.region || "";

      // Fallback/Correct state name from ISO3166-2-lvl4 mapping for Vietnam
      const isVietnam = addr.country_code === 'vn' || (addr.country && (addr.country === 'Việt Nam' || addr.country === 'Vietnam'));
      if (isVietnam && addr['ISO3166-2-lvl4']) {
        const isoCode = addr['ISO3166-2-lvl4'].toUpperCase();
        if (VN_PROVINCE_CODES[isoCode]) {
          state = VN_PROVINCE_CODES[isoCode];
        }
      }

      // Deduplicate parts case-insensitively while ignoring administrative prefixes
      const uniqueParts = [];
      const seen = new Set();
      for (const p of [district, city, state]) {
        if (!p) continue;
        const norm = p.toLowerCase()
          .replace(/^(tỉnh|thành phố|quận|huyện|phường|xã|thị trấn|thị xã)\s+/i, '')
          .trim();
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          uniqueParts.push(p);
        }
      }

      locationStr = uniqueParts.join(", ");

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

  const bypassWorkhours = document.getElementById('aroundBypassWorkhours')?.checked || false;
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
      activity_type: activityType,
      export_format: exportFormat,
      bypass_workhours: bypassWorkhours ? 'true' : 'false'
    };

    const endpoint = upload ? '/generate-and-upload' : '/generate';
    const result = await api(endpoint, {
      method: 'POST',
      body: payload
    });

    if (result.success) {
      try {
        localStorage.setItem('preview_saved_lat', selectedLat.toString());
        localStorage.setItem('preview_saved_lng', selectedLng.toString());
      } catch (e) {
        console.error("Failed to save generated location to localStorage:", e);
      }

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
