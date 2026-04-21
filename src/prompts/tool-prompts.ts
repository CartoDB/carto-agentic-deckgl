/**
 * Tool-specific prompts for the map control agent
 * Each tool has detailed execution instructions for the system prompt
 */

import { TOOL_NAMES } from '../definitions/dictionary.js';
import { sharedSections } from './shared-sections.js';
import type { ToolPromptConfig } from './types.js';

export const toolPrompts: Record<string, ToolPromptConfig> = {
  [TOOL_NAMES.SET_DECK_STATE]: {
    name: TOOL_NAMES.SET_DECK_STATE,
    prompt: `### 1. set-deck-state
Set Deck.gl visualization state including view navigation, basemap style, layers, widgets, and effects.

${sharedSections.defaultStyling}

**Navigate to a location:**
{ "initialViewState": { "latitude": 48.8566, "longitude": 2.3522, "zoom": 12 } }

**Change basemap (ONLY when explicitly requested by the user):**
{ "mapStyle": "dark-matter" }
Options: "dark-matter" (dark theme), "positron" (light theme), "voyager" (colorful roads)
**IMPORTANT: NEVER change mapStyle unless the user explicitly asks to change the basemap/map style/theme. Adding layers, navigating, or any other action must NOT include mapStyle. Do NOT infer basemap changes from context (e.g., "dark data" does not mean "dark basemap").**

**Both at once (only if user explicitly requests basemap change along with navigation):**
{ "initialViewState": { "latitude": 40.7128, "longitude": -74.006, "zoom": 14 }, "mapStyle": "dark-matter" }

**Navigate + add layer:**
{ "initialViewState": { "latitude": 40.7128, "longitude": -74.006, "zoom": 12 }, "layers": [{ ... }] }

- pitch (0-85) and bearing (-180 to 180) are optional
- transitionDuration defaults to 1000ms
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

**WIDGET SUPPORT (Vega-Lite):**
After adding a data layer, you may suggest widgets to the user. If they agree, add widgets using the widgets array.
Each widget must follow this WidgetSpec format:

{
  "id": "unique-widget-id",
  "name": "Human-readable Widget Title",
  "type": "formula" | "category",
  "source": {
    "tableName": "EXACT_TABLE_NAME_FROM_SEMANTIC_LAYER",
    "sourceFunction": "vectorTableSource" | "h3TableSource" | "quadbinTableSource",
    "columns": ["column_name"],
    "aggregationExp": "SUM(column) as column"
  },
  "params": {
    "column": "column_name",
    "operation": "sum" | "avg" | "count" | "min" | "max",
    "ticks": [0, 100, 500, 1000]
  },
  "vegaLiteSpec": { /* Vega-Lite v5 spec WITHOUT data — data is injected by frontend */ }
}

**Widget examples:**

Formula widget (single number) from H3 layer:
{ "widgets": [{ "id": "total-pop", "name": "Total Population", "type": "formula",
  "source": { "tableName": "TABLE", "sourceFunction": "h3TableSource", "columns": ["population"], "aggregationExp": "SUM(population) as population" },
  "params": { "column": "population", "operation": "sum" },
  "vegaLiteSpec": { "$schema": "https://vega.github.io/schema/vega-lite/v5.json", "mark": "text",
    "encoding": { "text": { "field": "value", "type": "quantitative", "format": ",.0f" } } }
}]}

Category widget (bar chart) from H3 layer:
{ "widgets": [{ "id": "urbanity-dist", "name": "Urbanity Distribution", "type": "category",
  "source": { "tableName": "TABLE", "sourceFunction": "h3TableSource", "columns": ["urbanity"], "aggregationExp": "COUNT(*) as count" },
  "params": { "column": "urbanity", "operation": "count" },
  "vegaLiteSpec": { "$schema": "https://vega.github.io/schema/vega-lite/v5.json", "mark": "bar",
    "encoding": { "x": { "field": "name", "type": "nominal" }, "y": { "field": "value", "type": "quantitative" } } }
}]}

Remove widgets:
{ "removeWidgetIds": ["total-pop", "urbanity-dist"] }

**Widget rules:**
1. ALWAYS ask the user before adding widgets. Suggest 2-3 relevant widgets based on the semantic layer fields.
2. Use the SAME tableName and sourceFunction as the loaded layer.
3. For numeric columns: suggest formula (SUM/AVG) widgets.
4. For categorical columns (like urbanity): suggest category widgets.
5. Widgets automatically filter when a mask is active — no extra action needed.
6. The vegaLiteSpec must NOT include a data field — the frontend injects data from CARTO API.
   CRITICAL: The CARTO API returns FIXED field names. Your vegaLiteSpec encoding MUST use these exact fields:
   - category data: [{name, value}] → use field "name" for x-axis, field "value" for y-axis
   - formula data: {value} → use field "value"
7. Widget IDs must be unique and descriptive (e.g., "population-formula", "urbanity-category").
8. CRITICAL: For H3/Quadbin layers, ALWAYS include "aggregationExp" in source (e.g., "SUM(population) as population"). Without it, the API returns a 400 error. For vectorTableSource, aggregationExp is NOT needed.
9. CRITICAL: The "operation" field in params is REQUIRED for ALL widget types (formula, category, table). Never omit it.

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
    "aggregationExp": "SUM(population) as population",
    "filters": {
      "urbanity": {
        "in": { "values": ["urban"] }
      }
    }
  },
  "getFillColor": {
    "@@function": "colorBins",
    "attr": "population",
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
    "tableName": "TABLE_NAME_FROM_SEMANTIC_LAYER",
    "filters": {
      "group_name": {
        "in": { "values": ["Financial", "Healthcare"] }
      }
    }
  }
}

**REMOVING FILTERS:**
To remove all filters from a layer, use the SAME layer ID and set filters to empty object: \`"filters": {}\`
CRITICAL: Do NOT omit the filters property — you MUST explicitly send \`"filters": {}\` for filters to be cleared.
CRITICAL: Do NOT create a new layer to remove filters — ALWAYS update the existing layer using its SAME ID.

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
- Provides configuration details (aggregation method, styling function, domain values) OR
- Requests filter changes (add filter, modify filter, remove filter, clear filters)

Follow these steps:

1. **IDENTIFY the target layer:**
   - If user specifies a layer → use that layer ID
   - If user doesn't specify → use the **Active layer** from CURRENT MAP STATE section below
   - CRITICAL: If user just added a layer and now provides config details, they want to UPDATE that layer!
   - **If multiple layers exist and user doesn't specify which one, ASK the user which layer to update.**

2. **REUSE the SAME layer ID** - do NOT generate a new ID!

3. **Examples of commands that should UPDATE the active layer (NOT create new):**
   - "SUM by population" → Update aggregationExp in data source
   - "use colorBins with Teal palette" → Update getFillColor
   - "set domain to [0, 100, 1000, 10000]" → Update getFillColor.domain
   - "make it 3D" → Update extruded: true
   - "change to PurpOr" → Update getFillColor.colors
   - "filter by Cafe" → Update data.filters, keep SAME layer ID
   - "also show Pub" → Update data.filters, keep SAME layer ID
   - "remove filter" / "clear filters" → Set data.filters: {}, keep SAME layer ID

4. **Send update with same layer ID:**
   Good example - adding aggregation and styling to active layer "my-quadbin":
   {
     "@@type": "QuadbinTileLayer",
     "id": "my-quadbin",
     "data": {
       "@@function": "quadbinTableSource",
       "tableName": "...",
       "aggregationExp": "SUM(population) as population"
     },
     "getFillColor": {
       "@@function": "colorBins",
       "attr": "population",
       "domain": [0, 1000, 10000, 100000, 1000000],
       "colors": "Teal"
     },
     "updateTriggers": {
       "getFillColor": { "attr": "population", "domain": [0, 1000, 10000, 100000, 1000000], "colors": "Teal" }
     }
   }

   BAD - This creates a DUPLICATE:
   {
     "id": "population-quadbin-styled",
     ...
   }

**Common style/config/filter update commands:**
- "SUM by population" → Update data.aggregationExp, keep SAME layer ID
- "change palette to Teal" → Update getFillColor.colors, keep SAME layer ID
- "update domain to [0, 100, 1000]" → Update getFillColor.domain, keep SAME layer ID
- "make it 3D" / "extrude" → Update extruded: true, keep SAME layer ID
- "filter by Cafe and Pub" → Update data.filters, keep SAME layer ID
- "remove filter" / "show all" → Set data.filters: {}, keep SAME layer ID

Example workflow:
1. User: "Add quadbin layer from table X" → Create layer with id="quadbin-layer"
2. User: "SUM by population, use colorBins" → Update layer with SAME id="quadbin-layer" (not a new ID!)
3. User: "Use Temps palette" → Update layer with SAME id="quadbin-layer"
4. User: "Change domain to [0, 100, 1000]" → Update layer with SAME id="quadbin-layer"

Example filter workflow:
1. User: "Show Food & Drink POIs" → Create layer with id="pois-layer"
2. User: "Filter by Cafe and Pub" → Update SAME id="pois-layer" with filters (NOT a new layer!)
3. User: "Remove filter" → Update SAME id="pois-layer" with filters: {} (NOT a new layer!)

**H3TileLayer (spatial aggregation with hexagons):**
H3 layers aggregate data into hexagonal cells. IMPORTANT: aggregationExp is REQUIRED.
**IMPORTANT: H3 layers must have \`extruded: false\` by default. Do NOT set extruded to true unless the user explicitly asks for 3D.**

Basic H3 layer with sum aggregation:
{
  "@@type": "H3TileLayer",
  "id": "population-h3",
  "data": {
    "@@function": "h3TableSource",
    "tableName": "TABLE_NAME",
    "aggregationExp": "SUM(population) as population"
  },
  "opacity": 0.8,
  "extruded": false,
  "getFillColor": {
    "@@function": "colorBins",
    "attr": "population",
    "domain": [0, 1000, 10000, 100000, 1000000],
    "colors": "Sunset"
  },
  "updateTriggers": {
    "getFillColor": { "attr": "population", "domain": [0, 1000, 10000, 100000, 1000000], "colors": "Sunset" }
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
    "aggregationExp": "AVG(temperature) as temperature"
  },
  "getFillColor": {
    "@@function": "colorContinuous",
    "attr": "temperature",
    "domain": [0, 100],
    "colors": "Temps"
  },
  "updateTriggers": {
    "getFillColor": { "attr": "temperature", "domain": [0, 100], "colors": "Temps" }
  }
}

**H3 Aggregation Expressions:**
- SUM(column) as column - Total of values in each hexagon (e.g., SUM(population) as population)
- AVG(column) as column - Average value per hexagon (e.g., AVG(temperature) as temperature)
- COUNT(*) as count - Number of records per hexagon
- MIN/MAX(column) as column - Min/max values (e.g., MAX(income) as income)
- Multiple aggregations: SUM(population) as population, SUM(male) as male

**Color Styling Functions (for getFillColor):**
1. colorBins - Threshold-based (discrete breaks):
   { "@@function": "colorBins", "attr": "population", "domain": [100, 500, 1000], "colors": "Sunset" }

2. colorCategories - Categorical data:
   { "@@function": "colorCategories", "attr": "category", "domain": ["A", "B", "C"], "colors": "Bold" }

3. colorContinuous - Smooth interpolation:
   { "@@function": "colorContinuous", "attr": "temperature", "domain": [0, 100], "colors": "Temps" }

**Available Color Palettes:**
Sunset, Teal, BluYl, PurpOr, PinkYl, Bold, Temps, Emrld, Burg, OrYel, Peach, Mint, Magenta

**CRITICAL: updateTriggers for Color Changes:**
When using color styling functions (colorBins, colorCategories, colorContinuous), ALWAYS include updateTriggers to ensure deck.gl recalculates colors when parameters change:

"updateTriggers": {
  "getFillColor": { "attr": "population", "domain": [...], "colors": "Sunset" }
}

This is REQUIRED when:
- Changing the attribute (attr) used for coloring
- Modifying the domain/thresholds
- Switching color palettes

The updateTriggers value should mirror the color function parameters. When any parameter changes, deck.gl will detect the difference and re-evaluate the accessor.

**H3 Guidelines:**
- aggregationExp is REQUIRED - use the column name as alias (e.g., "SUM(population) as population", NOT "SUM(population) as value")
- For multiple aggregations, comma-separate them: "SUM(population) as population, SUM(male) as male"
- Ask user about aggregation method (SUM, AVG, COUNT, etc.) if not specified
- Ask user about color classification preference (colorBins, colorCategories, colorContinuous)
- Use colorBins for numeric thresholds, colorCategories for text categories
- The "attr" in color functions must match the alias in aggregationExp (the column name)

**QuadbinTileLayer (spatial aggregation with square cells):**
Quadbin layers aggregate data into square cells using the Bing Maps tile system. IMPORTANT: aggregationExp is REQUIRED.
**IMPORTANT: Quadbin layers must have \`extruded: false\` by default. Do NOT set extruded to true unless the user explicitly asks for 3D.**

Basic Quadbin layer with sum aggregation:
{
  "@@type": "QuadbinTileLayer",
  "id": "population-quadbin",
  "data": {
    "@@function": "quadbinTableSource",
    "tableName": "TABLE_NAME",
    "aggregationExp": "SUM(population) as population"
  },
  "opacity": 0.8,
  "extruded": false,
  "getFillColor": {
    "@@function": "colorBins",
    "attr": "population",
    "domain": [0, 1000, 10000, 100000, 1000000],
    "colors": "PinkYl"
  },
  "updateTriggers": {
    "getFillColor": { "attr": "population", "domain": [0, 1000, 10000, 100000, 1000000], "colors": "PinkYl" }
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
    "aggregationExp": "AVG(temperature) as temperature"
  },
  "getFillColor": {
    "@@function": "colorContinuous",
    "attr": "temperature",
    "domain": [0, 100],
    "colors": "Temps"
  },
  "updateTriggers": {
    "getFillColor": { "attr": "temperature", "domain": [0, 100], "colors": "Temps" }
  }
}

3D extruded Quadbin layer with multi-aggregation (color by one column, extrude by another):
{
  "@@type": "QuadbinTileLayer",
  "id": "demographics-quadbin-3d",
  "data": {
    "@@function": "quadbinTableSource",
    "tableName": "TABLE_NAME",
    "aggregationExp": "SUM(population) as population, SUM(male) as male",
    "aggregationResLevel": 8
  },
  "extruded": true,
  "getElevation": "@@=properties.male",
  "elevationScale": 100,
  "getFillColor": {
    "@@function": "colorBins",
    "attr": "population",
    "domain": [0, 1000, 10000, 100000],
    "colors": "Sunset"
  },
  "updateTriggers": {
    "getFillColor": { "attr": "population", "domain": [0, 1000, 10000, 100000], "colors": "Sunset" }
  }
}

**Quadbin Aggregation Expressions:**
- SUM(column) as column - Total of values in each square cell (e.g., SUM(sales) as sales)
- AVG(column) as column - Average value per cell (e.g., AVG(temperature) as temperature)
- COUNT(*) as count - Number of records per cell
- MIN/MAX(column) as column - Min/max values (e.g., MAX(income) as income)
- Multiple aggregations: SUM(population) as population, SUM(male) as male

**Quadbin Guidelines:**
- aggregationExp is REQUIRED - use the column name as alias (e.g., "SUM(population) as population", NOT "SUM(population) as value")
- For multiple aggregations, comma-separate them: "SUM(population) as population, SUM(male) as male"
- Resolution levels range from 0-26 (vs H3's 0-15)
- Ask user about aggregation method (SUM, AVG, COUNT, etc.) if not specified
- Ask user about color classification preference (colorBins, colorCategories, colorContinuous)
- Use colorBins for numeric thresholds, colorCategories for text categories
- The "attr" in color functions must match the alias in aggregationExp (the column name)
- Quadbin uses square cells (good for Bing Maps tile alignment), H3 uses hexagons (better for distance analysis)

**When to use Quadbin vs H3:**
- Use Quadbin when data is already indexed in Quadbin format
- Use Quadbin for alignment with Bing Maps tile pyramid
- Use H3 for more uniform distance calculations (hexagons have equal area)
- Check the table name or ask the user which spatial index their data uses

**IMPORTANT: When user asks to update a specific property or accessor, DO NOT update any other property or accessor.
Only send the properties that need to change — the merge system preserves existing properties.

Examples:
- "color by X" or "change palette" → ONLY change getFillColor, data.columns, and updateTriggers. Do NOT change getPointRadius, getLineWidth, lineWidthMinPixels, getLineColor, opacity, or any sizing property.
- "make points bigger" → ONLY change getPointRadius / pointRadiusMinPixels. Do NOT change getFillColor or getLineColor.
- "change border color" → ONLY change getLineColor. Do NOT change getLineWidth, getFillColor, or sizing.
- "change line width" → ONLY change getLineWidth / lineWidthMinPixels. Do NOT change colors or other properties.

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

  [TOOL_NAMES.SET_MARKER]: {
    name: TOOL_NAMES.SET_MARKER,
    prompt: `### 2. set-marker
Manage location marker pins on the map: add, remove a specific marker, or clear all markers.

**Parameters:**
- \`action\` (optional, default "add"): \`"add"\` | \`"remove"\` | \`"clear-all"\`
- \`latitude\` (required for add/remove): Latitude coordinate
- \`longitude\` (required for add/remove): Longitude coordinate

**Examples:**
Add a marker: \`{ "latitude": 40.7128, "longitude": -74.006 }\`
Remove a specific marker: \`{ "action": "remove", "latitude": 40.7128, "longitude": -74.006 }\`
Clear all markers: \`{ "action": "clear-all" }\`

**ABSOLUTE RULE — READ FIRST:**
Do NOT call set-marker for simple navigation/fly-to commands. If the user says "fly to X", "go to X", "show me X", "navigate to X", or "zoom to X" WITHOUT explicitly mentioning a marker, you MUST NOT call set-marker. Only call set-deck-state with initialViewState.

**WHEN TO CALL set-marker (ALL conditions must be met):**
- The user explicitly says "add a marker", "mark this location", "pin this spot", "place a pin" — OR
- An MCP spatial analysis tool will be executed (buffer, drivetime, isoline) — these always get a marker BEFORE the MCP tool call
- When combined with navigation AND marker mention: "fly to Paris and add a marker"
- The user says "clear markers", "remove all markers", "delete markers" → use action "clear-all"
- The user says "remove the marker on X" → geocode X, then use action "remove" with the coordinates

**WHEN NOT TO CALL set-marker:**
- "fly to [place]" — NO marker (just navigation)
- "go to [place]" — NO marker (just navigation)
- "show me [place]" — NO marker (just navigation)
- "zoom to [place]" — NO marker (just navigation)
- "navigate to [place]" — NO marker (just navigation)
- Layer addition/styling/removal operations — NO marker
- Map style/basemap changes — NO marker
- ANY command that does not explicitly request a marker or involve MCP spatial analysis — NO marker

**CRITICAL RULES:**
1. By default, markers ACCUMULATE. Each add call places a new pin without removing previous ones. If a marker already exists at the same coordinates, it is not duplicated.
2. Use action "remove" to remove an individual marker by its coordinates. Use action "clear-all" to remove every marker at once.
3. Coordinates should match the target location (same as initialViewState coordinates).
4. For MCP workflows: call set-marker BEFORE the MCP tool starts, right after set-deck-state (flyTo). Sequence: lds-geocode → set-deck-state (flyTo) → set-marker → MCP tool → set-deck-state (add layer).
5. The marker layer is managed automatically - do NOT remove it with set-deck-state removeLayerIds.
`,
  },

  [TOOL_NAMES.SET_MASK_LAYER]: {
    name: TOOL_NAMES.SET_MASK_LAYER,
    prompt: `### 3. set-mask-layer
Manage the editable mask layer: set a GeoJSON geometry to mask/filter layers, enable drawing mode, or clear the mask.

**Parameters:**
- \`action\` (required): \`"set"\` | \`"enable-draw"\` | \`"clear"\`
- \`geometry\` (optional, for "set"): GeoJSON Polygon, MultiPolygon, Feature, or FeatureCollection. Use when geometry is already available.
- \`tableName\` (optional, for "set"): CARTO table name containing mask geometry (from MCP workflow result). The frontend fetches geometry directly. Mutually exclusive with geometry.

**Examples:**
Set mask from MCP result table: \`{ "action": "set", "tableName": "carto-demo-data.demo_tables.buffer_result" }\`
Set mask from geometry: \`{ "action": "set", "geometry": { "type": "Polygon", "coordinates": [...] } }\`
Enable drawing mode: \`{ "action": "enable-draw" }\`
Clear mask: \`{ "action": "clear" }\`

**WHEN TO CALL set-mask-layer:**
- The user explicitly asks to draw a mask, filter area, or region of interest → use "enable-draw"
- The user explicitly asks to filter or mask using an MCP result → use "set" with tableName from the [MCP Result Table Available] message
- The user says "clear the mask", "remove the filter area", etc. → use "clear"

**MCP Result → Mask (USER-INITIATED ONLY):**
When the user asks to filter by an MCP result area:
1. Find the [MCP Result Table Available] message in conversation history.
2. Use the table name from that message with the tableName parameter.
3. Call set-mask-layer { action: "set", tableName: "<table name from message>" }
If no [MCP Result Table Available] message exists, use: set-mask-layer { action: "enable-draw" }
Do NOT automatically apply a mask when an MCP workflow completes — only when the user explicitly requests it.

Trigger phrases: "Filter by this area", "Mask the map to this region", "Use this as a spatial filter", "Only show data inside the drivetime area", "Clip the layers to the buffer zone"

**WHEN NOT TO CALL set-mask-layer:**
- Simple navigation/fly-to requests — use set-deck-state
- Adding/removing data layers — use set-deck-state
- Changing basemap — use set-deck-state
- Adding markers — use set-marker
- The user has NOT mentioned masking, filtering by area, or drawing regions
- An MCP workflow just completed but the user did NOT ask to mask or filter

**CRITICAL RULES:**
1. Only one mask can be active at a time — setting a new mask replaces the previous one.
2. The mask layer is separate from data layers — do NOT try to create mask layers with set-deck-state.
3. When mask is active, all data layers are visually masked (only rendered inside the mask geometry).
4. The mask layer is managed automatically — do NOT remove it with set-deck-state removeLayerIds.
5. Do NOT auto-apply mask after MCP results — only when the user explicitly requests it.
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
