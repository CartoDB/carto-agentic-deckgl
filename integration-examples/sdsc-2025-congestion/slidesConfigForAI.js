import slides from './slides';

/**
 * Enhanced slide configuration for AI context
 * Adds human-readable names and descriptions to each slide
 */
export const slidesConfigForAI = slides.map((slide, index) => {
  const slideNames = [
    'cover',
    'challenge',
    'results',
    'regional-impact',
    'safety',
    'transit-funding',
  ];

  const slideTitles = [
    'Cover',
    'The Challenge',
    'Traffic Reduction Results',
    'Regional Impact',
    'Safety Improvements',
    'Transit Funding',
  ];

  const slideDescriptions = [
    'Welcome screen with 3D view of Manhattan congestion zone',
    'Traffic congestion before pricing - animated vehicle trips',
    'Traffic reduction after congestion pricing implementation',
    'Regional improvements across the NYC metro area',
    'Safety improvements for pedestrians and cyclists',
    'MTA transit funding from congestion pricing revenue',
  ];

  return {
    ...slide,
    index,
    name: slideNames[index] || `slide-${index}`,
    title: slideTitles[index] || `Slide ${index}`,
    description: slideDescriptions[index],
    hasFilter: false, // This demo doesn't use filter sliders
    filterConfig: null,
  };
});

export default slidesConfigForAI;
