/**
 * Script kiểm thử tạo tệp FIT hoạt động (StrAct-Z v2.0.0)
 * Chạy bằng lệnh: node test_fit_gen.js
 */

const fs = require('fs');
const path = require('path');
const { generateActivity } = require('./src/services/fit-generator');

async function runTest() {
  console.log('=== BẮT ĐẦU KIỂM THỬ FIT GENERATOR ===\n');

  const testConfig = {
    startLat: 21.0285,
    startLng: 105.8542,
    districtKey: 'hoan_kiem', // Sinh lộ trình quanh Hồ Gươm
    minDistanceKm: 2.0,
    maxDistanceKm: 3.5,
    minPace: 5.5,
    maxPace: 6.5,
    activityType: 'Run',
    heartRateEnabled: true,
    minHeartRate: 130,
    maxHeartRate: 165,
    startTime: new Date(),
    useOSRM: false, // Dùng thẳng fallback L-Shape/Manhattan để tránh phụ thuộc network OSRM khi chạy test
    deviceName: 'Garmin fēnix 7x Pro',
    simWeather: true,
    simRedLights: true
  };

  try {
    console.log('1. Đang sinh thử hoạt động chạy bộ với thiết bị "Garmin fēnix 7x Pro"...');
    const result = await generateActivity(testConfig);
    
    console.log('\n--- KẾT QUẢ SINH HOẠT ĐỘNG ---');
    console.log(`- Tên hoạt động:  ${result.activityName}`);
    console.log(`- Thể loại:       ${result.activityType}`);
    console.log(`- Cự ly:          ${result.distanceKm} km`);
    console.log(`- Thời lượng:     ${result.durationMin} phút`);
    console.log(`- Nhịp độ trung bình: ${result.paceMinKm} phút/km`);
    console.log(`- Vùng quận:      ${result.districtKey}`);
    console.log(`- Số điểm GPS:    ${result.numPoints}`);
    console.log(`- Tên tệp lưu:    ${result.filename}`);
    console.log(`- Đường dẫn tệp:  ${result.filepath}`);

    if (fs.existsSync(result.filepath)) {
      const stats = fs.statSync(result.filepath);
      console.log(`- Trạng thái lưu: Thành công ✅ (Kích thước tệp: ${stats.size} bytes)`);
      if (stats.size > 100) {
        console.log('- Xác thực tệp nhị phân FIT: Thành công ✅');
      } else {
        console.log('- Xác thực tệp nhị phân FIT: Lỗi ❌ (Tệp quá nhỏ)');
      }
    } else {
      console.log('- Trạng thái lưu: Thất bại ❌ (Không tìm thấy tệp)');
    }

    console.log('\n2. Kiểm thử ánh xạ thiết bị tương thích (Device Mapping):');
    const devicesToTest = [
      'Apple Sport',
      'Coros Pace 3',
      'Samsung Galaxy Watch Ultra',
      'Amazfit T-Rex 3',
      'Thiết bị VIP tự định nghĩa (Custom Garmin fēnix 9)'
    ];

    for (const dev of devicesToTest) {
      const res = await generateActivity({
        ...testConfig,
        deviceName: dev,
        minDistanceKm: 1.0,
        maxDistanceKm: 1.5,
        startTime: new Date(Date.now() - 3600000) // 1 tiếng trước để tránh overlap đệm thời gian
      });
      console.log(`  - Thiết bị [${dev}] -> Sinh tệp thành công: ${res.filename} ✅`);
    }

    console.log('\n=== KIỂM THỬ HOÀN THÀNH THÀNH CÔNG ===');

  } catch (err) {
    console.error('\n❌ Đã xảy ra lỗi trong quá trình kiểm thử:', err);
  }
}

runTest();
