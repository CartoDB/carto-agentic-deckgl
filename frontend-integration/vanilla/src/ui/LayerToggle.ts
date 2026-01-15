/**
 * LayerToggle - Layer visibility control panel
 */

export interface LayerInfo {
  id: string;
  name: string;
  visible: boolean;
  color?: string;
  loading?: boolean;  // New field for loading state
  loadingMessage?: string;  // Optional loading message
}

export class LayerToggle {
  private container: HTMLElement;
  private layers: LayerInfo[] = [];
  private toggleCallback: ((layerId: string, visible: boolean) => void) | null =
    null;
  private layerList!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  private render(): void {
    // Add CSS for loading states if not already added
    if (!document.querySelector('#layer-loading-styles')) {
      const style = document.createElement('style');
      style.id = 'layer-loading-styles';
      style.textContent = `
        .layer-loading-indicator {
          margin-left: 8px;
          font-size: 0.85em;
          color: #666;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .layer-spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid #e0e0e0;
          border-top: 2px solid #036fe2;
          border-radius: 50%;
          animation: layer-spin 1s linear infinite;
        }

        @keyframes layer-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .layer-loading .layer-checkbox {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .layer-loading .layer-checkbox-label {
          opacity: 0.9;
        }

        .loading-text {
          font-size: 0.9em;
          color: #666;
        }
      `;
      document.head.appendChild(style);
    }

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

    this.layerList = this.container.querySelector('#layer-list')!;
  }

  /**
   * Set the available layers
   */
  setLayers(layers: LayerInfo[]): void {
    this.layers = layers;
    this.renderLayers();
  }

  /**
   * Get the current layers
   */
  getLayers(): LayerInfo[] {
    return [...this.layers]; // Return a copy to avoid mutations
  }

  private renderLayers(): void {
    if (!this.layerList) return;

    this.layerList.innerHTML = this.layers
      .map(
        (layer) => `
      <div class="layer-item ${layer.loading ? 'layer-loading' : ''}" data-layer-id="${layer.id}">
        <label class="layer-checkbox-label">
          <input
            type="checkbox"
            class="layer-checkbox"
            ${layer.visible ? 'checked' : ''}
            ${layer.loading ? 'disabled' : ''}
            data-layer-id="${layer.id}"
          />
          <span class="layer-color" style="background-color: ${layer.color || '#666'}"></span>
          <span class="layer-name">
            ${layer.name}
            ${layer.loading ? `
              <span class="layer-loading-indicator">
                <span class="layer-spinner"></span>
                <span class="loading-text">${layer.loadingMessage || 'Loading tiles...'}</span>
              </span>
            ` : ''}
          </span>
        </label>
      </div>
    `
      )
      .join('');

    // Attach event listeners
    this.layerList.querySelectorAll('.layer-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        const layerId = target.dataset.layerId;
        const visible = target.checked;
        if (layerId && this.toggleCallback) {
          this.toggleCallback(layerId, visible);
        }
      });
    });
  }

  /**
   * Update a layer's visibility state
   */
  updateLayerVisibility(layerId: string, visible: boolean): void {
    const layer = this.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.visible = visible;
    }
    const checkbox = this.layerList?.querySelector(
      `input[data-layer-id="${layerId}"]`
    ) as HTMLInputElement | null;
    if (checkbox) {
      checkbox.checked = visible;
    }
  }

  /**
   * Register callback for layer toggle events
   */
  onToggle(callback: (layerId: string, visible: boolean) => void): void {
    this.toggleCallback = callback;
  }
}
