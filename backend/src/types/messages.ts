// backend/src/types/messages.ts

// Initial state sent from frontend with demo context
export interface InitialState {
  demoId?: string;
  currentSlide?: number;
  totalSlides?: number;
  slides?: Array<{
    index: number;
    name?: string;
    title?: string;
    description?: string;
    layers?: string[];
    hasFilter?: boolean;
    filterConfig?: {
      property?: string;
      min?: number;
      max?: number;
      unit?: string;
    };
  }>;
  initialViewState?: {
    longitude?: number;
    latitude?: number;
    zoom?: number;
    pitch?: number;
    bearing?: number;
  };
  currentFilterValue?: number;
}

export interface ClientMessage {
  type: 'chat_message';
  content: string;
  timestamp: number;
  initialState?: InitialState;
}

export interface ServerMessage {
  type: 'message' | 'error';
  content: string;
  timestamp: number;
}

export interface MapCommand {
  type: 'map_command';
  action: 'zoom' | 'fly_to' | 'toggle_layer';
  params: {
    zoom?: number;
    coordinates?: [number, number];
    layerId?: string;
    visible?: boolean;
  };
  originalMessage: string;
}
