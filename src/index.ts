#!/usr/bin/env node
console.log('Web Search MCP Server starting...');

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SearchEngine } from './search-engine.js';
import { ContentExtractor } from './content-extractor.js';
import { WebSearchToolInput, WebSearchToolOutput } from './types.js';

class WebSearchMCPServer {
  private server: McpServer;
  private searchEngine: SearchEngine;
  private contentExtractor: ContentExtractor;

  constructor() {
    this.server = new McpServer({
      name: 'web-search-mcp',
      version: '0.1.0',
    });

    this.searchEngine = new SearchEngine();
    this.contentExtractor = new ContentExtractor();

    this.setupTools();
  }

  private setupTools(): void {
    // Register the web search tool using the older API
    this.server.tool(
      'full-web-search',
      'Search the web and fetch complete page content from top results',
      {
        query: z.string().describe('Search query to execute'),
        limit: z.number().min(1).max(10).default(5).describe('Number of results to return with full content (1-10)'),
        includeContent: z.boolean().default(true).describe('Whether to fetch full page content (default: true)'),
      },
      async (args: unknown) => {
        console.log(`[MCP] Tool call received: full-web-search`);
        console.log(`[MCP] Raw arguments:`, JSON.stringify(args, null, 2));

        try {
          // Convert and validate arguments
          const validatedArgs = this.validateAndConvertArgs(args);
          
          console.log(`[MCP] Validated args:`, JSON.stringify(validatedArgs, null, 2));
          
          console.log(`[MCP] Starting web search...`);
          const result = await this.handleWebSearch(validatedArgs);
          
          console.log(`[MCP] Search completed, result:`, JSON.stringify(result, null, 2));
          
          // Format the results as a comprehensive text response
          let responseText = `Search completed for "${result.query}" with ${result.total_results} results:\n\n`;
          
          result.results.forEach((result, index) => {
            responseText += `**${index + 1}. ${result.title}**\n`;
            responseText += `URL: ${result.url}\n`;
            responseText += `Description: ${result.description}\n`;
            
            if (result.fullContent && result.fullContent.trim()) {
              responseText += `\n**Full Content:**\n${result.fullContent}\n`;
            } else if (result.contentPreview && result.contentPreview.trim()) {
              responseText += `\n**Content Preview:**\n${result.contentPreview}\n`;
            } else if (result.fetchStatus === 'error') {
              responseText += `\n**Content Extraction Failed:** ${result.error}\n`;
            }
            
            responseText += `\n---\n\n`;
          });
          
          return {
            content: [
              {
                type: 'text' as const,
                text: responseText,
              },
            ],
          };
        } catch (error) {
          console.error(`[MCP] Error in tool handler:`, error);
          throw error;
        }
      }
    );
  }

  private validateAndConvertArgs(args: unknown): WebSearchToolInput {
    if (typeof args !== 'object' || args === null) {
      throw new Error('Invalid arguments: args must be an object');
    }
    const obj = args as Record<string, unknown>;
    // Ensure query is a string
    if (!obj.query || typeof obj.query !== 'string') {
      throw new Error('Invalid arguments: query is required and must be a string');
    }

    // Convert limit to number if it's a string
    let limit = 5; // default
    if (obj.limit !== undefined) {
      const limitValue = typeof obj.limit === 'string' ? parseInt(obj.limit, 10) : obj.limit;
      if (typeof limitValue !== 'number' || isNaN(limitValue) || limitValue < 1 || limitValue > 10) {
        throw new Error('Invalid limit: must be a number between 1 and 10');
      }
      limit = limitValue;
    }

    // Convert includeContent to boolean if it's a string
    let includeContent = true; // default
    if (obj.includeContent !== undefined) {
      if (typeof obj.includeContent === 'string') {
        includeContent = obj.includeContent.toLowerCase() === 'true';
      } else {
        includeContent = Boolean(obj.includeContent);
      }
    }

    return {
      query: obj.query,
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
    console.log('Setting up MCP server...');
    const transport = new StdioServerTransport();
    
    console.log('Connecting to transport...');
    await this.server.connect(transport);
    console.log('Web Search MCP Server started');
    console.log('Server timestamp:', new Date().toISOString());
    console.log('Waiting for MCP messages...');
  }
}

// Start the server
const server = new WebSearchMCPServer();
server.run().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error('Server error:', error.message);
  } else {
    console.error('Server error:', error);
  }
  process.exit(1);
});
