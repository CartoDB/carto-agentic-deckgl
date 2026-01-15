import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayerConfig } from '../../models/message.model';

/**
 * LayerToggle - Layer visibility toggles with color indicators
 * Updated to use Input/Output pattern like React
 */
@Component({
  selector: 'app-layer-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './layer-toggle.html',
  styleUrl: './layer-toggle.css',
})
export class LayerToggle {
  @Input() disabled: boolean = false;
  @Input() layers: LayerConfig[] = [];
  @Output() toggle = new EventEmitter<{ layerId: string; visible: boolean }>();

  onToggle(layer: LayerConfig, event: Event): void {
    if (this.disabled) return;
    const checkbox = event.target as HTMLInputElement;
    this.toggle.emit({ layerId: layer.id, visible: checkbox.checked });
  }

  trackByLayer(index: number, layer: LayerConfig): string {
    return layer.id;
  }
}
