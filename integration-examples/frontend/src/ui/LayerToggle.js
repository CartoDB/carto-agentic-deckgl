/**
 * LayerToggle - Custom layer visibility toggle
 */
export class LayerToggle {
  constructor(container) {
    this.container = container;
    this.layers = [];
    this.toggleCallback = null;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="layer-toggle">
        <div class="layer-toggle-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          <span>Layers</span>
        </div>
        <div class="layer-list" id="layer-list"></div>
      </div>
    `;

    this.layerList = this.container.querySelector('#layer-list');
  }

  setLayers(layers) {
    this.layers = layers;
    this.renderLayers();
  }

  renderLayers() {
    if (!this.layerList) return;

    this.layerList.innerHTML = this.layers.map(layer => `
      <div class="layer-item" data-layer-id="${layer.id}">
        <label class="layer-checkbox-label">
          <input
            type="checkbox"
            class="layer-checkbox"
            ${layer.visible ? 'checked' : ''}
            data-layer-id="${layer.id}"
          />
          <span class="layer-color" style="background-color: ${layer.color || '#666'}"></span>
          <span class="layer-name">${layer.name}</span>
        </label>
      </div>
    `).join('');

    // Attach event listeners
    this.layerList.querySelectorAll('.layer-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const layerId = e.target.dataset.layerId;
        const visible = e.target.checked;
        if (this.toggleCallback) {
          this.toggleCallback(layerId, visible);
        }
      });
    });
  }

  updateLayerVisibility(layerId, visible) {
    const layer = this.layers.find(l => l.id === layerId);
    if (layer) {
      layer.visible = visible;
    }
    const checkbox = this.layerList?.querySelector(`input[data-layer-id="${layerId}"]`);
    if (checkbox) {
      checkbox.checked = visible;
    }
  }

  onToggle(callback) {
    this.toggleCallback = callback;
  }
}
