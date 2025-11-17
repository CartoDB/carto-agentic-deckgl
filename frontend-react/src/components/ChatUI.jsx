import { useState, useRef, useEffect } from 'react';

export const ChatUI = ({ isConnected, onSendMessage, messages }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && isConnected) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div style={{ width: '350px', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #ddd', background: 'white' }}>
      <div style={{ padding: '15px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Map Control Chat</h3>
        <span style={{ fontSize: '12px', color: isConnected ? '#22c55e' : '#ef4444' }}>●</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`message ${msg.type} ${msg.streaming ? 'streaming' : ''}`}
            style={{
              padding: '10px',
              borderRadius: '8px',
              maxWidth: '80%',
              alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
              background: msg.type === 'user' ? '#3b82f6' : msg.type === 'action' ? '#10b981' : '#f3f4f6',
              color: msg.type === 'user' || msg.type === 'action' ? 'white' : '#111'
            }}
          >
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '15px', borderTop: '1px solid #ddd', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a command (e.g., 'zoom in', 'fly to San Francisco')"
          style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
        />
        <button
          onClick={handleSend}
          disabled={!isConnected}
          style={{
            padding: '10px 20px',
            background: isConnected ? '#3b82f6' : '#cbd5e1',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isConnected ? 'pointer' : 'not-allowed',
            fontWeight: '500'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};
