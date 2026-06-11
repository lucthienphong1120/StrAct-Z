const { generateActivity } = require('./src/services/fit-generator');

const devices = [
  'Garmin Forerunner 965',
  'Garmin Forerunner 955',
  'Garmin Forerunner 745',
  'Garmin Forerunner 265',
  'Garmin Forerunner 255'
];

async function runTest() {
  console.log('--- STARTING FIT GENERATION TEST (100m) ---');
  for (const device of devices) {
    try {
      console.log(`Generating FIT for: ${device}...`);
      const result = await generateActivity({
        deviceName: device,
        minDistanceKm: 0.1,
        maxDistanceKm: 0.1,
        targetDistanceKm: 0.1,
        userRole: 'vip', // Use vip role to bypass 0.5km minimum limit
        activityType: 'Run',
        heartRateEnabled: true,
        useOSRM: true
      });
      console.log(`✅ Success! File saved to: ${result.filepath}`);
      console.log(`   - Activity Name: ${result.activityName}`);
      console.log(`   - Distance: ${result.distanceKm} km, Duration: ${result.durationMin} min\n`);
    } catch (error) {
      console.error(`❌ Failed for ${device}:`, error.message);
    }
  }
  console.log('--- TEST COMPLETED ---');
}

runTest();
