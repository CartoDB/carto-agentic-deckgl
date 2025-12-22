import json

# Load all region data
with open('/Users/felixpalmer/git/sdsc-2025-congestion/data/nyc-boroughs.geojson') as f:
    boroughs = json.load(f)

with open('/Users/felixpalmer/git/sdsc-2025-congestion/data/bergen-county.geojson') as f:
    bergen = json.load(f)

with open('/Users/felixpalmer/git/sdsc-2025-congestion/data/metro-region.geojson') as f:
    metro = json.load(f)

# Find specific boroughs
manhattan = next(f for f in boroughs['features'] if f['properties']['boro_name'] == 'Manhattan')
bronx = next(f for f in boroughs['features'] if f['properties']['boro_name'] == 'Bronx')

# Set improvement properties
manhattan['properties'] = {
    'name': 'Manhattan',
    'improvement': 25
}

bronx['properties'] = {
    'name': 'Bronx',
    'improvement': 10
}

bergen['features'][0]['properties'] = {
    'name': 'Bergen County',
    'improvement': 14
}

metro['features'][0]['properties'] = {
    'name': 'Metro Region',
    'improvement': 9
}

# Combine into single FeatureCollection (metro first so it renders behind)
combined = {
    'type': 'FeatureCollection',
    'features': [
        #metro['features'][0],
        bergen['features'][0],
        bronx,
        manhattan
    ]
}

# Save combined dataset
with open('/Users/felixpalmer/git/sdsc-2025-congestion/data/regional-improvements.geojson', 'w') as f:
    json.dump(combined, f)

print('Created regional-improvements.geojson with 4 regions')
