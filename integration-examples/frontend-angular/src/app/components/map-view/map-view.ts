import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { DeckMapService } from '../../services/deck-map.service';
import { MapInstances } from '../../models/message.model';

@Component({
  selector: 'app-map-view',
  imports: [],
  templateUrl: './map-view.html',
  styleUrl: './map-view.css',
})
export class MapView implements OnInit, OnDestroy {
  @Output() mapInit = new EventEmitter<MapInstances>();

  constructor(private deckMapService: DeckMapService) {}

  async ngOnInit(): Promise<void> {
    const { deck, map } = await this.deckMapService.initialize('map-container', 'map-container-canvas');
    this.mapInit.emit({ deck, map });
  }

  ngOnDestroy(): void {
    this.deckMapService.destroy();
  }
}
