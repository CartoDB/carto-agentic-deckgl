/**
 * Semantic Configuration for Business Location Analysis
 *
 * Static configuration derived from semantic layer.
 * This file contains the values that client components need.
 * It avoids fs operations which don't work on the client.
 */

export interface AnalysisType {
  id: string;
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
}

export interface BusinessType {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface RadiusOption {
  id: string;
  value: number;
  unit: 'miles';
  label: string;
}

export interface DrivetimeOption {
  id: string;
  value: number;
  unit: 'minutes';
  label: string;
}

export interface LocationOption {
  id: string;
  name: string;
  description: string;
  coordinates?: { longitude: number; latitude: number };
}

export const SEMANTIC_CONFIG = {
  name: 'Business Location Finder',
  description: 'Find optimal locations for new businesses in the United States.',

  welcomeMessage: `Welcome! I can help you find the best location for your business.
Tell me what type of business you're planning to open, and I'll analyze
demographics, nearby points of interest, and other relevant factors.`,

  initialViewState: {
    longitude: -98.5795,
    latitude: 39.8283,
    zoom: 4,
    pitch: 0,
    bearing: 0,
  },

  analysisTypes: [
    {
      id: 'demographic_analysis',
      name: 'Demographic Analysis',
      icon: 'people',
      description: 'Analyze population demographics',
      enabled: true,
    },
    {
      id: 'poi_analysis',
      name: 'POI Analysis',
      icon: 'place',
      description: 'Explore points of interest',
      enabled: true,
    },
    {
    id: 'business_location',
      name: 'Business Location',
      icon: 'location_on',
      description: 'Find potential TOP 10 business locations for your business',
      enabled: true,
    },
  ] as AnalysisType[],

  // POI Categories
  businessTypes: [
    {
      id: 'civic_amenities',
      name: 'Civic Amenities',
      icon: 'account_balance',
      description: 'Government buildings, public services, community centers',
    },
    {
      id: 'commercial',
      name: 'Commercial',
      icon: 'store',
      description: 'Shops, offices, business establishments',
    },
    {
      id: 'education',
      name: 'Education',
      icon: 'school',
      description: 'Schools, universities, training centers',
    },
    {
      id: 'entertainment_arts_culture',
      name: 'Entertainment, Arts & Culture',
      icon: 'theater_comedy',
      description: 'Theaters, museums, galleries, venues',
    },
    {
      id: 'financial',
      name: 'Financial',
      icon: 'payments',
      description: 'Banks, ATMs, financial services',
    },
    {
      id: 'healthcare',
      name: 'Healthcare',
      icon: 'local_hospital',
      description: 'Hospitals, clinics, pharmacies',
    },
    {
      id: 'others',
      name: 'Others',
      icon: 'more_horiz',
      description: 'Miscellaneous points of interest',
    },
    {
      id: 'sustenance',
      name: 'Sustenance',
      icon: 'restaurant',
      description: 'Restaurants, cafes, food establishments',
    },
    {
      id: 'tourism',
      name: 'Tourism',
      icon: 'tour',
      description: 'Hotels, attractions, tourist services',
    },
    {
      id: 'transportation',
      name: 'Transportation',
      icon: 'directions_transit',
      description: 'Transit stations, parking, transportation hubs',
    },
  ] as BusinessType[],

  radiusOptions: [
    { id: 'radius_3', value: 3, unit: 'miles', label: '3 miles' },
    { id: 'radius_5', value: 5, unit: 'miles', label: '5 miles' },
    { id: 'radius_10', value: 10, unit: 'miles', label: '10 miles' },
  ] as RadiusOption[],

  drivetimeOptions: [
    { id: 'drivetime_5', value: 5, unit: 'minutes', label: '5 minutes' },
    { id: 'drivetime_10', value: 10, unit: 'minutes', label: '10 minutes' },
    { id: 'drivetime_15', value: 15, unit: 'minutes', label: '15 minutes' },
  ] as DrivetimeOption[],

  locationOptions: [
    { id: 'manhattan_nyc', name: 'Manhattan, NYC', description: 'New York City, Manhattan', coordinates: { longitude: -73.9857, latitude: 40.7484 } },
    { id: 'los_angeles', name: 'Los Angeles Center', description: 'Downtown Los Angeles', coordinates: { longitude: -118.2437, latitude: 34.0522 } },
    { id: 'chicago', name: 'Chicago', description: 'Downtown Chicago', coordinates: { longitude: -87.6298, latitude: 41.8781 } },
    { id: 'san_francisco', name: 'San Francisco', description: 'San Francisco Bay Area', coordinates: { longitude: -122.4194, latitude: 37.7749 } },
    { id: 'miami', name: 'Miami', description: 'Miami, Florida', coordinates: { longitude: -80.1918, latitude: 25.7617 } },
    { id: 'custom', name: 'Custom Location', description: 'Enter your own address or location' },
  ] as LocationOption[],

  quickChips: [
    {
      id: 'find_nearby',
      label: 'Find a location for a business',
      prompt: 'Find a location for a business',
    },
    {
      id: 'zoom_in_1',
      label: 'Zoom in 1 level',
      prompt: 'Zoom in 1 level of the map',
    },
    {
      id: 'zoom_out_1',
      label: 'Zoom out 1 level',
      prompt: 'Zoom out 1 level of the map',
    },
    {
      id: 'update_color_to_red',
      label: 'Update the color of the active layer to red',
      prompt: 'Update the color of the active layer to red',
    },
  ],

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
      id: 'education_income_correlation',
      label: 'Education vs income correlation',
      prompt: 'Show me the correlation between education and income across counties',
    },
    {
      id: 'democrat_over_60',
      label: 'Counties with 60%+ Democratic votes',
      prompt: 'Display counties where Democratic votes exceeded 60%',
    },
  ],
};

export type SemanticConfig = typeof SEMANTIC_CONFIG;
