const db = require('./src/db/database');

async function run() {
  try {
    const dbInstance = await db.getDb();
    
    console.log('--- Accounts ---');
    const accounts = await dbInstance.all('SELECT id, username, role, created_at FROM accounts');
    console.log(JSON.stringify(accounts, null, 2));

    for (const acc of accounts) {
      console.log(`\n--- Config for Account ${acc.id} (${acc.username}) ---`);
      const config = await db.getAllConfig(acc.id);
      console.log(JSON.stringify(config, null, 2));

      console.log(`\n--- Recent Activities for Account ${acc.id} ---`);
      const activities = await dbInstance.all(
        'SELECT id, created_at, activity_name, distance_km, upload_status, error_message, route_start_time, created_by FROM activities WHERE account_id = ? ORDER BY id DESC LIMIT 15',
        [acc.id]
      );
      console.log(JSON.stringify(activities, null, 2));
    }
  } catch (err) {
    console.error('Diagnostic error:', err);
  } finally {
    await db.closeDb();
  }
}

run();
