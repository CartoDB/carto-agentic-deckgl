import { ToolExecutor } from '../core/types';

interface ToggleLayerParams {
  layerName: string;
  visible: boolean;
}

// Layer name to ID mapping
const LAYER_NAME_MAP: Record<string, string> = {
  'airports': 'points-layer',
  'points': 'points-layer',
  'points-layer': 'points-layer'
};

export const executeToggleLayer: ToolExecutor<ToggleLayerParams> = (params, context) => {
  const { layerName, visible } = params;
  const { deck } = context;

  try {
    // Get current layers
    const currentLayers: any = deck.props.layers;

    if (!Array.isArray(currentLayers)) {
      return {
        success: false,
        message: 'No layers found on deck',
        error: new Error('Deck has no layers')
      };
    }

    // Find layer ID by name (case-insensitive)
    const normalizedName = layerName.toLowerCase();
    const layerId = LAYER_NAME_MAP[normalizedName];

    if (!layerId) {
      // Try to find by direct ID match
      const directMatch = currentLayers.find((layer: any) =>
        layer && layer.id.toLowerCase() === normalizedName
      );
      if (!directMatch) {
        return {
          success: false,
          message: `Layer "${layerName}" not found`,
          error: new Error(`Unknown layer: ${layerName}`)
        };
      }
    }

    const targetLayerId = layerId || normalizedName;

    // Find the layer to toggle
    const layerFound = currentLayers.some((layer: any) => layer && layer.id === targetLayerId);

    if (!layerFound) {
      return {
        success: false,
        message: `Layer "${layerName}" not found`,
        error: new Error(`Unknown layer: ${layerName}`)
      };
    }

    // Update layers with toggled visibility
    const updatedLayers = currentLayers.map((layer: any) => {
      if (layer && layer.id === targetLayerId) {
        return layer.clone({ visible });
      }
      return layer;
    });

    deck.setProps({ layers: updatedLayers });

    return {
      success: true,
      message: `Layer "${layerName}" ${visible ? 'shown' : 'hidden'}`,
      data: { layerName, visible }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to toggle layer',
      error: error as Error
    };
  }
};
