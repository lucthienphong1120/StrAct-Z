const db = require('../src/db/database');

async function main() {
  const dbInstance = await db.getDb();
  
  console.log("=== RECENT ACTIVITIES ===");
  const activities = await dbInstance.all("SELECT id, account_id, created_at, activity_name, upload_status, error_message, created_by, route_start_time FROM activities ORDER BY id DESC LIMIT 20");
  console.table(activities);
  
  console.log("\n=== USER CONFIGS ===");
  const userConfigs = await dbInstance.all("SELECT account_id, key, value FROM user_config WHERE key LIKE 'schedule%' OR key = 'daily_max_activity' OR key = 'role'");
  console.table(userConfigs);
  
  console.log("\n=== ACCOUNTS ===");
  const accounts = await dbInstance.all("SELECT id, username, role FROM accounts");
  console.table(accounts);
}

main().catch(console.error);
