#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SearchEngine } from './search-engine.js';
import { ContentExtractor } from './content-extractor.js';
import { WebSearchToolInput, WebSearchToolOutput } from './types.js';

// Define schemas for MCP requests
const ToolsCallRequestSchema = z.object({
  method: z.literal('tools/call'),
  params: z.object({
    name: z.string(),
    arguments: z.record(z.unknown()),
  }),
});

const ToolsListRequestSchema = z.object({
  method: z.literal('tools/list'),
  params: z.object({}).optional(),
});

class WebSearchMCPServer {
  private server: Server;
  private searchEngine: SearchEngine;
  private contentExtractor: ContentExtractor;

  constructor() {
    this.server = new Server(
      {
        name: 'web-search-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.searchEngine = new SearchEngine();
    this.contentExtractor = new ContentExtractor();

    this.setupTools();
  }

  private setupTools(): void {
    // Handle tool calls
    this.server.setRequestHandler(ToolsCallRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      console.error(`Tool call received: ${name}`);
      console.error(`Arguments:`, JSON.stringify(args, null, 2));

      if (name === 'web_search_full') {
        // Handle both 'arguments' and 'parameters' fields that LLMs might use
        const toolArgs = args || (request.params as any).parameters || {};
        
        console.error(`Processed tool args:`, JSON.stringify(toolArgs, null, 2));
        
        // Convert and validate arguments
        const validatedArgs = this.validateAndConvertArgs(toolArgs);
        
        console.error(`Validated args:`, JSON.stringify(validatedArgs, null, 2));
        
        const result = await this.handleWebSearch(validatedArgs);
        
        console.error(`Search result:`, JSON.stringify(result, null, 2));
        
        // Return standard MCP tool call result format
        const response = {
          content: [
            {
              type: 'text' as const,
              text: `Search completed for "${result.query}" with ${result.total_results} results.`,
            },
          ],
          toolResults: [
            {
              result,
            },
          ],
        };
        
        console.error(`Sending response:`, JSON.stringify(response, null, 2));
        return response;
      }

      throw new Error(`Unknown tool: ${name}`);
    });

    // Handle tool listing
    this.server.setRequestHandler(ToolsListRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'web_search_full',
            description: 'Search the web and fetch complete page content from top results',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query to execute',
                },
                limit: {
                  type: 'number',
                  description: 'Number of results to return with full content (1-10)',
                  minimum: 1,
                  maximum: 10,
                  default: 5,
                },
                includeContent: {
                  type: 'boolean',
                  description: 'Whether to fetch full page content (default: true)',
                  default: true,
                },
              },
              required: ['query'],
            },
          },
        ],
      };
    });
  }

  private validateAndConvertArgs(args: any): WebSearchToolInput {
    // Ensure query is a string
    if (!args.query || typeof args.query !== 'string') {
      throw new Error('Invalid arguments: query is required and must be a string');
    }

    // Convert limit to number if it's a string
    let limit = 5; // default
    if (args.limit !== undefined) {
      const limitValue = typeof args.limit === 'string' ? parseInt(args.limit, 10) : args.limit;
      if (isNaN(limitValue) || limitValue < 1 || limitValue > 10) {
        throw new Error('Invalid limit: must be a number between 1 and 10');
      }
      limit = limitValue;
    }

    // Convert includeContent to boolean if it's a string
    let includeContent = true; // default
    if (args.includeContent !== undefined) {
      if (typeof args.includeContent === 'string') {
        includeContent = args.includeContent.toLowerCase() === 'true';
      } else {
        includeContent = Boolean(args.includeContent);
      }
    }

    return {
      query: args.query,
      limit,
      includeContent,
    };
  }

  private async handleWebSearch(input: WebSearchToolInput): Promise<WebSearchToolOutput> {
    const startTime = Date.now();
    const { query, limit = 5, includeContent = true } = input;

    try {
      // Perform the search
      const searchResults = await this.searchEngine.search({
        query,
        numResults: limit,
      });

      // Extract content from each result if requested
      const enhancedResults = includeContent 
        ? await this.contentExtractor.extractContentForResults(searchResults)
        : searchResults;

      const searchTime = Date.now() - startTime;

      return {
        results: enhancedResults,
        total_results: enhancedResults.length,
        search_time_ms: searchTime,
        query,
      };
    } catch (error) {
      console.error('Web search error:', error);
      throw new Error(`Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Web Search MCP Server started');
  }
}

// Start the server
const server = new WebSearchMCPServer();
server.run().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
