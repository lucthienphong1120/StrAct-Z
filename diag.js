/**
 * StrAct Z - Diagnostic script for troubleshooting daily target distance calculation
 * Run this on the server with: node diag.js
 */

const db = require('./src/db/database');
const stravaApi = require('./src/services/strava-api');

async function check() {
  const accounts = await db.getAllAccounts();
  if (accounts.length === 0) {
    console.log("No accounts found in DB!");
    return;
  }
  const accountId = accounts[0].id;
  console.log("=== ACCOUNT INFO ===");
  console.log("Account ID:", accountId);
  console.log("Username:", accounts[0].username);
  console.log("Role:", accounts[0].role);

  const config = await db.getAllConfig(accountId);
  console.log("\n=== CONFIGURATION ===");
  console.log("target_distance_enabled:", config.target_distance_enabled);
  console.log("target_distance_km:", config.target_distance_km);
  console.log("schedule_count:", config.schedule_count);
  console.log("schedule_time:", config.schedule_time);
  console.log("schedule_time_2:", config.schedule_time_2);
  console.log("min_distance_km:", config.min_distance_km);
  console.log("max_distance_km:", config.max_distance_km);

  const targetDate = new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Ho_Chi_Minh'});
  console.log("\n=== TODAY TARGET DATE ===");
  console.log("Date string (Asia/Ho_Chi_Minh):", targetDate);

  const localActivities = await db.getActivitiesByDate(accountId, targetDate);
  console.log(`\n=== LOCAL DB ACTIVITIES TODAY (${localActivities.length}) ===`);
  localActivities.forEach(act => {
    console.log(`- ID: ${act.id}, Name: ${act.activity_name}, Distance: ${act.distance_km}km, Status: ${act.upload_status}, Start: ${act.route_start_time}`);
  });

  // Query failed activities in the last 7 days
  const dbInstance = await db.getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);
  const cutoffStr = cutoffDate.toISOString();
  const recentFailed = await dbInstance.all(
    `SELECT * FROM activities 
     WHERE account_id = ? 
       AND upload_status = 'failed' 
       AND created_at >= ? 
     ORDER BY id DESC`,
    [accountId, cutoffStr]
  );
  
  console.log(`\n=== FAILED ACTIVITIES IN LAST 7 DAYS (${recentFailed.length}) ===`);
  recentFailed.forEach(act => {
    console.log(`- ID: ${act.id}, Name: ${act.activity_name}, Created At: ${act.created_at}, Error: ${act.error_message}, Route Start: ${act.route_start_time}`);
  });

  let stravaActivities = [];
  if (await stravaApi.isAuthenticated(accountId)) {
    try {
      const after = Math.floor(new Date(`${targetDate}T00:00:00.000+07:00`).getTime() / 1000) - 1;
      stravaActivities = await stravaApi.getActivities(accountId, 1, 50, after, true);
      stravaActivities = stravaActivities.filter(a => (a.start_date_local || a.start_date).startsWith(targetDate));
      console.log(`\n=== STRAVA ACTIVITIES TODAY (${stravaActivities.length}) ===`);
      stravaActivities.forEach(a => {
        console.log(`- ID: ${a.id}, Name: ${a.name}, Distance: ${(a.distance / 1000).toFixed(2)}km, Start: ${a.start_date}, StartLocal: ${a.start_date_local}`);
      });
    } catch (e) {
      console.warn("Strava fetch failed:", e.message);
    }
  } else {
    console.log("Not authenticated with Strava!");
  }

  // Deduplication Simulation
  console.log("\n=== NEW DEDUPLICATION SIMULATION (10m tolerance) ===");
  let newAccumulated = 0;
  const newSeen = [];
  const existingActivities = [...localActivities, ...stravaActivities];

  for (const act of existingActivities) {
    const startTime = act.start_date || act.route_start_time;
    if (!startTime) continue;
    const startMs = new Date(startTime).getTime();
    
    let isDuplicate = false;
    for (const seenMs of newSeen) {
      if (Math.abs(seenMs - startMs) < 10 * 60 * 1000) {
        isDuplicate = true;
        break;
      }
    }
    
    let dist = 0;
    let type = act.distance_km !== undefined ? 'Local' : 'Strava';
    if (act.distance_km !== undefined) {
      if (act.upload_status === 'uploaded') dist = parseFloat(act.distance_km);
    } else if (act.distance !== undefined) {
      dist = parseFloat(act.distance) / 1000;
    }

    console.log(`Processing ${type} activity (Start: ${new Date(startMs).toISOString()}):`);
    console.log(`  - Duplicate: ${isDuplicate}`);
    console.log(`  - Distance: ${dist} km`);

    if (!isDuplicate && dist > 0) {
      newAccumulated += dist;
      newSeen.push(startMs);
      console.log(`  -> ADDED. New sum: ${newAccumulated.toFixed(2)} km`);
    } else {
      console.log(`  -> SKIPPED.`);
    }
  }

  console.log("\n=== SUMMARY ===");
  const dailyTarget = parseFloat(config.target_distance_km || '10.0');
  console.log(`Daily Target: ${dailyTarget} km`);
  console.log(`NEW Accumulated: ${newAccumulated.toFixed(2)} km (Remaining: ${(dailyTarget - newAccumulated).toFixed(2)} km)`);
}

check().catch(console.error);
