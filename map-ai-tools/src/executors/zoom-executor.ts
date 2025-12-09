import { ToolExecutor } from '../core/types';

interface ZoomParams {
  direction: 'in' | 'out';
  levels?: number;
}

export const executeZoom: ToolExecutor<ZoomParams> = (params, context) => {
  const { direction, levels = 1 } = params;
  const { deck, map } = context;

  try {
    // Get current view state from deck props
    const viewState: any = (deck as any).viewState || (deck as any).props.initialViewState;
    const currentZoom = viewState.zoom || 10;

    // Calculate new zoom level
    let newZoom: number;
    if (direction === 'in') {
      newZoom = currentZoom + levels;
    } else if (direction === 'out') {
      newZoom = Math.max(0, currentZoom - levels);
    } else {
      return {
        success: false,
        message: 'Invalid zoom direction',
        error: new Error('Direction must be "in" or "out"')
      };
    }

    const newViewState = {
      ...viewState,
      zoom: newZoom,
      transitionDuration: 1000,
      transitionInterruption: 1
    };

    // Update deck.gl view state with animation
    deck.setProps({ initialViewState: newViewState });

    // Sync MapLibre if map instance is available
    if (map) {
      map.jumpTo({
        center: [viewState.longitude, viewState.latitude],
        zoom: newZoom,
        bearing: viewState.bearing || 0,
        pitch: viewState.pitch || 0
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
      message: `Zoomed ${direction} by ${levels} level(s)`,
      data: { direction, levels, newZoom }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to execute zoom',
      error: error as Error
    };
  }
};
