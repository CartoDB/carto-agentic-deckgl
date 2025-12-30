import { GeoJsonLayer } from "@deck.gl/layers";
import { FADE_IN_COLOR } from "./transitions";
import GlowingPathLayer from "./glowing-path-layer";
import { ADDITIVE_BLEND_PARAMETERS } from "./blending";

export const CongestionZoneMaskLayer = new GeoJsonLayer({
  id: "congestion-zone-mask",
  data: "/data/congestion-zone-inverted.geojson",
  stroked: false,
  filled: true,
  getFillColor: [0, 0, 0, 140],
  parameters: {
    depthCompare: "always",
  },
  transitions: FADE_IN_COLOR,
});

export const CongestionZoneLayer = new GeoJsonLayer({
  id: "congestion-zone",
  data: "/data/congestion-zone.json",
  dataTransform: (d) => {
    const polygon = d.map((item) => ({
      type: "Feature",
      geometry: item.polygon,
      properties: {},
    }));
    return polygon;
  },
  stroked: true,
  filled: true,
  lineWidthMinPixels: 10,
  getFillColor: [0, 0, 0, 40],
  getLineColor: [0, 128, 255, 255],
  getLineWidth: 50,
  _subLayerProps: {
    "polygons-fill": {
      parameters: {
        depthCompare: "always",
      },
    },
    "polygons-stroke": {
      type: GlowingPathLayer,
      parameters: ADDITIVE_BLEND_PARAMETERS,
    },
  },
  transitions: FADE_IN_COLOR,
});
