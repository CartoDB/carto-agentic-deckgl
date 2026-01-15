/**
 * ToolStatus - Enhanced tool execution status overlay with error details and retry
 */
export class ToolStatus {
  private container: HTMLElement;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private statusBox!: HTMLElement;
  private statusIcon!: HTMLElement;
  private statusText!: HTMLElement;
  private detailsElement!: HTMLElement;
  private retryButton!: HTMLElement;
  private lastExecutedTool: string | null = null;
  private retryCallback: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="tool-status" id="tool-status-box" style="display: none;">
        <div class="tool-status-main">
          <span class="tool-status-icon" id="tool-status-icon"></span>
          <span class="tool-status-text" id="tool-status-text"></span>
        </div>
        <div class="tool-status-details" id="tool-status-details" style="display: none;"></div>
        <button class="tool-status-retry" id="tool-status-retry" style="display: none;">
          Retry
        </button>
      </div>
    `;

    this.statusBox = this.container.querySelector('#tool-status-box')!;
    this.statusIcon = this.container.querySelector('#tool-status-icon')!;
    this.statusText = this.container.querySelector('#tool-status-text')!;
    this.detailsElement = this.container.querySelector('#tool-status-details')!;
    this.retryButton = this.container.querySelector('#tool-status-retry')!;

    // Attach retry button event
    this.retryButton.addEventListener('click', () => {
      if (this.retryCallback) {
        this.retryCallback();
        this.hide();
      }
    });
  }

  /**
   * Show status with icon, text, and styling
   */
  show(
    icon: string,
    text: string,
    className: string,
    duration: number = 3000,
    details?: string,
    showRetry: boolean = false
  ): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    this.statusBox.className = `tool-status ${className}`;
    this.statusIcon.textContent = icon;
    this.statusText.textContent = text;

    // Handle details
    if (details) {
      this.detailsElement.textContent = details;
      this.detailsElement.style.display = 'block';
    } else {
      this.detailsElement.style.display = 'none';
    }

    // Handle retry button
    if (showRetry && className === 'tool-status-error') {
      this.retryButton.style.display = 'inline-block';
    } else {
      this.retryButton.style.display = 'none';
    }

    this.statusBox.style.display = 'flex';

    if (duration > 0 && !showRetry) {
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
    this.detailsElement.style.display = 'none';
    this.retryButton.style.display = 'none';
  }

  /**
   * Clear any active status immediately
   */
  clear(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    this.hide();
  }

  /**
   * Show tool execution in progress
   */
  showToolExecution(toolName: string): void {
    this.lastExecutedTool = toolName;
    const displayName = this.formatToolName(toolName);
    this.show('\u26A1', `Executing: ${displayName}...`, 'tool-status-executing', 0);
  }

  /**
   * Show success message with execution time
   */
  showSuccess(message: string, executionTime?: number): void {
    let displayMessage = message;
    if (executionTime !== undefined) {
      displayMessage += ` (${executionTime}ms)`;
    }
    this.show('\u2713', displayMessage, 'tool-status-success', 3000);
  }

  /**
   * Show warning message
   */
  showWarning(message: string, details?: string): void {
    this.show('\u26A0', message, 'tool-status-warning', 4000, details);
  }

  /**
   * Show error message with details and optional retry
   */
  setError(message: string, details?: string, canRetry: boolean = false): void {
    // Parse error message for more details
    const errorDetails = this.parseErrorDetails(message, details);
    const duration = canRetry ? 0 : 5000; // Don't auto-hide if retry is available

    this.show(
      '\u2717',
      errorDetails.summary,
      'tool-status-error',
      duration,
      errorDetails.details,
      canRetry
    );
  }

  /**
   * Set retry callback for error recovery
   */
  setRetryCallback(callback: () => void): void {
    this.retryCallback = callback;
  }

  /**
   * Format tool name for display
   */
  private formatToolName(toolName: string): string {
    return toolName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Parse error details for better display
   */
  private parseErrorDetails(message: string, details?: string): {
    summary: string;
    details?: string;
  } {
    // Extract key error info
    if (message.includes('Failed to')) {
      const match = message.match(/Failed to (.+?):/);
      if (match) {
        return {
          summary: `Failed to ${match[1]}`,
          details: details || message.substring(match.index! + match[0].length).trim()
        };
      }
    }

    // Handle network errors
    if (message.includes('Network') || message.includes('fetch')) {
      return {
        summary: 'Network error',
        details: details || 'Check your connection and try again'
      };
    }

    // Handle parsing errors
    if (message.includes('parse') || message.includes('JSON')) {
      return {
        summary: 'Invalid response format',
        details: details || 'The server response could not be processed'
      };
    }

    // Default
    return {
      summary: message.length > 50 ? message.substring(0, 50) + '...' : message,
      details: details || (message.length > 50 ? message : undefined)
    };
  }

  /**
   * Get the last executed tool name
   */
  getLastExecutedTool(): string | null {
    return this.lastExecutedTool;
  }
}