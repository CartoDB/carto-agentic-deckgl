import React from 'react';
import {
  Paper,
  IconButton,
  Typography,
  makeStyles,
  Fade,
  Drawer,
  Hidden,
  useMediaQuery,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { ChatUI } from './ChatUI';
import { SIDEBAR_WIDTH } from '../Sidebar/Sidebar';

const CHAT_WIDTH = 350;
const CHAT_HEIGHT = 450;
const GAP = 16;

const useStyles = makeStyles((theme) => ({
  // Desktop: Fixed panel left of sidebar
  panel: {
    position: 'fixed',
    bottom: theme.spacing(3),
    right: `calc(${SIDEBAR_WIDTH.xs} + ${GAP}px)`,
    width: CHAT_WIDTH,
    height: CHAT_HEIGHT,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: theme.spacing(0.5),
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    transition: theme.transitions.create('right', {
      easing: theme.transitions.easing.easeInOut,
      duration: theme.transitions.duration.standard,
    }),
    [theme.breakpoints.up('lg')]: {
      right: `calc(${SIDEBAR_WIDTH.lg} + ${GAP}px)`,
    },
  },
  panelSidebarClosed: {
    right: GAP,
    [theme.breakpoints.up('lg')]: {
      right: GAP,
    },
  },
  // Mobile drawer styles
  mobileDrawer: {
    '& .MuiDrawer-paper': {
      height: '70vh',
      borderTopLeftRadius: theme.spacing(1),
      borderTopRightRadius: theme.spacing(1),
    },
  },
  mobileContent: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  // Shared header styles
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
    color: theme.palette.common.white,
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
 * ChatPanel - Chat panel that positions relative to sidebar
 * Desktop: Fixed panel left of sidebar with slide animation
 * Mobile: Bottom sheet drawer
 */
export const ChatPanel = React.memo(function ChatPanel({
  open,
  onClose,
  isConnected,
  onSendMessage,
  messages,
  loaderState,
  sidebarOpen = true,
}) {
  const classes = useStyles();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'));

  const ChatHeader = () => (
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
  );

  const ChatContent = () => (
    <div className={classes.chatContainer}>
      <ChatUI
        isConnected={isConnected}
        onSendMessage={onSendMessage}
        messages={messages}
        loaderState={loaderState}
      />
    </div>
  );

  // Mobile: Bottom sheet drawer
  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        className={classes.mobileDrawer}
      >
        <div className={classes.mobileContent}>
          <ChatHeader />
          <ChatContent />
        </div>
      </Drawer>
    );
  }

  // Desktop: Fixed panel with sidebar-relative positioning
  if (!open) return null;

  return (
    <Hidden smDown>
      <Fade in={open}>
        <Paper
          className={`${classes.panel} ${!sidebarOpen ? classes.panelSidebarClosed : ''}`}
          elevation={8}
        >
          <ChatHeader />
          <ChatContent />
        </Paper>
      </Fade>
    </Hidden>
  );
});
