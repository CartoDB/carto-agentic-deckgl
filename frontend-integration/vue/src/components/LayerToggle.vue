<template>
  <div class="layer-toggle">
    <div class="layer-toggle-header">Layers</div>
    <div class="layer-list">
      <label
        v-for="layer in layers"
        :key="layer.id"
        class="layer-item"
        :class="{ disabled }">
        <input
          type="checkbox"
          :checked="layer.visible"
          :disabled="disabled"
          @change="toggleLayer(layer)"
        />
        <span class="layer-name">{{ layer.name }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { TOOL_NAMES } from '@carto/maps-ai-tools';

interface LayerConfig {
  id: string;
  name: string;
  visible: boolean;
}

interface MapToolsInterface {
  execute: (tool: string, params: Record<string, unknown>) => { success: boolean };
  isInitialized: () => boolean;
}

const props = defineProps<{
  disabled: boolean;
  mapTools: MapToolsInterface;
}>();

const layers = ref<LayerConfig[]>([
  { id: 'points-layer', name: 'Airports', visible: true }
]);

const toggleLayer = (layer: LayerConfig): void => {
  if (!props.mapTools.isInitialized()) return;

  const newVisibility = !layer.visible;
  const result = props.mapTools.execute(TOOL_NAMES.TOGGLE_LAYER, {
    layerName: layer.id,
    visible: newVisibility
  });

  if (result.success) {
    layer.visible = newVisibility;
  }
};
</script>

<style scoped>
.layer-toggle {
  position: absolute;
  top: 10px;
  right: 360px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  z-index: 100;
  min-width: 140px;
}

.layer-toggle-header {
  padding: 8px 12px;
  font-weight: 600;
  font-size: 12px;
  color: #666;
  border-bottom: 1px solid #eee;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.layer-list {
  padding: 8px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.layer-item:hover:not(.disabled) {
  background-color: #f5f5f5;
}

.layer-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.layer-item input[type="checkbox"] {
  cursor: pointer;
}

.layer-name {
  font-size: 13px;
  color: #333;
}
</style>
