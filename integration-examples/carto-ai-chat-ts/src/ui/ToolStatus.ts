/**
 * ToolStatus - Tool execution status overlay
 */
export class ToolStatus {
  private container: HTMLElement;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private statusBox!: HTMLElement;
  private statusIcon!: HTMLElement;
  private statusText!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="tool-status" id="tool-status-box" style="display: none;">
        <span class="tool-status-icon" id="tool-status-icon"></span>
        <span class="tool-status-text" id="tool-status-text"></span>
      </div>
    `;

    this.statusBox = this.container.querySelector('#tool-status-box')!;
    this.statusIcon = this.container.querySelector('#tool-status-icon')!;
    this.statusText = this.container.querySelector('#tool-status-text')!;
  }

  /**
   * Show status with icon, text, and styling
   */
  show(icon: string, text: string, className: string, duration: number = 3000): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    this.statusBox.className = `tool-status ${className}`;
    this.statusIcon.textContent = icon;
    this.statusText.textContent = text;
    this.statusBox.style.display = 'flex';

    if (duration > 0) {
      this.hideTimeout = setTimeout(() => {
        this.hide();
      }, duration);
    }
  }

  /**
   * Hide the status indicator
   */
  hide(): void {
    if (this.statusBox) {
      this.statusBox.style.display = 'none';
    }
  }

  /**
   * Show tool execution in progress
   */
  showToolExecution(toolName: string): void {
    const displayName = toolName
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    this.show('\u26A1', `Executing: ${displayName}...`, 'tool-status-executing', 0);
  }

  /**
   * Show success message
   */
  showSuccess(message: string): void {
    this.show('\u2713', message, 'tool-status-success', 3000);
  }

  /**
   * Show error message
   */
  setError(message: string): void {
    this.show('\u2717', message, 'tool-status-error', 5000);
  }
}
