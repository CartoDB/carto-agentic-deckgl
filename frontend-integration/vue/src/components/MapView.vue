<template>
  <div style="position: relative; width: 100%; height: 100%;">
    <div id="map-container" style="position: absolute; width: 100%; height: 100%;" />
    <canvas id="map-container-canvas" style="position: absolute; width: 100%; height: 100%; pointer-events: auto;" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useDeckMap } from '../composables/useDeckMap';

const emit = defineEmits<{
  mapInit: [instances: { deck: NonNullable<typeof deck.value>; map: NonNullable<typeof map.value> }]
}>();

const { deck, map } = useDeckMap('map-container');

onMounted(() => {
  // Wait for both deck and map to be initialized
  const checkInit = setInterval(() => {
    if (deck.value && map.value) {
      clearInterval(checkInit);
      emit('mapInit', { deck: deck.value, map: map.value });
    }
  }, 100);
});
</script>
