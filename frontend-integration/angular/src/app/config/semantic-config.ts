/**
 * Semantic configuration for the application, including predefined welcome chips.
 */

export const SEMANTIC_CONFIG = {
  welcomeChips: [
    {
      id: 'high_education_counties',
      label: 'Counties with 40%+ higher education',
      prompt: 'Show me counties where more than 40% of residents have higher education',
    },
    {
      id: 'population_density_urban',
      label: 'Population density in urban areas',
      prompt:
        'Show population density by H3 cell filtering by urban areas (High_density_urban, Very_High_density_urban, Low_density_urban, Medium_density_urban)',
    },
    {
      id: 'demographics_buffer_nyc',
      label: 'MCP Demographics around Times Square',
      prompt: 'What are the demographics within 5 minutes driving of Times Square, New York?',
    },
    {
      id: 'healthcare_pois_manhattan',
      label: 'MCP Healthcare POIs near Central Park',
      prompt: 'Find healthcare points of interest within 2 km of Central Park, New York',
    },
  ],
};
