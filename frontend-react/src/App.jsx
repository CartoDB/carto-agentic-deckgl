import { useState, useCallback, useEffect, useRef } from "react";
import { MapView } from "./components/MapView";
import { ChatUI } from "./components/ChatUI";
import { TOOL_NAMES, parseToolResponse } from "@carto/maps-ai-tools";
import "./styles/main.css";

const WS_URL = "ws://localhost:3000/ws";

function App() {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [mapInstances, setMapInstances] = useState(null);

  // Refs
  const wsRef = useRef(null);
  const streamingMessageRef = useRef({ id: null, content: '' });
  const messageIdCounter = useRef(0);
  const colorFiltersRef = useRef(new Map()); // Map<layerId, filters[]> for stacking color filters
  const originalLayerDataRef = useRef(new Map()); // Map<layerId, originalGeoJSON> for filter reset
  const sizeRulesRef = useRef(new Map()); // Map<layerId, {property, rules[], defaultSize}> for size by property

  // Helper to add messages with unique IDs
  const addMessage = useCallback((msg) => {
    const uniqueId = msg.id || `local_${Date.now()}_${messageIdCounter.current++}`;
    setMessages(prev => [...prev, { ...msg, id: uniqueId }]);
  }, []);

  // Define executors for each tool using the dictionary pattern
  const getExecutors = useCallback(() => {
    if (!mapInstances) return {};

    const { deck, map } = mapInstances;

    return {
      [TOOL_NAMES.FLY_TO]: (params) => {
        const currentView = deck.props.initialViewState || {};
        deck.setProps({
          initialViewState: {
            ...currentView,
            longitude: params.lng,
            latitude: params.lat,
            zoom: params.zoom || 12,
            transitionDuration: 1000,
            transitionInterruption: 1
          }
        });

        // Sync MapLibre
        if (map) {
          map.flyTo({
            center: [params.lng, params.lat],
            zoom: params.zoom || 12,
            duration: 1000
          });
        }

        // Force redraws
        requestAnimationFrame(() => deck.redraw(true));
        setTimeout(() => deck.redraw(true), 50);
        setTimeout(() => deck.redraw(true), 1100);

        return { success: true, message: `Flying to ${params.lat.toFixed(2)}, ${params.lng.toFixed(2)}` };
      },

      [TOOL_NAMES.ZOOM_MAP]: (params) => {
        const currentView = deck.props.initialViewState || { zoom: 10 };
        const currentZoom = currentView.zoom || 10;
        const levels = params.levels || 1;
        const newZoom = params.direction === 'in'
          ? Math.min(22, currentZoom + levels)
          : Math.max(0, currentZoom - levels);

        deck.setProps({
          initialViewState: {
            ...currentView,
            zoom: newZoom,
            transitionDuration: 500,
            transitionInterruption: 1
          }
        });

        // Sync MapLibre
        if (map) {
          map.jumpTo({
            center: [currentView.longitude, currentView.latitude],
            zoom: newZoom,
            bearing: currentView.bearing || 0,
            pitch: currentView.pitch || 0
          });
        }

        // Force redraws
        requestAnimationFrame(() => deck.redraw(true));
        setTimeout(() => deck.redraw(true), 50);
        setTimeout(() => deck.redraw(true), 600);

        return { success: true, message: `Zoomed ${params.direction} to level ${newZoom.toFixed(1)}` };
      },

      [TOOL_NAMES.TOGGLE_LAYER]: (params) => {
        const currentLayers = deck.props.layers || [];

        // Find layer by name (case-insensitive)
        const layerNameMap = {
          'airports': 'points-layer',
          'points': 'points-layer',
          'points-layer': 'points-layer'
        };

        const normalizedName = params.layerName.toLowerCase();
        const layerId = layerNameMap[normalizedName] || normalizedName;

        const layerFound = currentLayers.some(layer => layer && layer.id === layerId);
        if (!layerFound) {
          return { success: false, message: `Layer "${params.layerName}" not found` };
        }

        const updatedLayers = currentLayers.map(layer => {
          if (layer && layer.id === layerId) {
            return layer.clone({ visible: params.visible });
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers });
        requestAnimationFrame(() => deck.redraw(true));

        return { success: true, message: `Layer "${params.layerName}" ${params.visible ? 'shown' : 'hidden'}` };
      },

      [TOOL_NAMES.SET_POINT_COLOR]: (params) => {
        const rgba = [params.r, params.g, params.b, params.a ?? 200];
        const currentLayers = deck.props.layers || [];

        const updatedLayers = currentLayers.map(layer => {
          if (layer && layer.id === 'points-layer') {
            return layer.clone({ getFillColor: rgba });
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers });
        requestAnimationFrame(() => deck.redraw(true));
        setTimeout(() => deck.redraw(true), 50);

        return { success: true, message: `Point color changed to rgb(${params.r}, ${params.g}, ${params.b})` };
      },

      [TOOL_NAMES.COLOR_FEATURES_BY_PROPERTY]: (params) => {
        const { layerId = 'points-layer', property, operator = 'equals', value } = params;
        const filterColor = [params.r, params.g, params.b, params.a ?? 180];
        const defaultColor = [200, 0, 80, 180];
        const currentLayers = deck.props.layers || [];

        // Get or create filter list for this layer
        if (!colorFiltersRef.current.has(layerId)) {
          colorFiltersRef.current.set(layerId, []);
        }
        const filters = colorFiltersRef.current.get(layerId);

        // Add/update filter (same property+operator+value = update color)
        const filterKey = `${property}:${operator}:${value}`;
        const existingIdx = filters.findIndex(f => f.key === filterKey);
        const newFilter = { key: filterKey, property, operator, value, color: filterColor };

        if (existingIdx >= 0) {
          filters[existingIdx] = newFilter;
        } else {
          filters.push(newFilter);
        }

        // Generic property matcher
        const matchesFilter = (feature, filter) => {
          const propValue = String(feature.properties[filter.property] || '');
          switch (filter.operator) {
            case 'equals': return propValue === filter.value;
            case 'startsWith': return propValue.startsWith(filter.value);
            case 'contains': return propValue.includes(filter.value);
            case 'regex': return new RegExp(filter.value).test(propValue);
            default: return false;
          }
        };

        const updatedLayers = currentLayers.map(layer => {
          if (layer && layer.id === layerId) {
            return layer.clone({
              getFillColor: (feature) => {
                // Check all filters, first match wins
                for (const filter of filters) {
                  if (matchesFilter(feature, filter)) {
                    return filter.color;
                  }
                }
                return defaultColor;
              },
              updateTriggers: { getFillColor: JSON.stringify(filters) }
            });
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers });
        requestAnimationFrame(() => deck.redraw(true));
        setTimeout(() => deck.redraw(true), 50);

        return {
          success: true,
          message: `Colored features where ${property} ${operator} "${value}"`
        };
      },

      [TOOL_NAMES.QUERY_FEATURES]: (params) => {
        const { layerId = 'points-layer', property, operator = 'equals', value = '', includeNames = false } = params;
        const currentLayers = deck.props.layers || [];

        // Find the layer
        const layer = currentLayers.find(l => l && l.id === layerId);
        if (!layer) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        // Get GeoJSON data from layer
        const data = layer.props.data;
        if (!data || !data.features) {
          return { success: false, message: 'No feature data available' };
        }

        // Property matcher function
        const matchesFilter = (feature) => {
          if (operator === 'all') return true;
          const propValue = String(feature.properties[property] || '');
          switch (operator) {
            case 'equals': return propValue === value;
            case 'startsWith': return propValue.startsWith(value);
            case 'contains': return propValue.includes(value);
            case 'regex': return new RegExp(value).test(propValue);
            default: return false;
          }
        };

        // Filter and count features
        const matchingFeatures = data.features.filter(matchesFilter);
        const count = matchingFeatures.length;
        const total = data.features.length;

        // Build response message
        let message = '';
        if (operator === 'all') {
          message = `Total features: ${count}`;
        } else {
          message = `Found ${count} features where ${property} ${operator} "${value}" (out of ${total} total)`;
        }

        // Include sample names if requested
        let sampleNames = [];
        if (includeNames && matchingFeatures.length > 0) {
          sampleNames = matchingFeatures
            .slice(0, 10)
            .map(f => f.properties.name || f.properties.abbrev || 'Unknown')
            .filter(Boolean);
        }

        return {
          success: true,
          message,
          data: {
            count,
            total,
            sampleNames: sampleNames.length > 0 ? sampleNames : undefined
          }
        };
      },

      [TOOL_NAMES.FILTER_FEATURES_BY_PROPERTY]: (params) => {
        const { layerId = 'points-layer', property, operator = 'equals', value = '', reset = false } = params;
        const currentLayers = deck.props.layers || [];

        // Find the layer
        const layer = currentLayers.find(l => l && l.id === layerId);
        if (!layer) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        // Store original data on first access, or get stored original
        let originalData = originalLayerDataRef.current.get(layerId);
        if (!originalData) {
          originalData = layer.props.data;
          if (originalData && originalData.features) {
            originalLayerDataRef.current.set(layerId, originalData);
          }
        }

        if (!originalData || !originalData.features) {
          return { success: false, message: 'No feature data available' };
        }

        // If reset=true, show all features (no property required)
        if (reset) {
          const updatedLayers = currentLayers.map(l => {
            if (l && l.id === layerId) {
              return l.clone({
                data: originalData,
                updateTriggers: { data: 'reset' }
              });
            }
            return l;
          });
          deck.setProps({ layers: updatedLayers });
          requestAnimationFrame(() => deck.redraw(true));
          return { success: true, message: `Filter cleared - showing all ${originalData.features.length} features` };
        }

        // For filtering, property and value are required
        if (!property) {
          return { success: false, message: 'Property is required for filtering. Use reset=true to clear filters.' };
        }

        // Property matcher function
        const matchesFilter = (feature) => {
          const propValue = String(feature.properties[property] || '');
          switch (operator) {
            case 'equals': return propValue === value;
            case 'startsWith': return propValue.startsWith(value);
            case 'contains': return propValue.includes(value);
            case 'regex': return new RegExp(value).test(propValue);
            default: return false;
          }
        };

        // Filter features from ORIGINAL data (not current filtered data)
        const filteredFeatures = originalData.features.filter(matchesFilter);
        const filteredData = {
          ...originalData,
          features: filteredFeatures
        };

        // Update layer with filtered data
        const updatedLayers = currentLayers.map(l => {
          if (l && l.id === layerId) {
            return l.clone({
              data: filteredData,
              updateTriggers: { data: `${property}:${operator}:${value}` }
            });
          }
          return l;
        });

        deck.setProps({ layers: updatedLayers });
        requestAnimationFrame(() => deck.redraw(true));
        setTimeout(() => deck.redraw(true), 50);

        return {
          success: true,
          message: `Filtered to ${filteredFeatures.length} features where ${property} ${operator} "${value}"`
        };
      },

      [TOOL_NAMES.SIZE_FEATURES_BY_PROPERTY]: (params) => {
        const { layerId = 'points-layer', property, sizeRules = [], defaultSize = 8, reset = false } = params;
        const currentLayers = deck.props.layers || [];

        // Find the layer
        const layer = currentLayers.find(l => l && l.id === layerId);
        if (!layer) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        // If reset, use uniform size
        if (reset) {
          sizeRulesRef.current.delete(layerId);
          const updatedLayers = currentLayers.map(l => {
            if (l && l.id === layerId) {
              return l.clone({
                getPointRadius: defaultSize,
                pointRadiusUnits: 'pixels',
                pointRadiusMinPixels: 1,
                pointRadiusMaxPixels: 200,
                updateTriggers: { getPointRadius: 'reset' }
              });
            }
            return l;
          });
          deck.setProps({ layers: updatedLayers });
          requestAnimationFrame(() => deck.redraw(true));
          return { success: true, message: `Size reset to uniform ${defaultSize}px` };
        }

        if (!property || sizeRules.length === 0) {
          return { success: false, message: 'Property and sizeRules are required. Use reset=true to clear size rules.' };
        }

        // Store size rules for this layer
        sizeRulesRef.current.set(layerId, { property, rules: sizeRules, defaultSize });

        // Build size lookup map for fast access
        const sizeMap = new Map();
        sizeRules.forEach(rule => {
          sizeMap.set(rule.value, rule.size);
        });

        // Update layer with dynamic size in PIXELS
        const updatedLayers = currentLayers.map(l => {
          if (l && l.id === layerId) {
            return l.clone({
              getPointRadius: (feature) => {
                const propValue = String(feature.properties[property] || '');
                return sizeMap.get(propValue) ?? defaultSize;
              },
              pointRadiusUnits: 'pixels',
              pointRadiusMinPixels: 1,
              pointRadiusMaxPixels: 200,
              updateTriggers: { getPointRadius: JSON.stringify(sizeRules) }
            });
          }
          return l;
        });

        deck.setProps({ layers: updatedLayers });
        requestAnimationFrame(() => deck.redraw(true));
        setTimeout(() => deck.redraw(true), 50);

        const rulesDescription = sizeRules.map(r => `${r.value}=${r.size}px`).join(', ');
        return {
          success: true,
          message: `Size updated by ${property}: ${rulesDescription} (default: ${defaultSize}px)`
        };
      },

      [TOOL_NAMES.AGGREGATE_FEATURES]: (params) => {
        const { layerId = 'points-layer', groupBy } = params;
        const currentLayers = deck.props.layers || [];

        // Find the layer
        const layer = currentLayers.find(l => l && l.id === layerId);
        if (!layer) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        // Get GeoJSON data - use original if available, otherwise current
        let data = originalLayerDataRef.current.get(layerId) || layer.props.data;
        if (!data || !data.features) {
          return { success: false, message: 'No feature data available' };
        }

        if (!groupBy) {
          return { success: false, message: 'groupBy property is required' };
        }

        // Aggregate counts by property value
        const counts = new Map();
        data.features.forEach(feature => {
          const value = String(feature.properties[groupBy] || 'unknown');
          counts.set(value, (counts.get(value) || 0) + 1);
        });

        // Convert to sorted array (by count descending)
        const results = Array.from(counts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count);

        // Build table string for display
        const tableRows = results.map(r => `${r.value}: ${r.count}`).join('\n');
        const total = data.features.length;

        return {
          success: true,
          message: `Aggregation by "${groupBy}" (${total} total features):\n${tableRows}`,
          data: {
            groupBy,
            total,
            groups: results
          }
        };
      }
    };
  }, [mapInstances]);

  // Handle streaming message chunks
  const handleStreamChunk = useCallback((data) => {
    const ref = streamingMessageRef.current;

    // Skip empty completion chunks
    if (data.isComplete && !data.content) {
      setMessages(prev => prev.map(msg =>
        msg.id === data.messageId
          ? { ...msg, streaming: false }
          : msg
      ));
      return;
    }

    if (ref.id !== data.messageId) {
      // New message - add to messages array
      ref.id = data.messageId;
      ref.content = data.content || '';
      setMessages(prev => [...prev, {
        id: data.messageId,
        type: 'assistant',
        content: ref.content,
        streaming: true
      }]);
    } else {
      // Accumulate content from chunks
      ref.content += data.content || '';
      setMessages(prev => prev.map(msg =>
        msg.id === data.messageId
          ? { ...msg, content: ref.content, streaming: !data.isComplete }
          : msg
      ));
    }
  }, []);

  // Handle tool calls using dictionary pattern
  const handleToolCall = useCallback((response) => {
    const executors = getExecutors();

    if (Object.keys(executors).length === 0) {
      console.warn('Map not initialized yet');
      addMessage({ type: 'error', content: 'Map not ready' });
      return;
    }

    const { toolName, data, error } = parseToolResponse(response);

    if (error) {
      console.error(`Tool error: ${error.message}`);
      addMessage({ type: 'error', content: `Error: ${error.message}` });
      return;
    }

    console.log(`Executing tool: ${toolName}`, data);

    const executor = executors[toolName];
    if (executor && data) {
      const result = executor(data);
      addMessage({
        type: 'action',
        content: result.success ? `✓ ${result.message}` : `✗ ${result.message}`
      });
    } else {
      console.warn(`Unknown tool: ${toolName}`);
      addMessage({ type: 'error', content: `Unknown tool: ${toolName}` });
    }
  }, [getExecutors, addMessage]);

  // WebSocket connection effect
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      addMessage({ type: 'error', content: 'Connection error' });
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'stream_chunk') {
          handleStreamChunk(data);
        } else if (data.type === 'tool_call') {
          handleToolCall(data);
        } else if (data.type === 'error') {
          addMessage({ type: 'error', content: data.content });
        } else if (data.type === 'welcome') {
          console.log('Server welcome:', data.content);
        }
      } catch (err) {
        console.error('Error processing message:', err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [addMessage, handleStreamChunk, handleToolCall]);

  // Send message handler
  const handleSendMessage = useCallback((content) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected');
      return;
    }

    addMessage({ type: 'user', content });
    streamingMessageRef.current = { id: null, content: '' };

    wsRef.current.send(JSON.stringify({
      type: 'chat_message',
      content,
      timestamp: Date.now()
    }));
  }, [addMessage]);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <MapView onMapInit={setMapInstances} />
      </div>
      <ChatUI
        isConnected={isConnected}
        onSendMessage={handleSendMessage}
        messages={messages}
      />
    </div>
  );
}

export default App;
