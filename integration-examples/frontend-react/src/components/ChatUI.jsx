import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

export const ChatUI = ({ isConnected, onSendMessage, messages }) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && isConnected) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div
      style={{
        width: "350px",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid #ddd",
        background: "white",
      }}
    >
      <div
        style={{
          padding: "15px",
          borderBottom: "1px solid #ddd",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0 }}>Map Control Chat</h3>
        <span
          style={{
            fontSize: "12px",
            color: isConnected ? "#22c55e" : "#ef4444",
          }}
        >
          ●
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "15px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {messages.map((msg, idx) => {
          const getMessageStyle = () => {
            const base = {
              padding: "10px",
              borderRadius: "8px",
              maxWidth: "80%",
            };
            switch (msg.type) {
              case "user":
                return {
                  ...base,
                  alignSelf: "flex-end",
                  background: "#3b82f6",
                  color: "white",
                  fontSize: "12px",
                };
              case "action":
                return {
                  ...base,
                  alignSelf: "flex-start",
                  background: "#10b981",
                  color: "white",
                  fontSize: "12px",
                };
              case "error":
                return {
                  ...base,
                  alignSelf: "flex-start",
                  background: "#ef4444",
                  color: "white",
                };
              case "system":
                return {
                  ...base,
                  alignSelf: "center",
                  background: "#e5e7eb",
                  color: "#6b7280",
                  fontSize: "12px",
                  maxWidth: "100%",
                };
              default: // assistant
                return {
                  ...base,
                  alignSelf: "flex-start",
                  background: "#f3f4f6",
                  color: "#111",
                  fontSize: "12px",
                };
            }
          };
          // Render markdown for assistant messages, plain text for others
          const renderContent = () => {
            if (msg.type === "assistant") {
              return (
                <ReactMarkdown
                  components={{
                    // Style overrides for markdown elements
                    p: ({ children }) => (
                      <p style={{ margin: "0 0 8px 0" }}>{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul style={{ margin: "4px 0", paddingLeft: "20px" }}>
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol style={{ margin: "4px 0", paddingLeft: "20px" }}>
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li style={{ marginBottom: "2px" }}>{children}</li>
                    ),
                    strong: ({ children }) => (
                      <strong style={{ fontWeight: "600" }}>{children}</strong>
                    ),
                    code: ({ children }) => (
                      <code
                        style={{
                          background: "#e5e7eb",
                          padding: "1px 4px",
                          borderRadius: "3px",
                          fontSize: "13px",
                        }}
                      >
                        {children}
                      </code>
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              );
            }
            return msg.content;
          };

          return (
            <div
              key={msg.id || idx}
              className={`message ${msg.type} ${
                msg.streaming ? "streaming" : ""
              }`}
              style={getMessageStyle()}
            >
              {renderContent()}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          padding: "15px",
          borderTop: "1px solid #ddd",
          display: "flex",
          gap: "10px",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a command (e.g., 'zoom in', 'fly to San Francisco')"
          style={{
            flex: 1,
            padding: "10px",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!isConnected}
          style={{
            padding: "10px 20px",
            background: isConnected ? "#3b82f6" : "#cbd5e1",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: isConnected ? "pointer" : "not-allowed",
            fontWeight: "500",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};
