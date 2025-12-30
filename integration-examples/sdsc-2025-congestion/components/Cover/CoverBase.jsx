import React, {useMemo} from 'react';
import {Fade, makeStyles, Grid} from '@material-ui/core';
import {useAppState} from '../../state';

const useStyles = makeStyles((theme) => ({
  root: {
    left: theme.spacing(3),
    right: theme.spacing(3),
    width: 'auto',
    position: 'absolute',
    color: theme.palette.common.white,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    top: 'auto',
    bottom: 'auto',
    [theme.breakpoints.up('md')]: {
      left: '50%',
      right: 'auto',
      maxWidth: theme.spacing(59),
      transform: 'translateX(-100%)',
      width: '100%'
    },
    [theme.breakpoints.up('lg')]: {
      maxWidth: theme.spacing(71)
    }
  },
  rootHidden: {
    pointerEvents: 'none'
  }
}));

const CoverBase = ({className, children, slidesToShow}) => {
  const classes = useStyles();
  const {currentSlide} = useAppState();

  const show = useMemo(() => {
    if (slidesToShow?.length) {
      return slidesToShow.reduce((isShown, slideIndex) => isShown || slideIndex === currentSlide, false);
    }

    return currentSlide === 0;
  }, [currentSlide, slidesToShow]);

  return (
    <Fade in={show}>
      <div
        className={[classes.root, !show ? classes.rootHidden : '', className ? className : ''].join(
          ' '
        )}
      >
        <Grid container>
          <Grid item xs={12}>
            {children}
          </Grid>
        </Grid>
      </div>
    </Fade>
  );
};

export default CoverBase;
