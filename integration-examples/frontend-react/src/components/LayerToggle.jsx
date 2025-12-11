/**
 * LayerToggle - Custom layer visibility toggle for React
 */
export function LayerToggle({ disabled = false, layers = [], onToggle }) {
  const handleChange = (layerId, event) => {
    if (!disabled && onToggle) {
      onToggle(layerId, event.target.checked);
    }
  };

  return (
    <div className="layer-toggle">
      <div className="layer-toggle-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
        <span>Layers</span>
      </div>
      <div className="layer-list">
        {layers.map((layer) => (
          <div key={layer.id} className="layer-item">
            <label className={`layer-checkbox-label ${disabled ? 'disabled' : ''}`}>
              <input
                type="checkbox"
                className="layer-checkbox"
                checked={layer.visible}
                disabled={disabled}
                onChange={(e) => handleChange(layer.id, e)}
              />
              <span
                className="layer-color"
                style={{ backgroundColor: layer.color || '#666' }}
              />
              <span className="layer-name">{layer.name}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
