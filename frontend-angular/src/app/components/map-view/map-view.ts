import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { DeckMapService } from '../../services/deck-map.service';
import { Deck } from '@deck.gl/core';

@Component({
  selector: 'app-map-view',
  imports: [],
  templateUrl: './map-view.html',
  styleUrl: './map-view.css',
})
export class MapView implements OnInit, OnDestroy {
  @Output() deckInit = new EventEmitter<Deck>();

  constructor(private deckMapService: DeckMapService) {}

  async ngOnInit(): Promise<void> {
    const deck = await this.deckMapService.initialize('map-container', 'map-container-canvas');
    this.deckInit.emit(deck);
  }

  ngOnDestroy(): void {
    this.deckMapService.destroy();
  }
}
