import json

# Load congestion zone data
with open('/Users/felixpalmer/git/sdsc-2025-congestion/data/congestion-zone.json') as f:
    zones = json.load(f)

# Extract all polygon coordinates as holes
holes = []
for zone in zones:
    polygon = zone['polygon']
    if polygon['type'] == 'Polygon':
        # Each polygon's coordinates are [exterior_ring, ...holes]
        # We want just the exterior ring to use as a hole in our outer polygon
        holes.append(polygon['coordinates'][0])

# Create outer boundary covering USA (rough bounding box)
# West to East: -125 to -66, South to North: 24 to 50
outer_ring = [
    [-125, 24],
    [-66, 24],
    [-66, 50],
    [-125, 50],
    [-125, 24]
]

# Create polygon with holes
inverted_polygon = {
    "type": "Feature",
    "properties": {},
    "geometry": {
        "type": "Polygon",
        "coordinates": [outer_ring] + holes
    }
}

# Save as GeoJSON
output = {
    "type": "FeatureCollection",
    "features": [inverted_polygon]
}

with open('/Users/felixpalmer/git/sdsc-2025-congestion/data/congestion-zone-inverted.geojson', 'w') as f:
    json.dump(output, f)

print('Created congestion-zone-inverted.geojson')
