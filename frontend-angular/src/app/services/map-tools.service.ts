import { Injectable } from '@angular/core';
import { Deck } from '@deck.gl/core';
import { createMapTools } from '@map-tools/ai-tools';

@Injectable({
  providedIn: 'root'
})
export class MapToolsService {
  private mapTools: any = null;

  constructor() {}

  initialize(deck: Deck): void {
    this.mapTools = createMapTools({ deck });
  }

  async execute(tool: string, parameters: any): Promise<any> {
    if (!this.mapTools) {
      return { success: false, message: 'Map tools not initialized' };
    }
    return await this.mapTools.execute(tool, parameters);
  }

  isInitialized(): boolean {
    return this.mapTools !== null;
  }
}
