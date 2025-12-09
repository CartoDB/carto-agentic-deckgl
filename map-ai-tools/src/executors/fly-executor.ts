import { ToolExecutor } from '../core/types';

interface FlyToParams {
  lat: number;
  lng: number;
  zoom?: number;
}

export const executeFlyTo: ToolExecutor<FlyToParams> = (params, context) => {
  const { lat, lng, zoom = 12 } = params;
  const { deck, map } = context;

  try {
    // Validate coordinate values
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return {
        success: false,
        message: 'Coordinates must be numbers',
        error: new Error('Invalid coordinate types')
      };
    }

    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return {
        success: false,
        message: 'Coordinates out of valid range',
        error: new Error('Longitude must be between -180 and 180, latitude between -90 and 90')
      };
    }

    // Update deck.gl view state with animation
    deck.setProps({
      initialViewState: {
        longitude: lng,
        latitude: lat,
        zoom,
        transitionDuration: 1000,
        transitionInterruption: 1
      }
    });

    // Sync MapLibre if map instance is available
    if (map) {
      map.flyTo({
        center: [lng, lat],
        zoom,
        duration: 1000
      });
    }

    // Force redraws to ensure visibility (browser-only)
    if (typeof window !== 'undefined' && (window as any).requestAnimationFrame) {
      (window as any).requestAnimationFrame(() => deck.redraw());
      setTimeout(() => deck.redraw(), 50);
      setTimeout(() => deck.redraw(), 1100);
    }

    return {
      success: true,
      message: `Flew to coordinates [${lng.toFixed(4)}, ${lat.toFixed(4)}] at zoom ${zoom}`,
      data: { lat, lng, zoom }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to fly to location',
      error: error as Error
    };
  }
};
