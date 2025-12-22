import { TripsLayer } from "@deck.gl/geo-layers";

export default class GlowingTripsLayer extends TripsLayer {
  static layerName = "GlowingTripsLayer";

  getShaders() {
    const shaders = super.getShaders();

    // Add glow effect after the base TripsLayer shader logic
    const originalInject = shaders.inject || {};
    shaders.inject = {
      ...originalInject,
      "fs:#main-end": `
      ${originalInject["fs:#main-end"] || ""}

      if (bool(picking.isActive)) return;

      // Store the original alpha from trail fade
      float originalAlpha = fragColor.a;
      float fromStart = (trips.currentTime - vTime) / trips.trailLength;

      // Highlight middle of line
      float bulgeSize = 5.0;
      float bulge = smoothstep(0.02, 0.0, fromStart) * smoothstep(0.0, 0.04, fromStart);
      float fromCenter = max(abs(geometry.uv.x) - bulgeSize * bulge, 0.0);
      float glow = smoothstep(0.05, 0.5, fromCenter);
      fragColor.rgb = mix(vec3(1.0), fragColor.rgb, 0.7 + 0.3 * glow); // Center white highlight

      // Gaussian blur edge for glow
      float sigma = 1.0 / 3.0;
      float a = -0.5 / (sigma * sigma);
      float w0 = 0.3989422804014327 / sigma;
      float t = fromCenter;
      float weight = w0 * exp(a * t * t);

      // Apply glow while preserving trail fade
      fragColor.a = originalAlpha * weight;

      if (fragColor.a < 0.01) {
        discard;
      }
      `,
    };

    return shaders;
  }
}
