<template>
  <div style="position: relative; width: 100%; height: 100%;">
    <div id="map-container" style="position: absolute; width: 100%; height: 100%;" />
    <canvas id="map-container-canvas" style="position: absolute; width: 100%; height: 100%; pointer-events: auto;" />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useDeckMap } from '../composables/useDeckMap';

const emit = defineEmits(['deckInit']);

const { deck } = useDeckMap('map-container');

onMounted(() => {
  // Wait for deck to be initialized
  const checkDeck = setInterval(() => {
    if (deck.value) {
      clearInterval(checkDeck);
      emit('deckInit', deck.value);
    }
  }, 100);
});
</script>
