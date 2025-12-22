// backend/src/services/custom-sse-transport.ts
// Custom SSE transport that supports authentication headers
// Based on MCP SDK Transport interface

import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export interface CustomSSETransportOptions {
  url: string;
  headers?: Record<string, string>;
}

export class CustomSSETransport implements Transport {
  private url: string;
  private headers: Record<string, string>;
  private abortController?: AbortController;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(options: CustomSSETransportOptions) {
    this.url = options.url;
    this.headers = options.headers || {};
  }

  async start(): Promise<void> {
    console.log('[Custom SSE] Starting transport to:', this.url);
    console.log('[Custom SSE] Note: This is a stub start() - actual communication happens via send()');

    // For HTTP-based MCP (not SSE), we don't need to establish a persistent connection
    // The MCP SDK will call send() for each message
    // Just validate the URL is accessible
    this.abortController = new AbortController();

    try {
      // For HTTP-based MCP, we just mark as ready
      // No persistent connection needed - each message is a POST request
      console.log('[Custom SSE] Transport ready for HTTP-based MCP communication');
      return;

      /* SSE-based approach (not used for CARTO MCP):
      const response = await fetch(this.url, {
        method: 'GET',
        headers: {
          ...this.headers,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // SSE streaming code removed - using HTTP POST instead
      */
    } catch (error) {
      console.error('[Custom SSE] Transport error:', error);
      if (this.onerror) {
        this.onerror(error as Error);
      }
      throw error;
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    console.log('[Custom SSE] Sending HTTP POST:', JSON.stringify(message).substring(0, 200));

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream', // Accept both formats
        },
        body: JSON.stringify(message),
      });

      console.log('[Custom SSE] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Custom SSE] Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get response as text first
      const text = await response.text();
      console.log('[Custom SSE] Raw response:', text.substring(0, 300));

      // Handle empty responses (e.g., for notifications with 202 Accepted)
      if (!text || text.trim() === '') {
        console.log('[Custom SSE] Empty response (likely a notification), no data to parse');
        return; // No response expected, return successfully
      }

      const contentType = response.headers.get('content-type') || '';

      let data: any;

      // Check if it's SSE format (text/event-stream) or plain JSON
      if (contentType.includes('text/event-stream') || text.includes('data: ')) {
        // Parse SSE format: lines starting with "data: "
        console.log('[Custom SSE] Parsing SSE-formatted response');
        data = this.parseSSEResponse(text);
      } else {
        // Parse as regular JSON
        console.log('[Custom SSE] Parsing JSON response');
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error('[Custom SSE] Failed to parse JSON, text was:', text);
          throw e;
        }
      }

      console.log('[Custom SSE] Parsed response:', JSON.stringify(data).substring(0, 200));

      // Call onmessage handler with the parsed response
      if (this.onmessage && data) {
        this.onmessage(data as JSONRPCMessage);
      }
    } catch (error) {
      console.error('[Custom SSE] Send error:', error);
      if (this.onerror) {
        this.onerror(error as Error);
      }
      throw error;
    }
  }

  /**
   * Parse SSE-formatted response (lines starting with "data: ")
   */
  private parseSSEResponse(text: string): any {
    const lines = text.split('\n');
    let jsonData = null;

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          jsonData = JSON.parse(line.substring(6));
        } catch (e) {
          console.error('[Custom SSE] Error parsing SSE data line:', line);
        }
      }
    }

    return jsonData;
  }

  async close(): Promise<void> {
    console.log('[Custom SSE] Closing transport');
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.onclose) {
      this.onclose();
    }
  }
}
