/**
 * Loading indicator component for showing AI processing and tool execution states
 */

export type LoadingState = null | 'thinking' | 'executing';

export class LoadingIndicator {
  private container: HTMLElement;
  private element: HTMLElement;
  private messageElement: HTMLElement;
  private dotsElement: HTMLElement;
  private animationInterval: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.element = this.createElement();
    this.messageElement = this.element.querySelector('.loading-message')!;
    this.dotsElement = this.element.querySelector('.loading-dots')!;
    this.hide();
  }

  private createElement(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'loading-indicator';
    element.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 12 12"
                to="360 12 12"
                dur="1s"
                repeatCount="indefinite"
              />
            </path>
          </svg>
        </div>
        <span class="loading-message">AI is processing</span>
        <span class="loading-dots">...</span>
      </div>
    `;

    this.container.appendChild(element);
    return element;
  }

  /**
   * Show the loading indicator with the specified state
   */
  show(state: 'thinking' | 'executing', toolName?: string): void {
    this.element.style.display = 'flex';

    // Clear any existing animation
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }

    if (state === 'thinking') {
      this.messageElement.textContent = 'AI is processing';
      this.dotsElement.style.display = 'inline';
      this.startDotsAnimation();
      this.element.classList.remove('loading-executing');
      this.element.classList.add('loading-thinking');
    } else if (state === 'executing') {
      this.messageElement.textContent = toolName
        ? `Executing: ${toolName}`
        : 'Executing tool';
      this.dotsElement.style.display = 'none';
      this.element.classList.remove('loading-thinking');
      this.element.classList.add('loading-executing');
    }
  }

  /**
   * Hide the loading indicator
   */
  hide(): void {
    this.element.style.display = 'none';
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }

  /**
   * Update loading state
   */
  setState(state: LoadingState, toolName?: string): void {
    if (state === null) {
      this.hide();
    } else {
      this.show(state, toolName);
    }
  }

  /**
   * Animate the dots for thinking state
   */
  private startDotsAnimation(): void {
    let dots = 0;
    this.animationInterval = window.setInterval(() => {
      dots = (dots + 1) % 4;
      this.dotsElement.textContent = '.'.repeat(dots || 1);
    }, 500);
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }
    this.element.remove();
  }
}

export default LoadingIndicator;