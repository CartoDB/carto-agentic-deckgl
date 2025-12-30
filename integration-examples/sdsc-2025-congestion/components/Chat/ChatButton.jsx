import React from 'react';
import { Button, IconButton, makeStyles, Hidden } from '@material-ui/core';
import assistantIconUrl from '../../assets/icons/ai.svg';

const useStyles = makeStyles((theme) => ({
  btn: {
    marginLeft: theme.spacing(1),
  },
  btnIcon: {
    marginLeft: theme.spacing(2),
    '& svg, & img': {
      width: theme.spacing(3),
      height: theme.spacing(3),
    }
  },
  icon: {
    display: 'block'
  }
}));

/**
 * ChatButton - Button to toggle chat panel
 * Styled to match Share/About buttons in Header
 * Wrapped in React.memo to prevent unnecessary re-renders
 */
export const ChatButton = React.memo(function ChatButton({ onClick, isOpen, primary }) {
  const classes = useStyles();

  // Hide button when chat is open (close via X in panel header)
  if (isOpen) return null;

  const assistantIcon = (
    <img className={classes.icon} src={assistantIconUrl} alt="" aria-hidden="true" />
  );

  return (
    <>
      {/* Mobile: Icon button only */}
      <Hidden mdUp>
        <IconButton
          data-position="right"
          classes={{ root: classes.btnIcon }}
          color={primary ? 'primary' : 'inherit'}
          onClick={onClick}
          aria-label="Open chat"
        >
          {assistantIcon}
        </IconButton>
      </Hidden>

      {/* Desktop: Button with text */}
      <Hidden smDown>
        <Button
          data-position="right"
          classes={{ root: classes.btn }}
          color={primary ? 'primary' : 'inherit'}
          onClick={onClick}
          startIcon={assistantIcon}
          size="small"
        >
          Chat
        </Button>
      </Hidden>
    </>
  );
});
