import GlowingTripsLayer from "./glowing-trips-layer";
import { FADE_IN_COLOR } from "./transitions";
import { ADDITIVE_BLEND_PARAMETERS } from "./blending";

const DATA_URL =
  "https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/trips/trips-v7.json";

const trafficProps = {
  data: DATA_URL,
  dataTransform: (data) => {
    const shiftedData = data.map(({ path, timestamps, vendor }) => ({
      path,
      timestamps: timestamps.map((t) => (t + 500) % 1080),
      vendor,
    }));
    // Double up data to fill map more
    return [...data, ...shiftedData];
  },
  getPath: (d, info) => {
    // Add fake heights to avoid z-fighting
    const { index } = info;
    const height = (0.02 * index) % 10;
    return d.path.map((p) => [p[0], p[1], height]);
  },
  getTimestamps: (d) => d.timestamps,
  opacity: 0.8,
  widthMinPixels: 8,
  rounded: true,
  trailLength: 100,
  currentTime: 0,
  transitions: FADE_IN_COLOR,
  parameters: ADDITIVE_BLEND_PARAMETERS,
};

export const TrafficBeforeLayer = new GlowingTripsLayer({
  id: "traffic-before",
  getColor: [255, 255, 0], // Bright yellow for congested
  ...trafficProps,
});

export const TrafficAfterLayer = new GlowingTripsLayer({
  id: "traffic-after",
  getColor: [255, 20, 147], // Bright pink for improved
  ...trafficProps,
});
