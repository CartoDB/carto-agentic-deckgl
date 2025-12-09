import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapToolsService } from '../../services/map-tools.service';
import { TOOL_NAMES } from '@carto/maps-ai-tools';

interface LayerConfig {
  id: string;
  name: string;
  visible: boolean;
}

@Component({
  selector: 'app-layer-toggle',
  imports: [CommonModule],
  templateUrl: './layer-toggle.html',
  styleUrl: './layer-toggle.css',
})
export class LayerToggle {
  @Input() disabled: boolean = false;

  layers: LayerConfig[] = [
    { id: 'points-layer', name: 'Airports', visible: true }
  ];

  constructor(private mapToolsService: MapToolsService) {}

  async toggleLayer(layer: LayerConfig): Promise<void> {
    if (!this.mapToolsService.isInitialized()) return;

    const newVisibility = !layer.visible;
    const result = await this.mapToolsService.execute(TOOL_NAMES.TOGGLE_LAYER, {
      layerName: layer.id,
      visible: newVisibility
    });

    if (result.success) {
      layer.visible = newVisibility;
    }
  }
}
