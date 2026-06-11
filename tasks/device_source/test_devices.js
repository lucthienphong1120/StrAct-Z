const path = require('path');
const fs = require('fs');
const { generateActivity } = require('../../src/services/fit-generator');
const systemLimits = require('../../src/config/limits');

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'tmp', 'fit-testcase');

async function runTest() {
  console.log('--- STARTING BULK FIT GENERATION TEST (100m) ---');
  
  // Create output directory if not exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
  }

  // Get devices choices list from limits.js
  const devices = systemLimits.device_name.choices || [];
  console.log(`Found ${devices.length} devices in configuration limits.`);

  let successCount = 0;
  let failCount = 0;

  for (const device of devices) {
    try {
      console.log(`Generating FIT for: ${device}...`);
      
      // Clean up/slugify device name for filename
      const safeFilename = device
        .toLowerCase()
        .replace(/★/g, '')
        .trim()
        .replace(/[^a-z0-9]+/g, '_') + '.fit';
        
      const outputPath = path.join(OUTPUT_DIR, safeFilename);

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

      // Save to tmp testcase folder
      fs.writeFileSync(outputPath, result.fitBuffer);
      
      console.log(`✅ Success! Saved to: ${outputPath}`);
      console.log(`   - Model Name resolved: ${device}`);
      console.log(`   - Distance: ${result.distanceKm} km, Duration: ${result.durationMin} min\n`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed for ${device}:`, error.stack || error.message);
      failCount++;
    }
  }

  console.log('--- TEST COMPLETED ---');
  console.log(`Total Successes: ${successCount}`);
  console.log(`Total Failures: ${failCount}`);
  console.log(`All files outputted to: ${OUTPUT_DIR}`);
}

runTest();
