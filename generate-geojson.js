// Script to generate US city points with accurate coordinates
const fs = require('fs');
const path = require('path');

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

// City data with accurate coordinates
const cityData = [
  { name: 'New York', coordinates: [-74.0060, 40.7128], population: 8336817 },
  { name: 'Los Angeles', coordinates: [-118.2437, 34.0522], population: 3979576 },
  { name: 'Chicago', coordinates: [-87.6298, 41.8781], population: 2693976 },
  { name: 'Houston', coordinates: [-95.3698, 29.7604], population: 2320268 },
  { name: 'Phoenix', coordinates: [-112.0740, 33.4484], population: 1680992 },
  { name: 'Philadelphia', coordinates: [-75.1652, 39.9526], population: 1584064 },
  { name: 'San Antonio', coordinates: [-98.4936, 29.4241], population: 1547253 },
  { name: 'San Diego', coordinates: [-117.1611, 32.7157], population: 1423851 },
  { name: 'Dallas', coordinates: [-96.7970, 32.7767], population: 1343573 },
  { name: 'Austin', coordinates: [-97.7431, 30.2672], population: 978908 },
  { name: 'Seattle', coordinates: [-122.3321, 47.6062], population: 753675 },
  { name: 'Denver', coordinates: [-104.9903, 39.7392], population: 715522 },
  { name: 'Boston', coordinates: [-71.0589, 42.3601], population: 692600 },
  { name: 'Portland', coordinates: [-122.6765, 45.5152], population: 652503 },
  { name: 'Miami', coordinates: [-80.1918, 25.7617], population: 467963 },
  { name: 'Atlanta', coordinates: [-84.3880, 33.7490], population: 498715 },
  { name: 'San Francisco', coordinates: [-122.4194, 37.7749], population: 873965 },
  { name: 'Detroit', coordinates: [-83.0458, 42.3314], population: 670031 },
  { name: 'Nashville', coordinates: [-86.7816, 36.1627], population: 689447 },
  { name: 'Las Vegas', coordinates: [-115.1398, 36.1699], population: 641903 }
];

const features = cityData.map((city, i) => ({
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: city.coordinates
  },
  properties: {
    id: i + 1,
    name: city.name,
    population: city.population
  }
}));

const geojson = {
  type: 'FeatureCollection',
  features
};

const outputPath = path.join(__dirname, 'frontend', 'public', 'data', 'us-points.geojson');
fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
console.log(`✓ Generated ${outputPath} with 20 random US cities`);
