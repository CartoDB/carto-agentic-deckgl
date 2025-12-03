// backend/src/services/openai-service.ts
import OpenAI from 'openai';
import { WebSocket } from 'ws';
import {
  getAllToolDefinitions,
  TOOL_NAMES,
  formatToolResponse,
  ErrorCodes,
} from '@carto/maps-ai-tools';
import type { ToolResponse } from '@carto/maps-ai-tools';

// Build system prompt with tool information and map context
function buildSystemPrompt(tools: any[]): string {
  const toolDescriptions = tools.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n');

  return `You are an AI assistant that helps users interact with a map visualization showing worldwide airports.

## Available Tools
${toolDescriptions}

## Map Data Context
The map displays an "Airports" layer containing worldwide airport data with the following properties:
- **name**: Full airport name (e.g., "Los Angeles Int'l", "London Heathrow")
- **abbrev**: Short code (e.g., "LAX", "LHR")
- **iata_code**: IATA airport code
- **gps_code**: ICAO code (4 characters) - the first letter indicates the country/region
- **type**: Airport category - "small", "mid", "major", "major and military", "military"
- **location**: Feature location type (terminal, ramp, runway)

## GPS Code Country Prefixes (for color_features_by_property tool)
When filtering airports by country, use gps_code with "startsWith" operator:
- **USA**: gps_code starts with "K" (KLAX, KJFK, KORD)
- **Canada**: gps_code starts with "C" (CYYZ, CYVR)
- **Europe (UK/Ireland)**: gps_code starts with "E" (EGLL, EIDW)
- **Europe (Southern)**: gps_code starts with "L" (LEMD, LIRF, LPPT)
- **Mexico**: gps_code starts with "M" (MMMX)
- **Australia**: gps_code starts with "Y" (YSSY)
- **China**: gps_code starts with "Z" (ZBAA)
- **Russia**: gps_code starts with "U" (UUEE)
- **Asia (South/Southeast)**: gps_code starts with "V" or "W" (VHHH, WSSS)
- **Middle East**: gps_code starts with "O" (OMDB)
- **South America**: gps_code starts with "S" (SBGR)
- **Japan/Korea**: gps_code starts with "R" (RJTT, RKSI)

Example: To color USA airports black, use color_features_by_property with:
- property: "gps_code", operator: "startsWith", value: "K", r: 0, g: 0, b: 0

## Sample Airports (for reference)
Major US Airports:
- Los Angeles Int'l (LAX): lat 33.9425, lng -118.4081
- John F. Kennedy Int'l (JFK): lat 40.6413, lng -73.7781
- Chicago O'Hare (ORD): lat 41.9742, lng -87.9073
- San Francisco Int'l (SFO): lat 37.6213, lng -122.3790
- Miami Int'l (MIA): lat 25.7959, lng -80.2870
- Denver Int'l (DEN): lat 39.8561, lng -104.6737
- Seattle-Tacoma (SEA): lat 47.4502, lng -122.3088
- Boston Logan (BOS): lat 42.3656, lng -71.0096
- Dallas/Fort Worth (DFW): lat 32.8998, lng -97.0403
- Atlanta Hartsfield-Jackson (ATL): lat 33.6407, lng -84.4277
- Phoenix Sky Harbor (PHX): lat 33.4373, lng -112.0078
- Las Vegas McCarran (LAS): lat 36.0840, lng -115.1537

International Airports:
- London Heathrow (LHR): lat 51.4700, lng -0.4543
- Paris Charles de Gaulle (CDG): lat 49.0097, lng 2.5479
- Tokyo Narita (NRT): lat 35.7720, lng 140.3929
- Tokyo Haneda (HND): lat 35.5494, lng 139.7798
- Dubai Int'l (DXB): lat 25.2532, lng 55.3657
- Sydney (SYD): lat -33.9399, lng 151.1753
- Singapore Changi (SIN): lat 1.3644, lng 103.9915
- Hong Kong (HKG): lat 22.3080, lng 113.9185
- Frankfurt (FRA): lat 50.0379, lng 8.5622
- Amsterdam Schiphol (AMS): lat 52.3105, lng 4.7683
- Madrid Barajas (MAD): lat 40.4983, lng -3.5676
- Barcelona El Prat (BCN): lat 41.2971, lng 2.0785
- Rome Fiumicino (FCO): lat 41.8003, lng 12.2389
- Toronto Pearson (YYZ): lat 43.6777, lng -79.6248
- Mexico City (MEX): lat 19.4363, lng -99.0721
- São Paulo Guarulhos (GRU): lat -23.4356, lng -46.4731

## Capabilities
You can help users:
1. **Navigate to airports**: Use fly_to with coordinates when users mention airport names or codes
2. **Explain the data**: Describe what the Airports layer shows
3. **Control visibility**: Toggle the Airports layer on/off using toggle_layer
4. **Zoom operations**: Zoom in/out for better visibility
5. **Answer questions**: Provide airport information (type, location, codes)
6. **Color by filter**: Use color_features_by_property to highlight airports by country, type, or any property
   - For countries, use gps_code with startsWith operator (see GPS Code Country Prefixes above)
   - For airport types, use type with equals operator (e.g., type equals "major")
7. **Count/Query features**: Use query_features to count airports by country, type, or any filter
   - Example: "How many airports in USA?" → query_features with property: "gps_code", operator: "startsWith", value: "K"
   - Example: "How many major airports?" → query_features with property: "type", operator: "equals", value: "major"
   - Example: "Total airports?" → query_features with property: "gps_code", operator: "all"
8. **Filter features**: Use filter_features_by_property to show only matching features (hide non-matching)
   - Example: "Filter USA airports" → filter_features_by_property with property: "gps_code", operator: "startsWith", value: "K"
   - Example: "Show only major airports" → filter_features_by_property with property: "type", operator: "equals", value: "major"
   - Example: "Clear filter" / "Show all" / "Reset" → filter_features_by_property with ONLY reset: true (no other params needed)
9. **Size by property**: Use size_features_by_property to set different point sizes based on property values
   - Example: "Size by type, major=12, military=8" → size_features_by_property with property: "type", sizeRules: [{value: "major", size: 12}, {value: "military", size: 8}], defaultSize: 4
   - Example: "Make major airports bigger" → size_features_by_property with property: "type", sizeRules: [{value: "major", size: 15}], defaultSize: 6
   - Example: "Reset sizes" → size_features_by_property with reset: true
10. **Aggregate/List/Table**: Use aggregate_features to group features and get counts for each unique value
   - Example: "List airport types with counts" → aggregate_features with groupBy: "type"
   - Example: "Create table of airports by type" → aggregate_features with groupBy: "type"
   - Example: "Show breakdown by country" → aggregate_features with groupBy: "gps_code" (first letter = country)

## Response Guidelines
- **IMPORTANT**: Before calling any tool, ALWAYS briefly explain your reasoning and what you're about to do. For example: "I'll filter airports by their GPS code prefix 'K' which identifies US airports."
- When user asks "How many..." for a SINGLE category, use query_features (e.g., "How many major airports?")
- When user asks for a "list", "table", "breakdown", or counts for MULTIPLE categories, use aggregate_features (e.g., "List airport types with counts")
- When user says "filter" or "show only", use filter_features_by_property (hides non-matching features)
- When user says "color" or "highlight", use color_features_by_property (keeps all features visible but colors matching ones)
- When user mentions an airport by name or code, use fly_to to navigate there
- When asked about layer content, explain the airport data properties
- When asked about a specific airport, provide details AND navigate to it
- For unknown airports, explain that you can help with major airports and suggest alternatives
- Always be helpful and conversational`;
}

export class OpenAIService {
  private client: OpenAI;
  private model: string;
  private tools: any[];
  private systemPrompt: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';

    // Get tools from definitions package
    this.tools = getAllToolDefinitions();
    this.systemPrompt = buildSystemPrompt(this.tools);
  }

  async streamChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    ws: WebSocket
  ): Promise<OpenAI.Chat.ChatCompletionMessageParam | null> {
    console.log('[OpenAI] Starting streamChatCompletion...');
    const messageId = `msg_${Date.now()}`;
    const toolCallsAccumulator = new Map<number, any>();
    let contentAccumulator = '';

    try {
      console.log('[OpenAI] Creating chat completion request...');
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...messages
        ],
        stream: true,
        tools: this.tools,
        max_tokens: 500,
        temperature: 0.7,
      });

      console.log('[OpenAI] Stream created successfully, starting to process chunks...');

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // Handle text content
        if (delta.content) {
          contentAccumulator += delta.content;
          ws.send(JSON.stringify({
            type: 'stream_chunk',
            content: delta.content,
            messageId,
            isComplete: false
          }));
        }

        // Handle tool calls (accumulate deltas)
        if (delta.tool_calls) {
          for (const tcDelta of delta.tool_calls) {
            if (!toolCallsAccumulator.has(tcDelta.index)) {
              toolCallsAccumulator.set(tcDelta.index, {
                id: tcDelta.id || '',
                type: tcDelta.type || 'function',
                function: { name: '', arguments: '' }
              });
            }

            const acc = toolCallsAccumulator.get(tcDelta.index);
            if (tcDelta.id) acc.id = tcDelta.id;
            if (tcDelta.function?.name) {
              acc.function.name += tcDelta.function.name;
            }
            if (tcDelta.function?.arguments) {
              acc.function.arguments += tcDelta.function.arguments;
            }
          }
        }

        // Check if stream finished
        if (chunk.choices[0]?.finish_reason) {
          // Send completion signal
          ws.send(JSON.stringify({
            type: 'stream_chunk',
            content: '',
            messageId,
            isComplete: true
          }));

          // Process accumulated tool calls with standardized response format
          if (toolCallsAccumulator.size > 0) {
            for (const [index, toolCall] of toolCallsAccumulator.entries()) {
              try {
                const args = JSON.parse(toolCall.function.arguments);
                const toolName = toolCall.function.name;

                // Send standardized ToolResponse format (NEW_ARCHITECTURE.md)
                const response: ToolResponse = formatToolResponse(toolName, {
                  data: args,
                  message: `Executing ${toolName}`
                });

                ws.send(JSON.stringify({
                  type: 'tool_call',
                  ...response,
                  callId: toolCall.id
                }));
              } catch (error) {
                console.error('[OpenAI] Error parsing tool call arguments:', error);
              }
            }
          }

          // Build and return assistant message for conversation history
          // Note: We don't include tool_calls in history because OpenAI requires
          // tool response messages to follow, which we don't have in this flow
          const assistantMessage: OpenAI.Chat.ChatCompletionMessageParam = {
            role: 'assistant' as const,
            content: contentAccumulator || 'I performed the requested actions.',
          };

          return assistantMessage;
        }
      }
    } catch (error: any) {
      console.error('[OpenAI] Stream error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        content: this.getErrorMessage(error),
        code: error.code
      }));
      return null;
    }

    return null;
  }

  private getErrorMessage(error: any): string {
    if (error.status === 429) {
      return "I'm receiving too many requests. Please wait a moment and try again.";
    }
    if (error.status === 401) {
      return "Authentication error. Please check API configuration.";
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      return "Connection timeout. Please try again.";
    }
    return "I'm having trouble processing your request. Please try again.";
  }
}
