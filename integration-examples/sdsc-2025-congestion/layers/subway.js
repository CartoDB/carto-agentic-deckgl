import { GeoJsonLayer } from "@deck.gl/layers";
import { FADE_IN_COLOR } from "./transitions";
import GlowingPathLayer from "./glowing-path-layer";
import { ADDITIVE_BLEND_PARAMETERS } from "./blending";

// Convert hex color to RGB
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [128, 128, 128];
};

const subwayProps = {
  data: "/data/subway-routes.json",
  stroked: true,
  getLineColor: (d) => hexToRgb(d.properties.cc),
  getLineWidth: 20,
  lineWidthMinPixels: 6,
  transitions: FADE_IN_COLOR,
};

export const SubwayLayer = new GeoJsonLayer({
  id: "subway",
  ...subwayProps,
  _subLayerProps: {
    linestrings: {
      type: GlowingPathLayer,
      parameters: {
        ...ADDITIVE_BLEND_PARAMETERS,
        depthCompare: "less-equal",
      },
    },
  },
});

export const SubwayShadowLayer = new GeoJsonLayer({
  id: "subway-shadow",
  ...subwayProps,
  opacity: 0.02,
  _subLayerProps: {
    linestrings: {
      type: GlowingPathLayer,
      parameters: {
        ...ADDITIVE_BLEND_PARAMETERS,
        depthCompare: "greater",
      },
    },
  },
});
