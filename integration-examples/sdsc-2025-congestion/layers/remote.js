import { fetchMap } from "@deck.gl/carto";
import { ADDITIVE_BLEND_PARAMETERS } from "./blending";

const cartoMapId = "039505cc-0c85-4142-a898-bdfcad66b187";

export async function fetchRemoteLayers() {
  if (!cartoMapId) {
    return [];
  }

  const { layers } = await fetchMap({ cartoMapId });

  if (location.host.includes("127.0.0.1")) {
    console.log(
      layers
        .map(
          (l) =>
            `${l.constructor.layerName} ${l.props.cartoLabel}: ${l.props.id}`
        )
        .join("\n")
    );
  }

  return layers.map((l) =>
    l.clone({
      parameters: { ...ADDITIVE_BLEND_PARAMETERS, depthTest: false },
    })
  );
}
