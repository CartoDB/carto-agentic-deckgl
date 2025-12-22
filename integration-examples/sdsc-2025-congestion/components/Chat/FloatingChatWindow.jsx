import React from 'react';
import { Paper, IconButton, Typography, makeStyles, Fade } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { ChatUI } from './ChatUI';

const useStyles = makeStyles((theme) => ({
  container: {
    position: 'fixed',
    bottom: theme.spacing(10),
    left: theme.spacing(3),
    width: 350,
    height: 450,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
  },
  header: {
    padding: theme.spacing(1.5, 2),
    backgroundColor: '#3b82f6',
    color: 'white',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: 600,
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
  },
  connected: {
    backgroundColor: '#22c55e',
  },
  disconnected: {
    backgroundColor: '#ef4444',
  },
  closeButton: {
    color: 'white',
    padding: theme.spacing(0.5),
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
  },
  chatContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: 'white',
  },
}));

/**
 * FloatingChatWindow - Floating chat window container
 * Wrapped in React.memo to prevent re-renders from animation updates
 */
export const FloatingChatWindow = React.memo(function FloatingChatWindow({
  open,
  onClose,
  isConnected,
  onSendMessage,
  messages,
  loaderState,
}) {
  const classes = useStyles();

  if (!open) return null;

  return (
    <Fade in={open}>
      <Paper className={classes.container} elevation={8}>
        <div className={classes.header}>
          <Typography className={classes.title}>
            <span
              className={`${classes.connectionDot} ${
                isConnected ? classes.connected : classes.disconnected
              }`}
            />
            Map Assistant
          </Typography>
          <IconButton className={classes.closeButton} size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <div className={classes.chatContainer}>
          <ChatUI
            isConnected={isConnected}
            onSendMessage={onSendMessage}
            messages={messages}
            loaderState={loaderState}
          />
        </div>
      </Paper>
    </Fade>
  );
});
