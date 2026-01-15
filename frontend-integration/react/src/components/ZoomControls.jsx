/**
 * ZoomControls - Custom zoom control buttons for React
 */
export function ZoomControls({ disabled = false, zoomLevel = 10, onZoomIn, onZoomOut }) {
  return (
    <div className="zoom-controls">
      <button
        className="zoom-btn zoom-in-btn"
        onClick={onZoomIn}
        disabled={disabled}
        title="Zoom in"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      <div className="zoom-level">{zoomLevel.toFixed(1)}</div>
      <button
        className="zoom-btn zoom-out-btn"
        onClick={onZoomOut}
        disabled={disabled}
        title="Zoom out"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
  );
}
