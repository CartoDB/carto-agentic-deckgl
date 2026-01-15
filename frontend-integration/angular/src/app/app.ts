import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { TOOL_NAMES } from '@carto/maps-ai-tools';
import { MapView } from './components/map-view/map-view';
import { ChatUi } from './components/chat-ui/chat-ui';
import { ZoomControls } from './components/zoom-controls/zoom-controls';
import { LayerToggle } from './components/layer-toggle/layer-toggle';
import { SnackbarComponent } from './components/snackbar/snackbar';
import { MapAIToolsService } from './services/map-ai-tools.service';
import { MapToolsService } from './services/map-tools.service';
import { MapToolsStateService } from './services/map-tools-state.service';
import { ViewState } from './services/deck-map.service';
import {
  Message,
  MapInstances,
  LoaderState,
  LayerConfig,
  SnackbarConfig,
} from './models/message.model';

const WS_URL = 'ws://localhost:3000/ws';

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
  zoomLevel: number = 4;
  layers: LayerConfig[] = [];
  snackbar: SnackbarConfig = { message: null, type: 'error' };

  private mapInstances: MapInstances | null = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private aiToolsService: MapAIToolsService,
    private mapToolsService: MapToolsService,
    private stateService: MapToolsStateService
  ) {}

  ngOnInit(): void {
    // Connect to WebSocket via MapAIToolsService
    this.aiToolsService.connect(WS_URL);

    // Subscribe to state observables
    this.subscriptions.push(
      this.aiToolsService.isConnected$.subscribe((c) => (this.isConnected = c)),
      this.aiToolsService.messages$.subscribe((m) => (this.messages = m)),
      this.aiToolsService.loaderState$.subscribe((s) => (this.loaderState = s)),
      this.aiToolsService.error$.subscribe((err) => this.showSnackbar(err)),
      this.stateService.layers$.subscribe((l) => (this.layers = l))
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  handleMapInit(instances: MapInstances): void {
    this.mapInstances = instances;
    this.mapToolsService.initialize(instances.deck, instances.map);

    // Register layer in state service
    this.stateService.registerLayer({
      id: 'points-layer',
      name: 'Airports',
      color: '#c80050',
      visible: true,
    });
  }

  handleViewStateChange(viewState: ViewState): void {
    this.zoomLevel = viewState.zoom;
  }

  handleSendMessage(content: string): void {
    this.aiToolsService.sendMessage(content);
  }

  async handleZoomIn(): Promise<void> {
    if (this.mapToolsService.isInitialized()) {
      await this.mapToolsService.execute(TOOL_NAMES.ZOOM_MAP, { direction: 'in', levels: 1 });
    }
  }

  async handleZoomOut(): Promise<void> {
    if (this.mapToolsService.isInitialized()) {
      await this.mapToolsService.execute(TOOL_NAMES.ZOOM_MAP, { direction: 'out', levels: 1 });
    }
  }

  async handleLayerToggle(event: { layerId: string; visible: boolean }): Promise<void> {
    if (this.mapToolsService.isInitialized()) {
      const result = await this.mapToolsService.execute(TOOL_NAMES.TOGGLE_LAYER, {
        layerName: event.layerId,
        visible: event.visible,
      });

      // Update state service on success
      if (result.success) {
        this.stateService.setLayerVisibility(event.layerId, event.visible);
      }
    }
  }

  showSnackbar(message: string, type: 'error' | 'info' = 'error'): void {
    this.snackbar = { message, type };
  }

  hideSnackbar(): void {
    this.snackbar = { message: null, type: 'error' };
  }

  get controlsDisabled(): boolean {
    return !this.isConnected || !this.mapInstances;
  }
}
