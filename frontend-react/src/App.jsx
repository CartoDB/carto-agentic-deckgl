import { useState, useCallback } from 'react';
import { MapView } from './components/MapView';
import { ChatUI } from './components/ChatUI';
import { useWebSocket } from './hooks/useWebSocket';
import { useMapTools } from './hooks/useMapTools';
import './styles/main.css';

const WS_URL = 'ws://localhost:3000/ws';

function App() {
  const [messages, setMessages] = useState([]);
  const [deck, setDeck] = useState(null);

  const mapTools = useMapTools(deck);

  const handleMessage = useCallback(async (data) => {
    if (data.type === 'stream_chunk') {
      setMessages(prev => {
        const filtered = prev.filter(m => m.messageId !== data.messageId);
        return [...filtered, {
          type: 'bot',
          content: data.content,
          streaming: !data.isComplete,
          messageId: data.messageId
        }];
      });
    } else if (data.type === 'tool_call' && mapTools) {
      const result = await mapTools.execute(data.tool, data.parameters);
      if (result.success) {
        setMessages(prev => [...prev, {
          type: 'action',
          content: `✓ ${result.message}`
        }]);
      } else {
        console.error('[Main] Tool execution failed:', result.message);
      }
    } else if (data.type === 'error') {
      setMessages(prev => [...prev, {
        type: 'bot',
        content: `Error: ${data.content}`
      }]);
    }
  }, [mapTools]);

  const { isConnected, send } = useWebSocket(WS_URL, handleMessage);

  const handleSendMessage = useCallback((content) => {
    setMessages(prev => [...prev, {
      type: 'user',
      content: content
    }]);

    send({
      type: 'chat_message',
      content: content,
      timestamp: Date.now()
    });
  }, [send]);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <MapView onDeckInit={setDeck} />
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
