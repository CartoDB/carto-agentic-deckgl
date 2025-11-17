import { useState, useEffect } from 'react';
import { createMapTools } from '@map-tools/ai-tools';

export const useMapTools = (deck) => {
  const [mapTools, setMapTools] = useState(null);

  useEffect(() => {
    if (deck) {
      const tools = createMapTools({ deck });
      setMapTools(tools);
    }
  }, [deck]);

  return mapTools;
};
