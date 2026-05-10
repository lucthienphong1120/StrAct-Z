const fs = require('fs');
const path = require('path');

// Read the raw file content
const rawPath = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\b6b74355-781f-42cf-8f91-e3e9fdb53d16\\.system_generated\\steps\\1185\\content.md';
const content = fs.readFileSync(rawPath, 'utf8');

// The file has a header "Source: ..." followed by "---"
const jsonPart = content.split('---')[1].trim();
const data = JSON.parse(jsonPart);

const geojson = {
  type: "FeatureCollection",
  features: data.level2s.map(l2 => ({
    type: "Feature",
    properties: {
      name: l2.name,
      id: l2.level2_id
    },
    geometry: {
      type: l2.type,
      coordinates: l2.coordinates
    }
  }))
};

const outputPath = path.join(__dirname, '..', 'public', 'geo', 'hanoi_full_districts.geojson');
fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

console.log(`Successfully converted to ${outputPath}`);
console.log(`Found ${geojson.features.length} districts.`);
