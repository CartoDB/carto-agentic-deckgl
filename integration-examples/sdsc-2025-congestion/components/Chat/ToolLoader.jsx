import React from 'react';
import { makeStyles } from '@material-ui/core';

const useStyles = makeStyles((theme) => ({
  container: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1, 1.5),
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignSelf: 'flex-start',
    gap: theme.spacing(0.5),
  },
  text: {
    color: '#6b7280',
    fontSize: 13,
  },
  dots: {
    display: 'flex',
    gap: 2,
  },
  dot: {
    color: '#6b7280',
    fontSize: 14,
    animation: '$bounce 1.4s infinite ease-in-out',
    '&:nth-child(1)': {
      animationDelay: '0s',
    },
    '&:nth-child(2)': {
      animationDelay: '0.2s',
    },
    '&:nth-child(3)': {
      animationDelay: '0.4s',
    },
  },
  '@keyframes bounce': {
    '0%, 80%, 100%': {
      transform: 'translateY(0)',
      opacity: 0.5,
    },
    '40%': {
      transform: 'translateY(-4px)',
      opacity: 1,
    },
  },
}));

/**
 * ToolLoader - Shows animated loading dots with contextual text
 */
export function ToolLoader({ state }) {
  const classes = useStyles();

  if (!state) return null;

  const text = state === 'thinking' ? 'Thinking' : 'Executing';

  return (
    <div className={classes.container}>
      <span className={classes.text}>{text}</span>
      <span className={classes.dots}>
        <span className={classes.dot}>.</span>
        <span className={classes.dot}>.</span>
        <span className={classes.dot}>.</span>
      </span>
    </div>
  );
}
