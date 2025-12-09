<template>
  <div class="zoom-controls">
    <button
      @click="zoomIn"
      :disabled="disabled"
      class="zoom-button"
      title="Zoom In">
      +
    </button>
    <button
      @click="zoomOut"
      :disabled="disabled"
      class="zoom-button"
      title="Zoom Out">
      −
    </button>
  </div>
</template>

<script setup lang="ts">
import { TOOL_NAMES } from '@carto/maps-ai-tools';

interface MapToolsInterface {
  execute: (tool: string, params: Record<string, unknown>) => unknown;
  isInitialized: () => boolean;
}

const props = defineProps<{
  disabled: boolean;
  mapTools: MapToolsInterface;
}>();

const zoomIn = (): void => {
  if (props.mapTools.isInitialized()) {
    props.mapTools.execute(TOOL_NAMES.ZOOM_MAP, { direction: 'in', levels: 1 });
  }
};

const zoomOut = (): void => {
  if (props.mapTools.isInitialized()) {
    props.mapTools.execute(TOOL_NAMES.ZOOM_MAP, { direction: 'out', levels: 1 });
  }
};
</script>

<style scoped>
.zoom-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 100;
}

.zoom-button {
  width: 32px;
  height: 32px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: background-color 0.2s;
}

.zoom-button:hover:not(:disabled) {
  background-color: #f5f5f5;
}

.zoom-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
