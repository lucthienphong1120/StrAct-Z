/**
 * GeoJSON and Geolocation Utilities for Hanoi Districts
 */

const fs = require('fs');
const path = require('path');
const { DISTRICTS } = require('../config/districts');

let cachedGeoJson = null;

/**
 * Load the Hanoi districts boundary GeoJSON file
 */
function loadGeoJson() {
  if (cachedGeoJson) return cachedGeoJson;
  try {
    const geojsonPath = path.join(__dirname, '..', '..', 'public', 'geo', 'hanoi_full_districts.geojson');
    if (fs.existsSync(geojsonPath)) {
      cachedGeoJson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
      console.log('[GeoJSON] Loaded Hanoi full districts boundaries successfully.');
    }
  } catch (err) {
    console.error('[GeoJSON] Failed to load district boundaries GeoJSON:', err.message);
  }
  return cachedGeoJson;
}

/**
 * Check if a coordinate point lies inside a polygon using ray-casting algorithm
 */
function isPointInPolygon(latitude, longitude, polygon) {
  const x = longitude;
  const y = latitude;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if a coordinate point lies inside a GeoJSON feature (Polygon or MultiPolygon)
 */
function isPointInFeature(lat, lng, feature) {
  const geom = feature.geometry;
  if (!geom) return false;

  if (geom.type === 'Polygon') {
    const rings = geom.coordinates;
    if (rings.length === 0) return false;
    if (!isPointInPolygon(lat, lng, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) {
      if (isPointInPolygon(lat, lng, rings[i])) return false;
    }
    return true;
  } else if (geom.type === 'MultiPolygon') {
    for (const polygon of geom.coordinates) {
      if (polygon.length === 0) continue;
      if (isPointInPolygon(lat, lng, polygon[0])) {
        let insideHole = false;
        for (let i = 1; i < polygon.length; i++) {
          if (isPointInPolygon(lat, lng, polygon[i])) {
            insideHole = true;
            break;
          }
        }
        if (!insideHole) return true;
      }
    }
  }
  return false;
}

/**
 * Find the district key for a given coordinate
 */
function getDistrictKeyForCoordinate(lat, lng) {
  const geojson = loadGeoJson();
  if (!geojson || !geojson.features) return null;

  for (const feature of geojson.features) {
    if (isPointInFeature(lat, lng, feature)) {
      const name = feature.properties && feature.properties.name;
      if (name) {
        const found = DISTRICTS.find(d => name.includes(d.name));
        if (found) return found.key;
      }
    }
  }
  return null;
}

/**
 * Get the bounding box of a GeoJSON feature
 */
function getFeatureBoundingBox(feature) {
  const geom = feature.geometry;
  if (!geom) return null;

  let coords = [];
  if (geom.type === 'Polygon') {
    coords = geom.coordinates.flat();
  } else if (geom.type === 'MultiPolygon') {
    coords = geom.coordinates.flat(2);
  }

  if (coords.length === 0) return null;

  let minLng = coords[0][0], maxLng = coords[0][0];
  let minLat = coords[0][1], maxLat = coords[0][1];

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Generate a random point inside the actual district polygon using ray-casting
 */
function getRandomPointInDistrict(districtKey) {
  const d = DISTRICTS.find(dist => dist.key === districtKey);
  if (!d) return null;

  const geojson = loadGeoJson();
  if (!geojson || !geojson.features) return null;

  // Find matching feature
  const feature = geojson.features.find(f => {
    const name = f.properties && f.properties.name;
    return name && name.includes(d.name);
  });

  if (!feature) return null;

  const bbox = getFeatureBoundingBox(feature);
  if (!bbox) return null;

  let lastLat = bbox.minLat + (bbox.maxLat - bbox.minLat) / 2;
  let lastLng = bbox.minLng + (bbox.maxLng - bbox.minLng) / 2;

  // Try up to 100 times to find a point inside the polygon
  for (let attempt = 0; attempt < 100; attempt++) {
    lastLat = bbox.minLat + Math.random() * (bbox.maxLat - bbox.minLat);
    lastLng = bbox.minLng + Math.random() * (bbox.maxLng - bbox.minLng);
    if (isPointInFeature(lastLat, lastLng, feature)) {
      return { lat: lastLat, lng: lastLng };
    }
  }

  // Fallback to a random bounding box point if all attempts fail
  return { lat: lastLat, lng: lastLng };
}

module.exports = {
  getDistrictKeyForCoordinate,
  getRandomPointInDistrict
};
