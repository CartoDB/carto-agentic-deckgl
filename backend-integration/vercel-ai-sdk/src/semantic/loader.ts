/**
 * Semantic Layer Loader
 * Loads YAML semantic layer definitions and renders them as markdown
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import type { SemanticLayer, GeoCube } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load the semantic layer from YAML files in the semantic/layers directory.
 * For now, loads the first .yaml file found.
 */
export function loadSemanticLayer(): SemanticLayer | null {
  const semanticDir = join(__dirname, 'layers');

  if (!existsSync(semanticDir)) {
    console.warn('[Semantic] Layers directory not found:', semanticDir);
    return null;
  }

  const files = readdirSync(semanticDir).filter((f) => f.endsWith('.yaml'));

  if (files.length === 0) {
    console.warn('[Semantic] No .yaml files found in layers directory');
    return null;
  }

  try {
    const content = readFileSync(join(semanticDir, files[0]), 'utf-8');
    return yaml.load(content) as SemanticLayer;
  } catch (error) {
    console.error('[Semantic] Error loading semantic layer:', error);
    return null;
  }
}

/**
 * Get the deck.gl layer type for a geometry type
 */
function getLayerTypeForGeometry(geoType: string): string {
  switch (geoType) {
    case 'h3':
      return 'H3TileLayer';
    case 'quadbin':
      return 'QuadbinTileLayer';
    case 'point':
      return 'VectorTileLayer';
    default:
      return 'VectorTileLayer';
  }
}

/**
 * Get the CARTO source function for a geometry type
 */
function getSourceFunctionForGeometry(geoType: string): string {
  switch (geoType) {
    case 'h3':
      return 'h3TableSource';
    case 'quadbin':
      return 'quadbinTableSource';
    default:
      return 'vectorTableSource';
  }
}

/**
 * Render table recommendations to help AI select the correct table for each layer type
 */
function renderTableRecommendations(cubes: GeoCube[]): string {
  let md = `### Quick Reference: Tables by Layer Type\n`;
  md += `**IMPORTANT:** When creating layers, use these tables from the semantic layer:\n\n`;

  for (const cube of cubes) {
    const geoType = cube.geo.geometry_type;
    const layerType = getLayerTypeForGeometry(geoType);
    const sourceFunc = getSourceFunctionForGeometry(geoType);

    md += `- **${layerType}** (${sourceFunc}): Use \`${cube.sql_table}\`\n`;
    if (cube.title) {
      md += `  - Contains: ${cube.title}\n`;
    }
  }
  md += `\n`;
  return md;
}

/**
 * Render the semantic layer as markdown for injection into the system prompt.
 */
export function renderSemanticLayerAsMarkdown(layer: SemanticLayer): string {
  let md = `## AVAILABLE DATA: ${layer.name}\n\n`;
  md += `${layer.description}\n\n`;

  // Add quick reference for table names by layer type
  md += renderTableRecommendations(layer.cubes);

  // Render business types if available
  if (layer.business_types && layer.business_types.length > 0) {
    md += `### Business Types\n`;
    md += `The user can analyze locations for these business types:\n`;
    for (const bt of layer.business_types) {
      md += `- **${bt.name}** (${bt.id})`;
      if (bt.description) md += `: ${bt.description}`;
      md += `\n`;
      if (bt.relevant_pois && bt.relevant_pois.length > 0) {
        md += `  - Relevant POIs: ${bt.relevant_pois.join(', ')}\n`;
      }
      if (bt.demographic_factors && bt.demographic_factors.length > 0) {
        md += `  - Demographic factors: ${bt.demographic_factors.join(', ')}\n`;
      }
    }
    md += `\n`;
  }

  // Render demographic options if available
  if (layer.demographic_options && layer.demographic_options.length > 0) {
    md += `### Demographic Options\n`;
    md += `Available demographic dimensions for analysis:\n`;
    for (const demo of layer.demographic_options) {
      md += `- **${demo.name}** (${demo.id})`;
      if (demo.description) md += `: ${demo.description}`;
      if (demo.cube_dimension) md += ` [dimension: ${demo.cube_dimension}]`;
      md += `\n`;
    }
    md += `\n`;
  }

  // Render proximity priorities if available
  if (layer.proximity_priorities && layer.proximity_priorities.length > 0) {
    md += `### Proximity Priorities\n`;
    md += `POI categories that can be prioritized for location analysis:\n`;
    for (const pp of layer.proximity_priorities) {
      md += `- **${pp.name}** (${pp.id})`;
      if (pp.description) md += `: ${pp.description}`;
      if (pp.poi_category) md += ` [POI category: ${pp.poi_category}]`;
      md += `\n`;
    }
    md += `\n`;
  }

  // Render data cubes
  for (const cube of layer.cubes) {
    md += renderCubeAsMarkdown(cube);
  }

  return md;
}

/**
 * Render a single cube as markdown
 */
function renderCubeAsMarkdown(cube: GeoCube): string {
  let md = `### Data Source: ${cube.title || cube.name}\n`;
  md += `- **Table:** \`${cube.sql_table}\`\n`;
  if (cube.description) {
    md += `- **Description:** ${cube.description}\n`;
  }
  md += `- **Geometry:** \`${cube.geo.geometry_column}\` (${cube.geo.geometry_type})\n\n`;

  md += `**Dimensions:**\n`;
  for (const dim of cube.dimensions) {
    const desc = dim.description || dim.title || '';
    md += `- \`${dim.name}\` (${dim.type})${desc ? `: ${desc}` : ''}\n`;
    if (dim.geo_viz) {
      md += `  - *Viz hint:* ${dim.geo_viz.style}`;
      if (dim.geo_viz.palette) md += ` with ${dim.geo_viz.palette} palette`;
      if (dim.geo_viz.domain) md += `, domain: [${dim.geo_viz.domain.join(', ')}]`;
      if (dim.geo_viz.recommended) md += ` **(recommended)**`;
      md += `\n`;
    }
  }

  if (cube.measures && cube.measures.length > 0) {
    md += `\n**Measures:**\n`;
    for (const m of cube.measures) {
      const desc = m.description || m.title || '';
      md += `- \`${m.name}\` (${m.type})${desc ? `: ${desc}` : ''}\n`;
    }
  }

  if (cube.joins && cube.joins.length > 0) {
    md += `\n**Joins:**\n`;
    for (const j of cube.joins) {
      md += `- \`${j.name}\` (${j.relationship})\n`;
    }
  }

  md += `\n`;
  return md;
}

/**
 * Get the primary cube from the semantic layer (first cube).
 */
export function getPrimaryCube(layer: SemanticLayer): GeoCube | undefined {
  return layer.cubes[0];
}

/**
 * Get the initial view state from the primary cube.
 */
export function getInitialViewState(layer: SemanticLayer): {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
} {
  const cube = getPrimaryCube(layer);
  const view = cube?.geo.initial_view;

  return {
    longitude: view?.longitude ?? -98.5795,
    latitude: view?.latitude ?? 39.8283,
    zoom: view?.zoom ?? 4,
    pitch: view?.pitch ?? 0,
    bearing: view?.bearing ?? 0,
  };
}

/**
 * Get the welcome message from the semantic layer.
 */
export function getWelcomeMessage(layer: SemanticLayer): string {
  return layer.welcome_message;
}
