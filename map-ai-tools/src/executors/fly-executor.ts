import { ToolExecutor } from '../core/types';

interface FlyToParams {
  coordinates: [number, number];
  zoom?: number;
}

export const executeFlyTo: ToolExecutor<FlyToParams> = (params, context) => {
  const { coordinates, zoom = 10 } = params;
  const { deck } = context;

  try {
    // Validate coordinates
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      return {
        success: false,
        message: 'Invalid coordinates format. Expected [longitude, latitude]',
        error: new Error('Coordinates must be an array of two numbers')
      };
    }

    const [longitude, latitude] = coordinates;

    // Validate coordinate values
    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
      return {
        success: false,
        message: 'Coordinates must be numbers',
        error: new Error('Invalid coordinate types')
      };
    }

    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      return {
        success: false,
        message: 'Coordinates out of valid range',
        error: new Error('Longitude must be between -180 and 180, latitude between -90 and 90')
      };
    }

    // Update view state with animation
    deck.setProps({
      initialViewState: {
        longitude,
        latitude,
        zoom,
        transitionDuration: 1000,
        transitionInterruption: 1
      }
    });

    // Force redraws to ensure visibility (browser-only)
    if (typeof window !== 'undefined' && (window as any).requestAnimationFrame) {
      (window as any).requestAnimationFrame(() => deck.redraw());
      setTimeout(() => deck.redraw(), 50);
      setTimeout(() => deck.redraw(), 1100);
    }

    return {
      success: true,
      message: `Flew to coordinates [${longitude.toFixed(4)}, ${latitude.toFixed(4)}]`,
      data: { coordinates, zoom }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to fly to location',
      error: error as Error
    };
  }
};
