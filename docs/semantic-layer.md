# Semantic Layer

The semantic layer provides the AI with structured knowledge about available data sources. It acts as a data catalog injected into the system prompt.

---

## YAML Configuration

Semantic layers are defined in YAML files under `semantic/layers/` in each backend. Each file describes available data tables (GeoCubes), their columns (dimensions and measures), and visualization hints.

### Example Structure

```yaml
name: "My Data Catalog"
initialViewState:
  latitude: 40.7
  longitude: -74.0
  zoom: 10
welcomeMessage: "Welcome! Ask me about..."
cubes:
  - name: population
    tableName: "project.dataset.population_table"
    geometryType: h3
    dimensions:
      - name: state
        sql: state_name
        type: string
      - name: year
        sql: year
        type: number
    measures:
      - name: total_population
        sql: population
        agg: sum
      - name: avg_age
        sql: age
        agg: avg
    vizHints:
      - colorFunction: colorBins
        palette: Sunset
        domain: [0, 1000, 10000, 100000]
      - colorFunction: colorContinuous
        palette: Teal
        domain: [0, 500000]
```

### YAML Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Human-readable name for the data catalog |
| `initialViewState` | `object` | Map camera position (latitude, longitude, zoom) |
| `welcomeMessage` | `string` | Welcome message shown in the frontend chat UI |
| `cubes` | `array` | List of GeoCube definitions (data tables) |

---

## Key Types

The semantic layer schema is defined in `semantic/schema.ts` using Zod:

| Type | Description |
|------|-------------|
| `GeoCube` | Table definition with dimensions, measures, joins, and visualization hints. Represents a spatial dataset with geometry (H3, Quadbin, vector tiles). |
| `GeoDimension` | Filterable/groupable column (name, SQL expression, type). Types: `string`, `number`, `boolean`, `date`. Used for categorical filtering and grouping. |
| `GeoMeasure` | Aggregatable column (name, SQL expression, aggregation type). Aggregation types: `sum`, `avg`, `min`, `max`, `count`. Used for quantitative analysis. |
| `GeoVizHint` | Recommended styling (color function, palette, domain). Color functions: `colorBins` (categorical), `colorContinuous` (quantitative), `colorCategories` (discrete). Palettes: CARTO color schemes (Sunset, Teal, Prism, etc.). |
| `SemanticLayer` | Root configuration combining cubes, business context, and metadata. Contains the full data catalog with welcome message and initial view state. |

---

## Loader Functions

The semantic layer loader is defined in `semantic/loader.ts`:

| Function | Description |
|----------|-------------|
| `loadSemanticLayer()` | Reads the first YAML file from `semantic/layers/`. Returns a validated `SemanticLayer` object. Throws an error if no YAML files are found or if validation fails. |
| `renderSemanticLayerAsMarkdown(layer)` | Converts the semantic layer to prompt-ready markdown. Includes cube names, table names, dimensions, measures, and viz hints. This markdown is injected into the system prompt. |
| `getPrimaryCube(layer)` | Returns the first GeoCube in the semantic layer. Used to determine the default data source and initial map position. |
| `getInitialViewState(layer)` | Extracts the map view state from the primary cube. Falls back to the semantic layer's `initialViewState` if the cube doesn't define one. |
| `getWelcomeMessage(layer)` | Returns the welcome message string. Used by the frontend to display welcome chips and initial greeting. |

---

## How It Works

The semantic layer follows this workflow:

1. **Backend loads YAML at startup** via `loadSemanticLayer()`
   - Reads the first `.yaml` file from `semantic/layers/`
   - Validates against the Zod schema
   - Returns a `SemanticLayer` object

2. **Renders to markdown** via `renderSemanticLayerAsMarkdown()`
   - Converts the data catalog to markdown format
   - Includes table names, column definitions, aggregation hints, and visualization suggestions
   - Format optimized for LLM consumption

3. **Markdown injected into system prompt** alongside library and custom prompts
   - See [System Prompt Architecture](system-prompt.md) for the full assembly flow
   - The AI uses this catalog to understand available data sources

4. **AI uses the data catalog** to:
   - Suggest relevant tables for user queries
   - Generate correct table names in `set-deck-state` tool calls
   - Select appropriate color schemes from `vizHints`
   - Choose correct aggregation functions for measures

5. **Semantic config exposed to frontend** via `/api/semantic-config` endpoint
   - Returns `{ welcomeMessage, chips, initialViewState }`
   - Frontend displays welcome chips and sets initial camera position
   - Chips are derived from the welcome message (split by commas or newlines)

---

## Adding a New Data Source

To add a new data source to the semantic layer:

1. **Create a YAML file** in `semantic/layers/` (or edit the existing one)

2. **Define a GeoCube** with the table name and geometry type:
   ```yaml
   cubes:
     - name: my_dataset
       tableName: "catalog.schema.my_table"
       geometryType: h3  # or quadbin, vector, etc.
   ```

3. **Add dimensions** (filterable columns):
   ```yaml
   dimensions:
     - name: category
       sql: category_column
       type: string
     - name: year
       sql: year_column
       type: number
   ```

4. **Add measures** (aggregatable columns):
   ```yaml
   measures:
     - name: total_count
       sql: count_column
       agg: sum
     - name: average_value
       sql: value_column
       agg: avg
   ```

5. **Add vizHints** (optional, recommended):
   ```yaml
   vizHints:
     - colorFunction: colorBins
       palette: Sunset
       domain: [0, 100, 1000, 10000]
   ```

6. **Restart the backend** to reload the semantic layer
   - The new data source will be available to the AI
   - Update the welcome message to mention the new dataset

---

## Cross-References

- **System Prompt**: See [System Prompt Architecture](system-prompt.md) for how semantic context is injected into the prompt
