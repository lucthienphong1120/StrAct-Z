const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/geo/hanoi_urban_districts.geojson', 'utf8'));

const results = data.features.map(f => {
  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
  
  // Handle MultiPolygon or Polygon
  const coords = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.flat(2) : f.geometry.coordinates.flat(1);
  
  coords.forEach(p => {
    const lng = p[0];
    const lat = p[1];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  
  return {
    name: f.properties.name,
    lat: ((minLat + maxLat) / 2).toFixed(4),
    lng: ((minLng + maxLng) / 2).toFixed(4),
    minLat, maxLat, minLng, maxLng
  };
});

console.log(JSON.stringify(results, null, 2));
