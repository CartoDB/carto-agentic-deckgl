import React, { useState, useRef, useEffect } from 'react';
import { TextField, Button, makeStyles } from '@material-ui/core';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import BuildIcon from '@material-ui/icons/Build';
import { ToolLoader } from './ToolLoader';

const useStyles = makeStyles((theme) => ({
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  messagesContainer: {
    flex: 1,
    minHeight: 0, // Critical for proper flex overflow behavior
    overflowY: 'auto',
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  messageBase: {
    padding: theme.spacing(1, 1.5),
    borderRadius: 8,
    maxWidth: '85%',
    fontSize: 13,
    lineHeight: 1.5,
    wordBreak: 'break-word',
    // Markdown styles
    '& p': {
      margin: '0 0 8px 0',
      '&:last-child': {
        marginBottom: 0,
      },
    },
    '& strong': {
      fontWeight: 600,
    },
    '& em': {
      fontStyle: 'italic',
    },
    '& ul, & ol': {
      margin: '4px 0',
      paddingLeft: 20,
    },
    '& li': {
      marginBottom: 2,
    },
    '& h3, & h4': {
      margin: '8px 0 4px 0',
      fontWeight: 600,
      fontSize: 13,
    },
    '& code': {
      backgroundColor: 'rgba(0,0,0,0.1)',
      padding: '1px 4px',
      borderRadius: 3,
      fontSize: 12,
      fontFamily: 'monospace',
    },
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#f3f4f6',
    color: '#111',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 8,
  },
  userContent: {
    color: '#111',
  },
  timestamp: {
    fontSize: 10,
    color: '#9ca3af',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    color: '#111',
    padding: 0,
    marginTop: 8,
  },
  actionMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    color: '#333',
    fontSize: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  actionIcon: {
    fontSize: 12,
    color: '#666',
  },
  errorMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ef4444',
    color: 'white',
  },
  systemMessage: {
    alignSelf: 'center',
    backgroundColor: '#e5e7eb',
    color: '#6b7280',
    maxWidth: '100%',
    textAlign: 'center',
  },
  streaming: {
    opacity: 0.8,
  },
  inputContainer: {
    flexShrink: 0,
    position: 'relative',
    zIndex: 1,
    padding: theme.spacing(1.5),
    borderTop: '1px solid #e5e7eb',
    backgroundColor: 'white',
  },
  inputWrapper: {
    position: 'relative',
    width: '100%',
  },
  input: {
    width: '100%',
    '& .MuiInputBase-root': {
      fontSize: 13,
      backgroundColor: '#f3f4f6',
      borderRadius: 20,
      paddingRight: 44,
    },
    '& .MuiOutlinedInput-root': {
      borderRadius: 20,
      '& fieldset': {
        border: 'none',
      },
    },
    '& .MuiOutlinedInput-input': {
      padding: '10px 14px',
    },
  },
  sendButton: {
    position: 'absolute',
    right: 4,
    top: '50%',
    transform: 'translateY(-50%)',
    minWidth: 32,
    width: 32,
    height: 32,
    borderRadius: '50%',
    padding: 0,
    backgroundColor: '#3b82f6',
    color: 'white',
    '&:hover': {
      backgroundColor: '#2563eb',
    },
    '&.Mui-disabled': {
      backgroundColor: '#cbd5e1',
      color: 'white',
    },
    '& .MuiSvgIcon-root': {
      fontSize: 16,
    },
  },
}));

/**
 * Simple markdown parser for chat messages
 * Supports: **bold**, *italic*, - lists, ### headers, `code`
 */
function parseMarkdown(text) {
  if (!text) return '';

  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers (### Header)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    // Bold (**text** or __text__)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic (*text* or _text_) - but not inside words
    .replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>')
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>')
    // Inline code (`code`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Unordered lists (- item)
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')
    // Single newlines within paragraphs
    .replace(/\n/g, '<br/>');

  // Wrap in paragraph if not starting with a block element
  if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<ol')) {
    html = '<p>' + html + '</p>';
  }

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '').replace(/<p><br\/><\/p>/g, '');

  return html;
}

/**
 * Format timestamp as relative time (e.g., "15 sec. ago", "2 min. ago")
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return '';

  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000);

  if (diff < 60) {
    return `${diff} sec. ago`;
  } else if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    return `${mins} min. ago`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} hr. ago`;
  }
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * ChatUI - Chat interface component
 * Wrapped in React.memo to prevent re-renders from animation updates
 */
export const ChatUI = React.memo(function ChatUI({ isConnected, onSendMessage, messages, loaderState }) {
  const classes = useStyles();
  const [input, setInput] = useState('');
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      // Use requestAnimationFrame to ensure DOM is updated before scrolling
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  };

  // Scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Also scroll when loader state changes (tool execution feedback)
  useEffect(() => {
    scrollToBottom();
  }, [loaderState]);

  // Restore focus after messages change (tool execution, new responses)
  useEffect(() => {
    if (isConnected && messages.length > 0) {
      // Small delay to ensure DOM is ready after re-render
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [messages.length, isConnected]);

  // Also restore focus when loader finishes
  useEffect(() => {
    if (loaderState === null && isConnected) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loaderState, isConnected]);

  const handleSend = () => {
    if (input.trim() && isConnected) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const getMessageClass = (type) => {
    switch (type) {
      case 'user':
        return classes.userMessage;
      case 'action':
        return classes.actionMessage;
      case 'error':
        return classes.errorMessage;
      case 'system':
        return classes.systemMessage;
      default:
        return classes.assistantMessage;
    }
  };

  const renderMessageContent = (msg) => {
    // Only parse markdown for assistant messages
    if (msg.type === 'assistant' || msg.type === 'system') {
      return (
        <div dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} />
      );
    }
    // Action messages with tool icon
    if (msg.type === 'action') {
      return (
        <>
          <BuildIcon className={classes.actionIcon} />
          <span>{msg.content}</span>
        </>
      );
    }
    // User messages with timestamp
    if (msg.type === 'user') {
      return (
        <>
          <span className={classes.userContent}>{msg.content}</span>
          <span className={classes.timestamp}>{formatRelativeTime(msg.timestamp)}</span>
        </>
      );
    }
    // Fallback
    return msg.content;
  };

  return (
    <div className={classes.container}>
      <div className={classes.messagesContainer} ref={messagesContainerRef}>
        {messages.map((msg, idx) => (
          <div
            key={msg.id || idx}
            className={`${classes.messageBase} ${getMessageClass(msg.type)} ${
              msg.streaming ? classes.streaming : ''
            }`}
          >
            {renderMessageContent(msg)}
          </div>
        ))}
        <ToolLoader state={loaderState} />
      </div>

      <div className={classes.inputContainer}>
        <div className={classes.inputWrapper}>
          <TextField
            inputRef={inputRef}
            className={classes.input}
            variant="outlined"
            size="small"
            placeholder="Ask about the map..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={!isConnected}
            autoFocus
          />
          <Button
            className={classes.sendButton}
            variant="contained"
            onClick={handleSend}
            disabled={!isConnected || !input.trim()}
          >
            <ArrowUpwardIcon />
          </Button>
        </div>
      </div>
    </div>
  );
});
