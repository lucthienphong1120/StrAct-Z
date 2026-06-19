const { Profile } = require('@garmin/fitsdk');
console.log('Profile.types.manufacturer keys/values:');
const manufacturerType = Profile.types.manufacturer;
if (manufacturerType) {
  for (const [key, value] of Object.entries(manufacturerType)) {
    if (key.toLowerCase().includes('strava')) {
      console.log(`Found in keys: ${key} = ${value}`);
    }
    if (String(value).toLowerCase().includes('strava') || String(key).toLowerCase().includes('strava')) {
      console.log(`Match: ${key} = ${value}`);
    }
  }
} else {
  console.log('Profile.types.manufacturer is not defined');
}
