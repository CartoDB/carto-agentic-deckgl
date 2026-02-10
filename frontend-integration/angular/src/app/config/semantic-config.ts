/**
 * Semantic configuration for the application, including predefined welcome chips.
 * This configuration can be extended in the future to include more settings related to semantic features.
 */

export const SEMANTIC_CONFIG = {
  welcomeChips: [
    {
      id: 'high_education_counties',
      label: 'Counties with 40%+ higher education',
      prompt: 'Show me counties where more than 40% of residents have higher education',
    },
    {
      id: 'gop_high_income',
      label: 'Republican counties with high income',
      prompt: 'Find counties that voted Republican with high household incomes over $100k',
    },
    {
      id: 'education_and_clinton',
      label: 'High education & Clinton counties',
      prompt: 'Which counties have both high education levels and voted for Clinton?',
    },
    {
      id: 'democrat_over_60',
      label: 'Counties with 60%+ Democratic votes',
      prompt: 'Display counties where Democratic votes exceeded 60%',
    },
    {
      id: 'population_density_urban',
      label: 'Population density in urban areas',
      prompt:
        'Show population density by H3 cell filtering by urban areas (High_density_urban, Very_High_density_urban, Low_density_urban, Medium_density_urban)',
    },
    {
      id: 'healthcare_vs_retail',
      label: 'Healthcare vs retail POIs',
      prompt: 'Compare the number of healthcare vs retail POIs across the map',
    },
    {
      id: 'hot_populated_areas',
      label: 'Hot areas with high population',
      prompt: 'Display areas with average July temperature above 80°F and high population',
    },
  ],
};

export type SemanticConfig = typeof SEMANTIC_CONFIG;
