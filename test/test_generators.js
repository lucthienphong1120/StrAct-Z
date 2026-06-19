const fs = require('fs');
const path = require('path');
const { Decoder, Stream } = require('@garmin/fitsdk');
const fitGenerator = require('../src/services/fit-generator');
const gpxGenerator = require('../src/services/gpx-generator');

async function testFitGenerator() {
  console.log('--- Testing FIT Generator for Strava App ---');
  try {
    const config = {
      deviceName: 'Strava App',
      activityType: 'Run',
      minDistanceKm: 1.0,
      maxDistanceKm: 1.5,
      startTime: new Date(),
      useOSRM: false, // Don't make external network calls for simple structural test
    };

    const result = await fitGenerator.generateActivity(config);
    console.log(`Generated FIT file: ${result.filename}`);
    
    // Parse the generated FIT file to check manufacturer and product
    const fitFilePath = result.filepath;
    const fileBuffer = fs.readFileSync(fitFilePath);
    const stream = Stream.fromBuffer(fileBuffer);
    const decoder = new Decoder(stream);
    const { messages, errors } = decoder.read();

    if (errors && errors.length > 0) {
      console.error('FIT decoder errors:', errors);
    }

    const fileIdMesg = messages.fileIdMesgs ? messages.fileIdMesgs[0] : null;
    if (fileIdMesg) {
      console.log('File ID Message properties:');
      console.log(`  Manufacturer: ${fileIdMesg.manufacturer} (Expected: 265/strava)`);
      console.log(`  Product: ${fileIdMesg.product} (Expected: 102)`);
      
      const success = (fileIdMesg.manufacturer === 265 || fileIdMesg.manufacturer === 'strava') && fileIdMesg.product === 102;
      if (success) {
        console.log('✅ FIT Generator test passed! Strava App correctly configured.');
      } else {
        console.error('❌ FIT Generator test failed: Incorrect manufacturer or product ID.');
        process.exit(1);
      }
    } else {
      console.error('❌ FIT Generator test failed: No fileId message found in FIT file.');
      process.exit(1);
    }

    // Clean up test file
    fs.unlinkSync(fitFilePath);
  } catch (err) {
    console.error('❌ Error during FIT generator test:', err);
    process.exit(1);
  }
}

async function testGpxGenerator() {
  console.log('\n--- Testing GPX Generator for Strava App ---');
  try {
    const config = {
      deviceName: 'Strava App',
      activityType: 'Run',
      minDistanceKm: 1.0,
      maxDistanceKm: 1.5,
      startTime: new Date(),
      useOSRM: false, // Don't make external network calls for simple structural test
    };

    const result = await gpxGenerator.generateActivity(config);
    console.log(`Generated GPX file: ${result.filename}`);
    
    const gpxContent = fs.readFileSync(result.filepath, 'utf8');
    
    // Check creator attribute
    const creatorMatch = gpxContent.match(/creator="([^"]+)"/);
    if (creatorMatch) {
      const creator = creatorMatch[1];
      console.log(`GPX creator attribute: "${creator}" (Expected: "Strava Android App")`);
      if (creator === 'Strava Android App') {
        console.log('✅ GPX Generator test passed! Creator correctly configured.');
      } else {
        console.error('❌ GPX Generator test failed: Incorrect creator attribute.');
        process.exit(1);
      }
    } else {
      console.error('❌ GPX Generator test failed: Could not find creator attribute in GPX header.');
      process.exit(1);
    }

    // Clean up test file
    fs.unlinkSync(result.filepath);
  } catch (err) {
    console.error('❌ Error during GPX generator test:', err);
    process.exit(1);
  }
}

async function main() {
  await testFitGenerator();
  await testGpxGenerator();
  console.log('\nAll tests completed successfully!');
}

main();
