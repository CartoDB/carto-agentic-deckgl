import { ToolExecutor } from '../core/types';

interface ToggleLayerParams {
  layer_id: string;
  visible: boolean;
}

export const executeToggleLayer: ToolExecutor<ToggleLayerParams> = (params, context) => {
  const { layer_id, visible } = params;
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

    // Find the layer to toggle
    const layerFound = currentLayers.some((layer: any) => layer && layer.id === layer_id);

    if (!layerFound) {
      return {
        success: false,
        message: `Layer "${layer_id}" not found`,
        error: new Error(`Unknown layer: ${layer_id}`)
      };
    }

    // Update layers with toggled visibility
    const updatedLayers = currentLayers.map((layer: any) => {
      if (layer && layer.id === layer_id) {
        return layer.clone({ visible });
      }
      return layer;
    });

    deck.setProps({ layers: updatedLayers });

    return {
      success: true,
      message: visible ? `Showed ${layer_id}` : `Hid ${layer_id}`,
      data: { layer_id, visible }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to toggle layer',
      error: error as Error
    };
  }
};
