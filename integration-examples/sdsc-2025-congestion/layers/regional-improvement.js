import { GeoJsonLayer } from "@deck.gl/layers";
import { FADE_IN_COLOR } from "./transitions";
import GlowingPathLayer from "./glowing-path-layer";
import { ADDITIVE_BLEND_PARAMETERS } from "./blending";

const getImprovementColor = (improvement) => {
  if (improvement >= 20) return [0, 128, 0]; // Dark green
  if (improvement >= 15) return [0, 200, 0]; // Green
  if (improvement >= 10) return [173, 255, 47]; // Yellow-green
  return [255, 255, 0]; // Yellow
};

export const RegionalImprovementLayer = new GeoJsonLayer({
  id: "regional-improvement",
  data: "/data/regional-improvements.geojson",
  filled: true,
  stroked: true,
  getFillColor: (d) => {
    const color = getImprovementColor(d.properties.improvement);
    return [color[0], color[1], color[2], 60];
  },
  getLineColor: (d) => getImprovementColor(d.properties.improvement),
  lineWidthMinPixels: 7,
  _subLayerProps: {
    "polygons-stroke": {
      type: GlowingPathLayer,
      parameters: {
        ...ADDITIVE_BLEND_PARAMETERS,
        depthCompare: "always",
      },
    },
  },
  parameters: {
    depthCompare: "always",
  },
  transitions: FADE_IN_COLOR,
});
