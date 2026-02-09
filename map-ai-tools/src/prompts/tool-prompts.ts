/**
 * Tool-specific prompts for the map control agent
 * Each tool has detailed execution instructions for the system prompt
 */

import { TOOL_NAMES } from '../definitions/dictionary.js';
import type { ToolPromptConfig } from './types.js';

export const toolPrompts: Record<string, ToolPromptConfig> = {
  [TOOL_NAMES.SET_MAP_VIEW]: {
    name: TOOL_NAMES.SET_MAP_VIEW,
    prompt: `### 1. set-map-view
Navigate the map to specific coordinates with optional pitch/bearing.
- Input: { latitude, longitude, zoom, pitch?, bearing? }
- Use to fly to a location`,
  },

  [TOOL_NAMES.SET_BASEMAP]: {
    name: TOOL_NAMES.SET_BASEMAP,
    prompt: `### 2. set-basemap
Change the map basemap style.
- Options: "dark-matter", "positron", "voyager"`,
  },

  [TOOL_NAMES.SET_DECK_STATE]: {
    name: TOOL_NAMES.SET_DECK_STATE,
    prompt: `### 3. set-deck-state ⭐ MOST POWERFUL
Set Deck.gl visualization state including layers, widgets, and effects.
Pass configurations in Deck.gl JSON format with @@type, @@function prefixes.
Layers are MERGED by ID - existing layers not in the update are preserved.

**IMPORTANT: To remove ALL layers (when user says "remove all layers", "reset", "delete all layers", "clear layers", etc.), pass an explicitly empty array: { "layers": [] }**

**To remove SPECIFIC layers (when user says "remove POIs layer", "delete the demographics layer", etc.), use removeLayerIds:**
{ "removeLayerIds": ["layer-id-to-remove"] }

This removes the specified layer(s) while keeping all other layers intact.

**LAYER REMOVAL EXAMPLES:**
1. Remove single layer: { "removeLayerIds": ["pois-layer"] }
2. Remove multiple layers: { "removeLayerIds": ["pois-layer", "buffer-layer"] }
3. Remove layer and update another: { "removeLayerIds": ["old-layer"], "layers": [{ "id": "other-layer", "visible": true }] }

**CRITICAL: If user requests to add a new layer and no type is provided (quanbin, h3, etc.), use vectorTileLayer as default.**

**CRITICAL SOURCE FUNCTIONS - Do NOT invent new function names:**
- For VectorTileLayer data: use \`vectorTableSource\` (NOT vectorTileSource - this does NOT exist!)
- For H3TileLayer data: use \`h3TableSource\`
- For QuadbinTileLayer data: use \`quadbinTableSource\`

**CRITICAL TABLE NAMES - Do NOT invent table names:**
- ONLY use tables listed in the "Quick Reference: Tables by Layer Type" section above
- The \`tableName\` parameter MUST be the EXACT \`sql_table\` value (e.g., "ps-catalog-default.ps-demo-tables.derived_spatialfeatures_usa_h3res8_v1_yearly_v2")
- NEVER invent, shorten, or guess table names (e.g., do NOT use "us_demographics_table" - this does NOT exist!)
- If the user asks for data not in the semantic layer, inform them that the table is not available

**CRITICAL: Layer \`extruded\` property must ALWAYS be \`false\` by default. Only set \`extruded: true\` when the user explicitly requests 3D visualization (e.g., "make it 3D", "extrude the layer", "show in 3D").**

**Basic layer example (DEFAULT STYLE - use this for POI/point layers):**
{
  "@@type": "VectorTileLayer",
  "id": "pois-layer",
  "data": {
    "@@function": "vectorTableSource",
    "tableName": "TABLE_NAME"
  },
  "getFillColor": [66, 135, 245, 200],
  "getPointRadius": 10,
  "pointRadiusMinPixels": 4,
  "pointRadiusMaxPixels": 20,
  "lineWidthMinPixels": 0.5,
  "lineWidthMaxPixels": 2,
  "getLineWidth": 1,
  "getLineColor": [255, 255, 255, 200],
  "pickable": true
}

**Polygon layer with colorBins/colorContinuous styling (use for polygons like block groups, counties, states):**
For polygon data that needs color styling by a numeric column, you MUST:
1. Include the column in \`data.columns\` array (use the SQL column name from semantic layer)
2. Use colorBins or colorContinuous in getFillColor with the column name as \`attr\`
3. Include updateTriggers

Example - Polygon layer styled by a numeric column:
{
  "@@type": "VectorTileLayer",
  "id": "polygon-layer-styled",
  "data": {
    "@@function": "vectorTableSource",
    "tableName": "TABLE_NAME_FROM_SEMANTIC_LAYER",
    "columns": ["SQL_COLUMN_NAME"]
  },
  "opacity": 0.8,
  "extruded": false,
  "getFillColor": {
    "@@function": "colorContinuous",
    "attr": "SQL_COLUMN_NAME",
    "domain": [MIN_VALUE, MAX_VALUE],
    "colors": "Sunset"
  },
  "updateTriggers": {
    "getFillColor": { "attr": "SQL_COLUMN_NAME", "domain": [MIN_VALUE, MAX_VALUE], "colors": "Sunset" }
  },
  "stroked": true,
  "lineWidthMinPixels": 0.5,
  "getLineWidth": 1,
  "getLineColor": [255, 255, 255, 100],
  "pickable": true
}

**CRITICAL for polygon layers with color styling:**
- \`data.columns\` MUST include the column used for styling
- The \`attr\` in colorBins/colorContinuous MUST match the SQL column name exactly
- Check the semantic layer: use the \`sql\` field value, not the dimension \`name\` (they may differ)
- Get domain values from the semantic layer's \`geo_viz.domain\` field when available

## CARTO COLUMN FILTERS (Server-Side Data Filtering)

Filters allow you to filter layer data server-side without modifying SQL queries.
Add filters to ANY data source (vectorTableSource, h3TableSource, quadbinTableSource, etc.).

**CRITICAL: Filter values must be wrapped in a { "values": [...] } object!**

**Filter Types:**
| Type | Description | Syntax |
|------|-------------|--------|
| \`in\` | Exact match (categorical) | \`{ "in": { "values": ["A", "B"] } }\` |
| \`between\` | Numeric range [min, max] inclusive | \`{ "between": { "values": [[0, 1000]] } }\` |
| \`closed_open\` | Numeric range [min, max) - max excluded | \`{ "closed_open": { "values": [[0, 100]] } }\` |
| \`time\` | Date/timestamp range (milliseconds) | \`{ "time": { "values": [[start, end]] } }\` |
| \`stringSearch\` | Partial text match (case-insensitive) | \`{ "stringSearch": { "values": ["text"] } }\` |

**Filter Structure in Data Source:**
{
  "@@function": "vectorTableSource",
  "tableName": "my_table",
  "filters": {
    "column_name": {
      "FILTER_TYPE": { "values": [...] }
    }
  }
}

**FILTER EXAMPLES:**

1. **Category filter (IN)** - "Show only Financial POIs":
{
  "@@type": "VectorTileLayer",
  "id": "pois-financial",
  "data": {
    "@@function": "vectorTableSource",
    "tableName": "ps-catalog-default.ps-demo-tables.osm_pois_usa",
    "filters": {
      "group_name": {
        "in": { "values": ["Financial"] }
      }
    }
  },
  "getFillColor": [66, 135, 245, 200],
  "pickable": true
}

2. **Multiple categories** - "Show Financial and Healthcare POIs":
{
  "filters": {
    "group_name": {
      "in": { "values": ["Financial", "Healthcare"] }
    }
  }
}

3. **Numeric range (BETWEEN)** - "Show places with population > 100000":
{
  "filters": {
    "pop_max": {
      "between": { "values": [[100000, 999999999]] }
    }
  }
}

4. **Multiple numeric ranges** - "Population 10k-50k OR 100k-500k":
{
  "filters": {
    "pop_max": {
      "between": { "values": [[10000, 50000], [100000, 500000]] }
    }
  }
}

5. **Text search (STRING_SEARCH)** - "Find POIs with 'bank' in name":
{
  "filters": {
    "name": {
      "stringSearch": { "values": ["bank"] }
    }
  }
}

6. **Multiple filters (AND logic)** - "Financial POIs in urban areas":
{
  "filters": {
    "group_name": {
      "in": { "values": ["Financial"] }
    },
    "urbanity": {
      "in": { "values": ["urban"] }
    }
  }
}

7. **Filter with H3/Quadbin layers:**
{
  "@@type": "H3TileLayer",
  "id": "urban-population-h3",
  "data": {
    "@@function": "h3TableSource",
    "tableName": "ps-catalog-default.ps-demo-tables.derived_spatialfeatures_usa_h3res8_v1_yearly_v2",
    "aggregationExp": "SUM(population) as value",
    "filters": {
      "urbanity": {
        "in": { "values": ["urban"] }
      }
    }
  },
  "getFillColor": {
    "@@function": "colorBins",
    "attr": "value",
    "domain": [0, 1000, 10000, 100000],
    "colors": "Sunset"
  }
}

**FILTER OPERATIONS:**

| User Intent | Action |
|-------------|--------|
| "Add POIs layer with Financial category" | Create layer with \`filters: { group_name: { in: { values: ["Financial"] } } }\` |
| "Also show Healthcare" | Update filter: \`filters: { group_name: { in: { values: ["Financial", "Healthcare"] } } }\` |
| "Show all categories" / "Remove filter" | Remove filters property OR set \`filters: {}\` |
| "Filter by population > 50000" | Add \`filters: { population: { between: { values: [[50000, 999999999]] } } }\` |
| "Clear all filters" | Set \`filters: {}\` in data source |

**UPDATING FILTERS on Existing Layers:**
When user wants to modify filters on an existing layer:
1. Use the SAME layer ID
2. Include the complete updated filters object
3. Filters REPLACE previous filters (not merged)

Example - User has layer "pois-financial" and says "also include Healthcare":
{
  "@@type": "VectorTileLayer",
  "id": "pois-financial",
  "data": {
    "@@function": "vectorTableSource",
    "tableName": "ps-catalog-default.ps-demo-tables.osm_pois_usa",
    "filters": {
      "group_name": {
        "in": { "values": ["Financial", "Healthcare"] }
      }
    }
  }
}

**REMOVING FILTERS:**
To remove all filters from a layer, either:
1. Omit the filters property entirely, OR
2. Set filters to empty object: \`"filters": {}\`

**FILTERABLE/STYLABLE COLUMNS:**
Refer to the semantic layer for available columns. Use the \`sql\` field for the actual column name.
- String columns: filter with \`in\` or \`stringSearch\`, style with \`colorCategories\` or \`@@=\`
- Number columns: filter with \`between\`, style with \`colorBins\` or \`colorContinuous\`

**IMPORTANT:** The dimension \`name\` may differ from the SQL column name (e.g., "median_hh_income" → "INCCYMEDHH"). Always use the \`sql\` value from the semantic layer.

**Styling by category (IMPORTANT: use @@= expressions for VectorTileLayer):**
{
  "@@type": "VectorTileLayer",
  "id": "styled-layer",
  "data": {
    "@@function": "vectorTableSource",
    "tableName": "my_table",
    "columns": ["type"]
  },
  "getFillColor": "@@=properties.type === 'airport' ? [255, 0, 0, 200] : properties.type === 'heliport' ? [0, 255, 0, 200] : properties.type === 'seaplane_base' ? [0, 0, 255, 200] : [128, 128, 128, 180]"
}

**Highlight specific category value:**
"getFillColor": "@@=properties.paneltype === 'Totem' ? [255, 0, 0, 200] : [128, 128, 128, 180]"

**Styling by numeric thresholds:**
"getFillColor": "@@=properties.value > 100 ? [255, 0, 0, 200] : properties.value > 50 ? [255, 165, 0, 200] : [0, 255, 0, 200]"

**CRITICAL for @@= styling:**
- MUST include the styling column in data.columns: ["columnName"]
- Access properties via: properties.columnName
- Use ternary expressions: condition ? colorIfTrue : colorIfFalse
- Always include alpha channel in colors: [r, g, b, alpha]

**When to use @@= expressions vs colorBins/colorContinuous:**
- Use **@@= expressions** for CATEGORICAL styling with a few discrete values (e.g., type === 'airport')
- Use **colorBins/colorContinuous** for NUMERIC styling with ranges (e.g., income, population, age)
  - Both work with VectorTileLayer! Not just H3/Quadbin layers.
  - For VectorTileLayer: include column in data.columns and use colorBins/colorContinuous in getFillColor

**CRITICAL: Layer ID Rules:**
- Use UNIQUE, descriptive IDs for each NEW layer (e.g., "fires-layer", "population-h3", "stores-points")
- To UPDATE an existing layer, use the SAME ID as the original layer
- Never reuse an ID for a different layer - this will overwrite the existing one
- The ID should describe the data/purpose, not generic names like "layer-1" or "new-layer"
- Example: If you have "fires-layer" and want to add population data, use "population-layer" (NOT "fires-layer")

**UPDATING EXISTING LAYERS (CRITICAL - DO NOT DUPLICATE):**
When user:
- Requests style changes (palette, color, domain, opacity, etc.) OR
- Provides configuration details (aggregation method, styling function, domain values)

Follow these steps:

1. **IDENTIFY the target layer:**
   - If user specifies a layer → use that layer ID
   - If user doesn't specify → use the **Active layer** from CURRENT MAP STATE section below
   - CRITICAL: If user just added a layer and now provides config details, they want to UPDATE that layer!

2. **REUSE the SAME layer ID** - do NOT generate a new ID!

3. **Examples of commands that should UPDATE the active layer (NOT create new):**
   - "SUM by population" → Update aggregationExp in data source
   - "use colorBins with Teal palette" → Update getFillColor
   - "set domain to [0, 100, 1000, 10000]" → Update getFillColor.domain
   - "make it 3D" → Update extruded: true
   - "change to PurpOr" → Update getFillColor.colors

4. **Send update with same layer ID:**
   Good example - adding aggregation and styling to active layer "my-quadbin":
   {
     "@@type": "QuadbinTileLayer",
     "id": "my-quadbin",
     "data": {
       "@@function": "quadbinTableSource",
       "tableName": "...",
       "aggregationExp": "SUM(population) as value"
     },
     "getFillColor": {
       "@@function": "colorBins",
       "attr": "value",
       "domain": [0, 1000, 10000, 100000, 1000000],
       "colors": "Teal"
     },
     "updateTriggers": {
       "getFillColor": { "attr": "value", "domain": [0, 1000, 10000, 100000, 1000000], "colors": "Teal" }
     }
   }

   BAD - This creates a DUPLICATE:
   {
     "id": "population-quadbin-styled",
     ...
   }

**Common style/config update commands:**
- "SUM by population" → Update data.aggregationExp, keep SAME layer ID
- "change palette to Teal" → Update getFillColor.colors, keep SAME layer ID
- "update domain to [0, 100, 1000]" → Update getFillColor.domain, keep SAME layer ID
- "make it 3D" / "extrude" → Update extruded: true, keep SAME layer ID

Example workflow:
1. User: "Add quadbin layer from table X" → Create layer with id="quadbin-layer"
2. User: "SUM by population, use colorBins" → Update layer with SAME id="quadbin-layer" (not a new ID!)
3. User: "Use Temps palette" → Update layer with SAME id="quadbin-layer"
4. User: "Change domain to [0, 100, 1000]" → Update layer with SAME id="quadbin-layer"

**H3TileLayer (spatial aggregation with hexagons):**
H3 layers aggregate data into hexagonal cells. IMPORTANT: aggregationExp is REQUIRED.

Basic H3 layer with sum aggregation:
{
  "@@type": "H3TileLayer",
  "id": "population-h3",
  "data": {
    "@@function": "h3TableSource",
    "tableName": "TABLE_NAME",
    "aggregationExp": "SUM(population) as value"
  },
  "opacity": 0.8,
  "extruded": false,
  "getFillColor": {
    "@@function": "colorBins",
    "attr": "value",
    "domain": [0, 1000, 10000, 100000, 1000000],
    "colors": "Sunset"
  },
  "updateTriggers": {
    "getFillColor": { "attr": "value", "domain": [0, 1000, 10000, 100000, 1000000], "colors": "Sunset" }
  },
  "lineWidthMinPixels": 0.5,
  "getLineWidth": 0.5,
  "getLineColor": [255, 255, 255, 100],
  "pickable": true
}

H3 with continuous color interpolation:
{
  "@@type": "H3TileLayer",
  "id": "temperature-h3",
  "data": {
    "@@function": "h3QuerySource",
    "sqlQuery": "SELECT * FROM my_table WHERE year = 2023",
    "aggregationExp": "AVG(temperature) as value"
  },
  "getFillColor": {
    "@@function": "colorContinuous",
    "attr": "value",
    "domain": [0, 100],
    "colors": "Temps"
  },
  "updateTriggers": {
    "getFillColor": { "attr": "value", "domain": [0, 100], "colors": "Temps" }
  }
}

**H3 Aggregation Expressions:**
- SUM(column) as value - Total of values in each hexagon
- AVG(column) as value - Average value per hexagon
- COUNT(*) as value - Number of records per hexagon
- MIN/MAX(column) as value - Min/max values

**Color Styling Functions (for getFillColor):**
1. colorBins - Threshold-based (discrete breaks):
   { "@@function": "colorBins", "attr": "value", "domain": [100, 500, 1000], "colors": "Sunset" }

2. colorCategories - Categorical data:
   { "@@function": "colorCategories", "attr": "category", "domain": ["A", "B", "C"], "colors": "Bold" }

3. colorContinuous - Smooth interpolation:
   { "@@function": "colorContinuous", "attr": "value", "domain": [0, 100], "colors": "Temps" }

**Available Color Palettes:**
Sunset, Teal, BluYl, PurpOr, PinkYl, Bold, Temps, Emrld, Burg, OrYel, Peach, Mint, Magenta

**CRITICAL: updateTriggers for Color Changes:**
When using color styling functions (colorBins, colorCategories, colorContinuous), ALWAYS include updateTriggers to ensure deck.gl recalculates colors when parameters change:

"updateTriggers": {
  "getFillColor": { "attr": "value", "domain": [...], "colors": "Sunset" }
}

This is REQUIRED when:
- Changing the attribute (attr) used for coloring
- Modifying the domain/thresholds
- Switching color palettes

The updateTriggers value should mirror the color function parameters. When any parameter changes, deck.gl will detect the difference and re-evaluate the accessor.

**H3 Guidelines:**
- aggregationExp is REQUIRED - always include "as value" suffix
- Ask user about aggregation method (SUM, AVG, COUNT, etc.) if not specified
- Ask user about color classification preference (colorBins, colorCategories, colorContinuous)
- Use colorBins for numeric thresholds, colorCategories for text categories
- The "attr" in color functions must match the alias in aggregationExp (typically "value")

**QuadbinTileLayer (spatial aggregation with square cells):**
Quadbin layers aggregate data into square cells using the Bing Maps tile system. IMPORTANT: aggregationExp is REQUIRED.

Basic Quadbin layer with sum aggregation:
{
  "@@type": "QuadbinTileLayer",
  "id": "population-quadbin",
  "data": {
    "@@function": "quadbinTableSource",
    "tableName": "TABLE_NAME",
    "aggregationExp": "SUM(population) as value"
  },
  "opacity": 0.8,
  "extruded": false,
  "getFillColor": {
    "@@function": "colorBins",
    "attr": "value",
    "domain": [0, 1000, 10000, 100000, 1000000],
    "colors": "PinkYl"
  },
  "updateTriggers": {
    "getFillColor": { "attr": "value", "domain": [0, 1000, 10000, 100000, 1000000], "colors": "PinkYl" }
  },
  "lineWidthMinPixels": 0.5,
  "getLineWidth": 0.5,
  "getLineColor": [255, 255, 255, 100],
  "pickable": true
}

Quadbin with continuous color interpolation:
{
  "@@type": "QuadbinTileLayer",
  "id": "temperature-quadbin",
  "data": {
    "@@function": "quadbinQuerySource",
    "sqlQuery": "SELECT * FROM my_quadbin_table WHERE year = 2023",
    "aggregationExp": "AVG(temperature) as value"
  },
  "getFillColor": {
    "@@function": "colorContinuous",
    "attr": "value",
    "domain": [0, 100],
    "colors": "Temps"
  },
  "updateTriggers": {
    "getFillColor": { "attr": "value", "domain": [0, 100], "colors": "Temps" }
  }
}

3D extruded Quadbin layer:
{
  "@@type": "QuadbinTileLayer",
  "id": "sales-quadbin-3d",
  "data": {
    "@@function": "quadbinTableSource",
    "tableName": "my_sales_quadbin_table",
    "aggregationExp": "SUM(sales) as value",
    "aggregationResLevel": 8
  },
  "extruded": true,
  "getElevation": "@@=properties.value",
  "elevationScale": 100,
  "getFillColor": {
    "@@function": "colorBins",
    "attr": "value",
    "domain": [0, 100, 1000, 10000],
    "colors": "Sunset"
  },
  "updateTriggers": {
    "getFillColor": { "attr": "value", "domain": [0, 100, 1000, 10000], "colors": "Sunset" }
  }
}

**Quadbin Aggregation Expressions:**
- SUM(column) as value - Total of values in each square cell
- AVG(column) as value - Average value per cell
- COUNT(*) as value - Number of records per cell
- MIN/MAX(column) as value - Min/max values

**Quadbin Guidelines:**
- aggregationExp is REQUIRED - always include "as value" suffix
- Resolution levels range from 0-26 (vs H3's 0-15)
- Ask user about aggregation method (SUM, AVG, COUNT, etc.) if not specified
- Ask user about color classification preference (colorBins, colorCategories, colorContinuous)
- Use colorBins for numeric thresholds, colorCategories for text categories
- The "attr" in color functions must match the alias in aggregationExp (typically "value")
- Quadbin uses square cells (good for Bing Maps tile alignment), H3 uses hexagons (better for distance analysis)

**When to use Quadbin vs H3:**
- Use Quadbin when data is already indexed in Quadbin format
- Use Quadbin for alignment with Bing Maps tile pyramid
- Use H3 for more uniform distance calculations (hexagons have equal area)
- Check the table name or ask the user which spatial index their data uses

**IMPORTANT: When user ask to update an specific property or accesor DO NOT update any other property or accesor.
For example:
- If user asks to update the "getFillColor" property, DO NOT update the "getLineColor" property or other not related properties.
- If user asks to update the "getLineWidth" property, DO NOT update the "getLineColor" property or other not related properties.
- If user asks to update the "getLineColor" property, DO NOT update the "getLineWidth" property or other not related properties.
- If user asks to update the "getLineWidth" property, DO NOT update the "getLineColor" property or other not related properties.

**LAYER ORDERING (Stacking Order):**

CRITICAL: Array order is COUNTER-INTUITIVE!
- Array position 0 (FIRST) = BOTTOM of map (renders BEHIND other layers)
- Array position N-1 (LAST) = TOP of map (renders IN FRONT of other layers)

Think of it like stacking papers: first paper goes on desk (bottom), last paper goes on top.

**COMMAND MAPPING:**
| User says | Means | Array position |
|-----------|-------|----------------|
| "to top" / "forward" / "bring up" | visible in front | PUT AT END of array |
| "to bottom" / "back" / "send down" | hidden behind | PUT AT START of array |

**EXAMPLE with real scenario:**

Current state: ["pois-layer", "demographics-h3"]
Visual result: pois=BOTTOM (behind), demographics=TOP (in front)

User: "bring pois forward" or "move pois to top"
- WRONG: ["pois-layer", "demographics-h3"] ← pois still first = still bottom! NO CHANGE!
- CORRECT: ["demographics-h3", "pois-layer"] ← pois now LAST = now on TOP!

User: "send demographics to back" or "move demographics to bottom"
- WRONG: ["pois-layer", "demographics-h3"] ← demographics still last = still top! NO CHANGE!
- CORRECT: ["demographics-h3", "pois-layer"] ← demographics now FIRST = now at BOTTOM!

**KEY INSIGHT:** To move a layer UP/FORWARD, move it TOWARDS THE END of the array.
To move a layer DOWN/BACK, move it TOWARDS THE START of the array.

**TOOL CALL FORMAT:**
{
  "layerOrder": ["bottom-layer-id", "middle-layer-id", "top-layer-id"]
}

**ABSOLUTE RULES - MUST FOLLOW:**
1. ALWAYS call set-deck-state with layerOrder for ANY layer order request - NO EXCEPTIONS
2. NEVER respond with just text - you MUST call the tool FIRST
3. NEVER say "already in position" or "cannot move" - ALWAYS call the tool
4. Use EXACT layer IDs from CURRENT MAP STATE (copy them exactly)
5. Include ALL non-pin layers in the array
6. Even if you THINK the layer is already in the right position, CALL THE TOOL ANYWAY

**FORBIDDEN RESPONSES (NEVER DO THIS):**
- "The layer is already at the bottom" ← WRONG - call the tool!
- "The layer cannot be moved further" ← WRONG - call the tool!
- "The layer is already in the correct position" ← WRONG - call the tool!

**ALWAYS DO THIS:** When user asks to reorder layers → IMMEDIATELY call set-deck-state with layerOrder
`,
  },
};

/**
 * Get the prompt for a specific tool
 */
export function getToolPrompt(toolName: string): string | undefined {
  return toolPrompts[toolName]?.prompt;
}

/**
 * Get prompts for multiple tools
 */
export function getToolPrompts(toolNames: string[]): string {
  return toolNames
    .map((name) => toolPrompts[name]?.prompt)
    .filter(Boolean)
    .join('\n\n');
}
