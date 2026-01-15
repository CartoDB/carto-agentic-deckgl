/**
 * Application constants and configuration
 */

// WebSocket configuration
export const WS_URL = 'ws://localhost:3000/ws';

// Redraw timing delays (in milliseconds)
export const REDRAW_DELAYS = {
  immediate: 0,
  short: 50,
  transition: 600,
  flyTo: 1100,
};

// Default layer styling
export const DEFAULT_LAYER_COLOR = [200, 0, 80, 180];
export const DEFAULT_POINT_SIZE = 8;

// Layer name mapping for case-insensitive lookups
export const LAYER_NAME_MAP = {
  airports: 'points-layer',
  points: 'points-layer',
  'points-layer': 'points-layer',
};

// View state defaults
export const DEFAULT_VIEW_STATE = {
  longitude: -98.5795,
  latitude: 39.8283,
  zoom: 3.5,
  pitch: 0,
  bearing: 0,
};

// Zoom constraints
export const ZOOM_LIMITS = {
  min: 0,
  max: 22,
};

// Transition durations
export const TRANSITION_DURATIONS = {
  flyTo: 1000,
  zoom: 500,
};
