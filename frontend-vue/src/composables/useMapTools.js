import { ref, watch } from 'vue';
import { createMapTools } from '@map-tools/ai-tools';

export function useMapTools(deck) {
  const mapTools = ref(null);

  watch(deck, (newDeck) => {
    if (newDeck) {
      const tools = createMapTools({ deck: newDeck });
      mapTools.value = tools;
    }
  });

  return { mapTools };
}
