/**
 * ZoomControls - Zoom in/out buttons with level display
 */
export class ZoomControls {
  private container: HTMLElement;
  private zoomLevel: number = 3;
  private zoomInCallback: (() => void) | null = null;
  private zoomOutCallback: (() => void) | null = null;
  private zoomInBtn!: HTMLButtonElement;
  private zoomOutBtn!: HTMLButtonElement;
  private zoomLevelDisplay!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
    this.attachEvents();
  }

  private render(): void {
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

    this.zoomInBtn = this.container.querySelector('#zoom-in-btn')!;
    this.zoomOutBtn = this.container.querySelector('#zoom-out-btn')!;
    this.zoomLevelDisplay = this.container.querySelector('#zoom-level')!;
  }

  private attachEvents(): void {
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

  /**
   * Update the displayed zoom level
   */
  setZoomLevel(level: number): void {
    this.zoomLevel = level;
    if (this.zoomLevelDisplay) {
      this.zoomLevelDisplay.textContent = level.toFixed(1);
    }
  }

  /**
   * Register callback for zoom in button
   */
  onZoomIn(callback: () => void): void {
    this.zoomInCallback = callback;
  }

  /**
   * Register callback for zoom out button
   */
  onZoomOut(callback: () => void): void {
    this.zoomOutCallback = callback;
  }
}
