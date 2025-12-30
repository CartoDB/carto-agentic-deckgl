import React from 'react';
import { Fab, Badge, makeStyles } from '@material-ui/core';
import ChatIcon from '@material-ui/icons/Chat';
import CloseIcon from '@material-ui/icons/Close';

const useStyles = makeStyles((theme) => ({
  fab: {
    position: 'fixed',
    bottom: theme.spacing(3),
    left: theme.spacing(3),
    zIndex: 1100,
    backgroundColor: '#3b82f6',
    '&:hover': {
      backgroundColor: '#2563eb',
    },
  },
  badge: {
    '& .MuiBadge-badge': {
      backgroundColor: '#ef4444',
      color: 'white',
    },
  },
}));

/**
 * ChatFAB - Floating Action Button to toggle chat window
 * Wrapped in React.memo to prevent re-renders from animation updates
 */
export const ChatFAB = React.memo(function ChatFAB({ open, isOpen, onClick, unreadCount = 0 }) {
  const classes = useStyles();
  // Support both 'open' and 'isOpen' props for compatibility
  const isOpenState = open ?? isOpen ?? false;

  return (
    <Fab
      className={classes.fab}
      color="primary"
      onClick={onClick}
      aria-label={isOpenState ? 'Close chat' : 'Open chat'}
    >
      <Badge
        badgeContent={unreadCount}
        className={classes.badge}
        invisible={isOpenState || unreadCount === 0}
      >
        {isOpenState ? <CloseIcon /> : <ChatIcon />}
      </Badge>
    </Fab>
  );
});
