const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();
const db = require('./src/db/database');

// Helper for https request
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          let errBody = {};
          try { errBody = JSON.parse(data); } catch (e) {}
          const err = new Error(`HTTP Error ${res.statusCode}: ${errBody.message || 'Request failed'}`);
          err.statusCode = res.statusCode;
          err.body = errBody;
          reject(err);
        } else {
          let parsed = data;
          try { parsed = JSON.parse(data); } catch (e) {}
          resolve(parsed);
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Refresh token logic
async function getAccessToken(accountId) {
  const tokens = await db.getTokens(accountId);
  if (!tokens) throw new Error('No tokens found for user.');

  const now = Math.floor(Date.now() / 1000);
  if (tokens.expires_at && tokens.expires_at > now + 300) {
    return tokens.access_token;
  }

  console.log('[Debug Fetch] Refreshing access token...');
  const postData = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
  }).toString();

  const options = {
    hostname: 'www.strava.com',
    path: '/api/v3/oauth/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const response = await makeRequest(options, postData);
  await db.saveTokens(accountId, {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: response.expires_at,
    athlete_id: response.athlete?.id || tokens.athlete_id,
    athlete_name: tokens.athlete_name,
    athlete_avatar: tokens.athlete_avatar,
    scope: response.scope || tokens.scope,
  });
  return response.access_token;
}

async function main() {
  // Hỗ trợ in trực tiếp dữ liệu JSON thô ra màn hình
  const args = process.argv.slice(2);
  if (args[0] === 'print' && args[1]) {
    const targetId = args[1];
    const outPath = path.join(__dirname, 'data', 'debug_json', `${targetId}.json`);
    if (fs.existsSync(outPath)) {
      console.log(fs.readFileSync(outPath, 'utf-8'));
    } else {
      console.error(`Lỗi: Không tìm thấy file JSON của hoạt động ${targetId} tại ${outPath}. Vui lòng chạy kịch bản để tải về trước.`);
    }
    return;
  }

  try {
    const database = await db.getDb();
    const user = await database.get('SELECT account_id, athlete_name FROM users ORDER BY id DESC LIMIT 1');
    if (!user) {
      console.error('Error: Không tìm thấy tài khoản Strava nào kết nối trong Database local/production.');
      return;
    }
    console.log(`Đang chạy truy vấn bằng tài khoản: ${user.athlete_name}`);
    const accessToken = await getAccessToken(user.account_id);
    const activityIds = [
      '18737074484', // Huawei
      '18421904355', // Generated 1
      '18811494196', // Generated 2
      '18864757554', // Apple Watch Series 5
      '18864751973', // Strava App
      '18864751850', // COROS PACE 3
      '18865043228', // Garmin Connect
      '18221159624'  // Real - Strava App
    ];
    const outputDir = path.join(__dirname, 'data', 'debug_json');
    fs.mkdirSync(outputDir, { recursive: true });

    const results = {};

    for (const id of activityIds) {
      console.log(`Đang tải chi tiết hoạt động ${id} từ Strava...`);
      const options = {
        hostname: 'www.strava.com',
        path: `/api/v3/activities/${id}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      };

      try {
        const response = await makeRequest(options);
        const outPath = path.join(outputDir, `${id}.json`);
        fs.writeFileSync(outPath, JSON.stringify(response, null, 2), 'utf-8');
        console.log(`  => Đã lưu vào: ${outPath}`);
        results[id] = response;
      } catch (err) {
        console.error(`  => Lỗi tải hoạt động ${id}:`, err.message);
      }
    }

    console.log('\n======================================================');
    console.log('📊 BẢNG SO SÁNH PHÂN TÍCH NHANH (QUYẾT ĐỊNH CHẤT LƯỢNG):');
    console.log('======================================================');
    for (const id of activityIds) {
      const act = results[id];
      if (!act) continue;
      console.log(`\n* Hoạt động [${id}] - Tên: "${act.name}"`);
      console.log(`  - device_name (Tên thiết bị): ${act.device_name || 'N/A (Không nhận dạng)'}`);
      console.log(`  - external_id (Định danh file): ${act.external_id || 'N/A'}`);
      console.log(`  - upload_id (Mã upload): ${act.upload_id || 'N/A'}`);
      console.log(`  - has_heartrate (Nhịp tim): ${act.has_heartrate}`);
      if (act.has_heartrate) {
        console.log(`    • Average HR: ${act.average_heartrate} bpm, Max HR: ${act.max_heartrate} bpm`);
      }
      console.log(`  - total_elevation_gain (Độ cao tích lũy): ${act.total_elevation_gain}m`);
      console.log(`  - splits (Số phân đoạn km): ${act.splits_metric ? act.splits_metric.length : 0}`);
    }
    console.log('\n======================================================');
    
  } catch (err) {
    console.error('Lỗi chạy kịch bản debug:', err);
  }
}

main();
