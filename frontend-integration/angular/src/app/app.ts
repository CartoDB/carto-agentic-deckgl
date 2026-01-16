/**
 * App Component
 *
 * Main application component using JSONConverter-based architecture.
 * Initializes map with CARTO POI layer via DeckState.
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MapView } from './components/map-view/map-view';
import { ChatUi } from './components/chat-ui/chat-ui';
import { ZoomControls } from './components/zoom-controls/zoom-controls';
import { LayerToggle } from './components/layer-toggle/layer-toggle';
import { SnackbarComponent } from './components/snackbar/snackbar';
import { MapAIToolsService } from './services/map-ai-tools.service';
import { DeckMapService, ViewState } from './services/deck-map.service';
import { DeckStateService } from './state/deck-state.service';
import { ConsolidatedExecutorsService } from './services/consolidated-executors.service';
import { environment } from '../environments/environment';
import {
  Message,
  MapInstances,
  LoaderState,
  LayerConfig,
  SnackbarConfig,
} from './models/message.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MapView, ChatUi, ZoomControls, LayerToggle, SnackbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  // State
  messages: Message[] = [];
  isConnected: boolean = false;
  loaderState: LoaderState = null;
  loaderMessage: string = '';
  zoomLevel: number = 3;
  layers: LayerConfig[] = [];
  snackbar: SnackbarConfig = { message: null, type: 'error' };

  private mapInstances: MapInstances | null = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private aiToolsService: MapAIToolsService,
    private deckMapService: DeckMapService,
    private deckState: DeckStateService,
    private executorsService: ConsolidatedExecutorsService
  ) {}

  ngOnInit(): void {
    // Connect to WebSocket
    this.aiToolsService.connect();

    // Subscribe to state observables
    this.subscriptions.push(
      this.aiToolsService.isConnected$.subscribe((c) => (this.isConnected = c)),
      this.aiToolsService.messages$.subscribe((m) => (this.messages = m)),
      this.aiToolsService.loaderState$.subscribe((s) => (this.loaderState = s)),
      this.aiToolsService.loaderMessage$.subscribe((m) => (this.loaderMessage = m)),
      this.aiToolsService.error$.subscribe((err) => this.showSnackbar(err)),
      this.aiToolsService.layers$.subscribe((l) => (this.layers = l))
    );

    // Initialize POI layer if CARTO credentials are configured
    this.initializePoiLayer();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.deckMapService.destroy();
  }

  /**
   * Initialize POI layer via DeckState
   */
  private initializePoiLayer(): void {
    if (!environment.accessToken) {
      console.warn('[App] No CARTO access token configured. Skipping POI layer.');
      return;
    }

    const poiLayerSpec = {
      '@@type': 'VectorTileLayer',
      id: 'pois',
      data: {
        '@@function': 'vectorTableSource',
        tableName: 'carto-demo-data.demo_tables.osm_pois_usa'
      },
      pickable: true,
      opacity: 1,
      getFillColor: [3, 111, 226],
      getLineColor: [255, 255, 255],
      getPointRadius: 50,
      getLineWidth: 10,
      pointRadiusMinPixels: 1,
      lineWidthMinPixels: 0.3,
      visible: true
    };

    // Set initial deck config with POI layer
    this.deckState.setDeckConfig({
      layers: [poiLayerSpec],
      widgets: [],
      effects: []
    });

    console.log('[App] POI layer initialized');
  }

  handleMapInit(instances: MapInstances): void {
    this.mapInstances = instances;
    console.log('[App] Map initialized');

    // Force redraw after init
    this.deckMapService.redraw();
  }

  handleViewStateChange(viewState: ViewState): void {
    this.zoomLevel = viewState.zoom;
  }

  handleSendMessage(content: string): void {
    this.aiToolsService.sendMessage(content);
  }

  async handleZoomIn(): Promise<void> {
    const currentView = this.deckState.getViewState();
    const newZoom = Math.min(22, (currentView.zoom ?? 3) + 1);

    await this.executorsService.execute('set-map-view', {
      latitude: currentView.latitude,
      longitude: currentView.longitude,
      zoom: newZoom,
      pitch: currentView.pitch ?? 0,
      bearing: currentView.bearing ?? 0
    });
  }

  async handleZoomOut(): Promise<void> {
    const currentView = this.deckState.getViewState();
    const newZoom = Math.max(0, (currentView.zoom ?? 3) - 1);

    await this.executorsService.execute('set-map-view', {
      latitude: currentView.latitude,
      longitude: currentView.longitude,
      zoom: newZoom,
      pitch: currentView.pitch ?? 0,
      bearing: currentView.bearing ?? 0
    });
  }

  async handleLayerToggle(event: { layerId: string; visible: boolean }): Promise<void> {
    // Update layer visibility in DeckState
    const currentLayers = this.deckState.getLayers();
    const updatedLayers = currentLayers.map(layer => {
      if (layer['id'] === event.layerId) {
        return { ...layer, visible: event.visible };
      }
      return layer;
    });

    this.deckState.setLayers(updatedLayers);
    console.log(`[App] Layer "${event.layerId}" visibility set to ${event.visible}`);
  }

  showSnackbar(message: string, type: 'error' | 'info' | 'success' = 'error'): void {
    this.snackbar = { message, type };
  }

  hideSnackbar(): void {
    this.snackbar = { message: null, type: 'error' };
  }

  get controlsDisabled(): boolean {
    return !this.isConnected || !this.mapInstances;
  }
}
