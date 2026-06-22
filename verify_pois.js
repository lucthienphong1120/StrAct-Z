/**
 * StrAct Z - Hanoi POIs Verification Script
 * 
 * This script performs 3 key verification checks:
 * 1. Checks if all POIs in docs/HANOI_POIS.md are defined in src/services/route-engine.js.
 * 2. Checks if all POIs in src/services/route-engine.js are documented in docs/HANOI_POIS.md.
 * 3. Uses point-in-polygon ray-casting with public/geo/hanoi_full_districts.geojson to verify
 *    if the coordinates of each POI actually fall inside the geographic boundary of its declared district.
 * 
 * Usage: node verify_pois.js
 */

const fs = require('fs');
const path = require('path');

const { DISTRICTS } = require('./src/config/districts');
const geoUtils = require('./src/utils/geo');
const { getDistrictKeyForCoordinate } = geoUtils;

// 1. Resolve paths
const routeEnginePath = path.join(__dirname, 'src', 'services', 'route-engine.js');
const poisMdPath = path.join(__dirname, 'docs', 'HANOI_POIS.md');
const geojsonPath = path.join(__dirname, 'public', 'geo', 'hanoi_full_districts.geojson');

console.log('=== StrAct Z: Hanoi POIs Cross-Mapping & Boundary Test ===\n');

// 2. Load and parse route-engine.js POIs
if (!fs.existsSync(routeEnginePath)) {
  console.error(`[FAIL] route-engine.js not found at: ${routeEnginePath}`);
  process.exit(1);
}
const routeEngineContent = fs.readFileSync(routeEnginePath, 'utf8');
const match = routeEngineContent.match(/const RUNNING_POIS = ({[\s\S]*?});/);
if (!match) {
  console.error('[FAIL] Could not find RUNNING_POIS declaration in route-engine.js');
  process.exit(1);
}

let RUNNING_POIS;
try {
  RUNNING_POIS = eval(`(${match[1]})`);
} catch (e) {
  console.error('[FAIL] Failed to parse RUNNING_POIS object:', e.message);
  process.exit(1);
}

const codePoisFlat = [];
for (const [key, list] of Object.entries(RUNNING_POIS)) {
  for (const poi of list) {
    codePoisFlat.push({ ...poi, districtKey: key });
  }
}
console.log(`[INFO] Loaded ${codePoisFlat.length} POIs from src/services/route-engine.js`);

// 3. Load and parse docs/HANOI_POIS.md
if (!fs.existsSync(poisMdPath)) {
  console.error(`[FAIL] HANOI_POIS.md not found at: ${poisMdPath}`);
  process.exit(1);
}
const poisMdContent = fs.readFileSync(poisMdPath, 'utf8');
const mdLines = poisMdContent.split('\n');

// Regex to capture markdown lines: "*   **POI Name** - `lat, lng`"
const mdPoiRegex = /\*\s+\*\*([^*]+)\*\*\s*-\s*`([^`]+)`/;
const mdPois = [];

const districtMap = {};
DISTRICTS.forEach(d => {
  districtMap[d.name.toLowerCase()] = d.key;
});

let currentDistrictKey = null;
for (const line of mdLines) {
  // Check if it's a district header, e.g. "## 📍 Hoàn Kiếm"
  const headerMatch = line.match(/^##\s+📍\s+(.+)$/);
  if (headerMatch) {
    const districtName = headerMatch[1].trim();
    currentDistrictKey = districtMap[districtName.toLowerCase()] || null;
    continue;
  }

  const poiMatch = line.match(mdPoiRegex);
  if (poiMatch && currentDistrictKey) {
    const name = poiMatch[1].trim();
    const coordsStr = poiMatch[2].trim();
    
    // Parse coordinates
    const coordParts = coordsStr.split(',');
    if (coordParts.length === 2) {
      const lat = parseFloat(coordParts[0].trim());
      const lng = parseFloat(coordParts[1].trim());
      
      // Clean name from custom notations
      let cleanName = name;
      if (name.includes(' (Hưng Yên - Giáp Gia Lâm)')) {
        cleanName = 'Khu đô thị Ecopark';
      }

      mdPois.push({
        name: cleanName,
        fullNameInMd: name,
        lat,
        lng,
        districtKey: currentDistrictKey
      });
    }
  }
}
console.log(`[INFO] Loaded ${mdPois.length} POIs from docs/HANOI_POIS.md`);

// 4. Verify cross-mappings
let failCount = 0;

console.log('\n--- Checking 1:1 matching between Code and HANOI_POIS.md ---');

// Check if all md POIs are defined in code
const missingInCode = [];
for (const mdPoi of mdPois) {
  const matchInCode = codePoisFlat.find(p => 
    Math.abs(p.lat - mdPoi.lat) < 0.0001 && 
    Math.abs(p.lng - mdPoi.lng) < 0.0001 &&
    p.districtKey === mdPoi.districtKey
  );
  if (!matchInCode) {
    missingInCode.push(mdPoi);
  }
}

if (missingInCode.length > 0) {
  failCount += missingInCode.length;
  console.error(`[FAIL] Found ${missingInCode.length} POIs in HANOI_POIS.md that are missing or mismatched in route-engine.js:`);
  missingInCode.forEach(p => {
    console.error(`  - "${p.fullNameInMd}" at (${p.lat}, ${p.lng}) under district key "${p.districtKey}"`);
  });
} else {
  console.log('[PASS] All POIs in HANOI_POIS.md are correctly mapped in route-engine.js.');
}

// Check if all code POIs are documented in md
const missingInMd = [];
for (const codePoi of codePoisFlat) {
  const matchInMd = mdPois.find(p => 
    Math.abs(p.lat - codePoi.lat) < 0.0001 && 
    Math.abs(p.lng - codePoi.lng) < 0.0001 &&
    p.districtKey === codePoi.districtKey
  );
  if (!matchInMd) {
    missingInMd.push(codePoi);
  }
}

if (missingInMd.length > 0) {
  failCount += missingInMd.length;
  console.error(`[FAIL] Found ${missingInMd.length} POIs in route-engine.js that are missing or mismatched in HANOI_POIS.md:`);
  missingInMd.forEach(p => {
    console.error(`  - "${p.name}" at (${p.lat}, ${p.lng}) under district key "${p.districtKey}"`);
  });
} else {
  console.log('[PASS] All POIs in route-engine.js are correctly documented in HANOI_POIS.md.');
}

// 5. Verify actual district boundaries via GeoJSON Ray-Casting
console.log('\n--- Checking coordinates against GeoJSON District boundaries ---');

if (!fs.existsSync(geojsonPath)) {
  console.error(`[FAIL] GeoJSON boundary file not found at: ${geojsonPath}`);
  process.exit(1);
}

const boundaryMismatches = [];
const outsideAllBoundaries = [];

for (const codePoi of codePoisFlat) {
  const resolvedKey = getDistrictKeyForCoordinate(codePoi.lat, codePoi.lng);
  
  if (!resolvedKey) {
    // Ecopark is expected to fall outside Hanoi boundaries
    if (codePoi.name.includes('Ecopark')) {
      console.log(`[WARN] "${codePoi.name}" falls outside Hanoi boundaries (located in Hưng Yên province - OK)`);
      continue;
    }
    outsideAllBoundaries.push(codePoi);
  } else if (resolvedKey !== codePoi.districtKey) {
    boundaryMismatches.push({
      poi: codePoi,
      resolvedKey
    });
  }
}

if (boundaryMismatches.length > 0) {
  failCount += boundaryMismatches.length;
  console.error(`[FAIL] Found ${boundaryMismatches.length} POIs whose coordinates fall inside a different district boundary:`);
  boundaryMismatches.forEach(item => {
    console.error(`  - "${item.poi.name}" at (${item.poi.lat}, ${item.poi.lng}) is declared in "${item.poi.districtKey}" but falls inside "${item.resolvedKey}" boundary.`);
  });
} else {
  console.log('[PASS] All POIs coordinates correctly match their declared district boundary.');
}

if (outsideAllBoundaries.length > 0) {
  failCount += outsideAllBoundaries.length;
  console.error(`[FAIL] Found ${outsideAllBoundaries.length} POIs whose coordinates fall outside ALL district boundaries:`);
  outsideAllBoundaries.forEach(poi => {
    console.error(`  - "${poi.name}" at (${poi.lat}, ${poi.lng}) declared in "${poi.districtKey}"`);
  });
}

// 6. Final Report
console.log('\n=== Final Verification Report ===');
if (failCount === 0) {
  console.log('✅ ALL TESTS PASSED SUCCESSFULLY! POIs configuration is 100% consistent and accurate.');
  process.exit(0);
} else {
  console.error(`❌ VERIFICATION FAILED! Found ${failCount} issues. Please fix them.`);
  process.exit(1);
}
