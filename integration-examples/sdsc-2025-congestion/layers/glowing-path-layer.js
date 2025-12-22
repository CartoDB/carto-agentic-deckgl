import { PathLayer } from "@deck.gl/layers";

export default class GlowingPathLayer extends PathLayer {
  static layerName = "GlowingPathLayer";

  getShaders() {
    const shaders = super.getShaders();
    shaders.inject = {
      "fs:#main-end": `
      if (bool(picking.isActive)) return;

      // Highlight middle of line
      float fromCenter = abs(geometry.uv.x);
      float glow = smoothstep(0.05, 0.5, fromCenter);
      fragColor.rgb = mix(vec3(1.0), fragColor.rgb, 0.3 + 0.7 * glow); // Center white highlight

      // Gaussian blur edge for glow
      float sigma = 1.0 / 3.0;
      float a = -0.5 / (sigma * sigma);
      float w0 = 0.3989422804014327 / sigma;
      float t = fromCenter;
      float weight = w0 * exp(a * t * t);
      fragColor.a *= weight;

      if (fragColor.a < 0.01) {
        discard;
      }
      `,
    };

    return shaders;
  }
}
