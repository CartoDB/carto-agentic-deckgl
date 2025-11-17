// backend/src/types/messages.ts
export interface ClientMessage {
  type: 'chat_message';
  content: string;
  timestamp: number;
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
