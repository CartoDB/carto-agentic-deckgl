/**
 * Location Pin Configuration
 *
 * SVG icon and layer spec generator for the location pin marker.
 * Used to display a pin on the map when flying to a location.
 */

import { LayerSpec } from '../state/deck-state.service';

/**
 * Location pin layer ID constant
 */
export const LOCATION_PIN_LAYER_ID = 'location-pin';

/**
 * Location pin SVG as a data URL
 * Classic map marker pin design with a drop shadow effect
 */
export const LOCATION_PIN_SVG_DATA_URL = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <path d="M24 4C16.268 4 10 10.268 10 18c0 10.5 14 26 14 26s14-15.5 14-26c0-7.732-6.268-14-14-14z" fill="#333333"/>
    <path d="M24 4C16.268 4 10 10.268 10 18c0 10.5 14 26 14 26s14-15.5 14-26c0-7.732-6.268-14-14-14z" fill="none" stroke="#666666" stroke-width="1.5"/>
    <circle cx="24" cy="18" r="6" fill="#FFFFFF"/>
  </g>
</svg>
`.trim())}`;

/**
 * Creates an IconLayer spec for the location pins
 * Accepts an array of locations to display multiple pins simultaneously
 */
export function createLocationPinLayerSpec(
  locations: Array<{ longitude: number; latitude: number }>
): LayerSpec {
  return {
    '@@type': 'IconLayer',
    id: LOCATION_PIN_LAYER_ID,
    data: locations.map(loc => ({ coordinates: [loc.longitude, loc.latitude] })),
    getPosition: '@@=coordinates',
    iconAtlas: LOCATION_PIN_SVG_DATA_URL,
    iconMapping: {
      marker: {
        x: 0,
        y: 0,
        width: 48,
        height: 48,
        anchorY: 48
      }
    },
    getIcon: '@@="marker"',
    getSize: 48,
    sizeScale: 1,
    pickable: true,
    visible: true
  };
}
