/**
 * ZoomControls - Custom zoom control buttons
 */
export class ZoomControls {
  constructor(container) {
    this.container = container;
    this.zoomLevel = 10;
    this.zoomInCallback = null;
    this.zoomOutCallback = null;
    this.render();
    this.attachEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="zoom-controls">
        <button class="zoom-btn zoom-in-btn" id="zoom-in-btn" title="Zoom in">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <div class="zoom-level" id="zoom-level">${this.zoomLevel.toFixed(1)}</div>
        <button class="zoom-btn zoom-out-btn" id="zoom-out-btn" title="Zoom out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    `;

    this.zoomInBtn = this.container.querySelector('#zoom-in-btn');
    this.zoomOutBtn = this.container.querySelector('#zoom-out-btn');
    this.zoomLevelDisplay = this.container.querySelector('#zoom-level');
  }

  attachEvents() {
    this.zoomInBtn.addEventListener('click', () => {
      if (this.zoomInCallback) {
        this.zoomInCallback();
      }
    });

    this.zoomOutBtn.addEventListener('click', () => {
      if (this.zoomOutCallback) {
        this.zoomOutCallback();
      }
    });
  }

  setZoomLevel(level) {
    this.zoomLevel = level;
    if (this.zoomLevelDisplay) {
      this.zoomLevelDisplay.textContent = level.toFixed(1);
    }
  }

  onZoomIn(callback) {
    this.zoomInCallback = callback;
  }

  onZoomOut(callback) {
    this.zoomOutCallback = callback;
  }
}
