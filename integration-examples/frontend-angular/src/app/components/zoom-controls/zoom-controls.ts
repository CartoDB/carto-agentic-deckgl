import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapToolsService } from '../../services/map-tools.service';
import { TOOL_NAMES } from '@carto/maps-ai-tools';

@Component({
  selector: 'app-zoom-controls',
  imports: [CommonModule],
  templateUrl: './zoom-controls.html',
  styleUrl: './zoom-controls.css',
})
export class ZoomControls {
  @Input() disabled: boolean = false;

  constructor(private mapToolsService: MapToolsService) {}

  async zoomIn(): Promise<void> {
    if (this.mapToolsService.isInitialized()) {
      await this.mapToolsService.execute(TOOL_NAMES.ZOOM_MAP, { direction: 'in', levels: 1 });
    }
  }

  async zoomOut(): Promise<void> {
    if (this.mapToolsService.isInitialized()) {
      await this.mapToolsService.execute(TOOL_NAMES.ZOOM_MAP, { direction: 'out', levels: 1 });
    }
  }
}
