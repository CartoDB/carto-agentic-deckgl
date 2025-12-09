/**
 * ToolStatus - Tool execution status overlay
 */
export class ToolStatus {
  constructor(container) {
    this.container = container;
    this.hideTimeout = null;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="tool-status" id="tool-status-box" style="display: none;">
        <span class="tool-status-icon" id="tool-status-icon"></span>
        <span class="tool-status-text" id="tool-status-text"></span>
      </div>
    `;

    this.statusBox = this.container.querySelector('#tool-status-box');
    this.statusIcon = this.container.querySelector('#tool-status-icon');
    this.statusText = this.container.querySelector('#tool-status-text');
  }

  show(icon, text, className, duration = 3000) {
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

  hide() {
    if (this.statusBox) {
      this.statusBox.style.display = 'none';
    }
  }

  showToolExecution(toolName) {
    const displayName = toolName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    this.show('⚡', `Executing: ${displayName}...`, 'tool-status-executing', 0);
  }

  showSuccess(message) {
    this.show('✓', message, 'tool-status-success', 3000);
  }

  setError(message) {
    this.show('✗', message, 'tool-status-error', 5000);
  }
}
