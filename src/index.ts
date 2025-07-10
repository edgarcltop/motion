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
      'Search the web and fetch complete page content from top results. Content length is automatically optimized based on model type.',
      {
        query: z.string().describe('Search query to execute'),
        limit: z.union([z.number(), z.string()]).transform((val) => {
          const num = typeof val === 'string' ? parseInt(val, 10) : val;
          if (isNaN(num) || num < 1 || num > 10) {
            throw new Error('Invalid limit: must be a number between 1 and 10');
          }
          return num;
        }).default(5).describe('Number of results to return with full content (1-10)'),
        includeContent: z.union([z.boolean(), z.string()]).transform((val) => {
          if (typeof val === 'string') {
            return val.toLowerCase() === 'true';
          }
          return Boolean(val);
        }).default(true).describe('Whether to fetch full page content (default: true)'),
        maxContentLength: z.union([z.number(), z.string()]).transform((val) => {
          const num = typeof val === 'string' ? parseInt(val, 10) : val;
          if (isNaN(num) || num < 0) {
            throw new Error('Invalid maxContentLength: must be a non-negative number');
          }
          return num;
        }).optional().describe('Maximum characters per result content (0 = no limit). Usually not needed - content length is automatically optimized.'),
      },
      async (args: unknown) => {
        console.log(`[MCP] Tool call received: full-web-search`);
        console.log(`[MCP] Raw arguments:`, JSON.stringify(args, null, 2));

        try {
          // Convert and validate arguments
          const validatedArgs = this.validateAndConvertArgs(args);
          
          // Auto-detect model types based on parameter formats
          // Llama models often send string parameters and struggle with large responses
          const isLikelyLlama = typeof args === 'object' && args !== null && (
            ('limit' in args && typeof (args as any).limit === 'string') ||
            ('includeContent' in args && typeof (args as any).includeContent === 'string')
          );
          
          // Detect models that handle large responses well (Qwen, Gemma, recent Deepseek)
          const isLikelyRobustModel = typeof args === 'object' && args !== null && (
            ('limit' in args && typeof (args as any).limit === 'number') &&
            ('includeContent' in args && typeof (args as any).includeContent === 'boolean')
          );
          
          // Only apply auto-limit if maxContentLength is not explicitly set (including 0)
          const hasExplicitMaxLength = typeof args === 'object' && args !== null && 'maxContentLength' in args;
          
          if (!hasExplicitMaxLength && isLikelyLlama) {
            console.log(`[MCP] Detected potential Llama model (string parameters), applying content length limit`);
            validatedArgs.maxContentLength = 2000; // Reasonable limit for Llama
          }
          
          // For robust models (Qwen, Gemma, recent Deepseek), remove maxContentLength if it's set to a low value
          if (isLikelyRobustModel && validatedArgs.maxContentLength && validatedArgs.maxContentLength < 5000) {
            console.log(`[MCP] Detected robust model (numeric parameters), removing unnecessary content length limit`);
            validatedArgs.maxContentLength = undefined;
          }
          
          console.log(`[MCP] Validated args:`, JSON.stringify(validatedArgs, null, 2));
          
          console.log(`[MCP] Starting web search...`);
          const result = await this.handleWebSearch(validatedArgs);
          
          console.log(`[MCP] Search completed, result:`, JSON.stringify(result, null, 2));
          
          // Format the results as a comprehensive text response
          let responseText = `Search completed for "${result.query}" with ${result.total_results} results:\n\n`;
          
          const maxLength = validatedArgs.maxContentLength;
          
          result.results.forEach((result, index) => {
            responseText += `**${index + 1}. ${result.title}**\n`;
            responseText += `URL: ${result.url}\n`;
            responseText += `Description: ${result.description}\n`;
            
            if (result.fullContent && result.fullContent.trim()) {
              let content = result.fullContent;
              if (maxLength && maxLength > 0 && content.length > maxLength) {
                content = content.substring(0, maxLength) + `\n\n[Content truncated at ${maxLength} characters]`;
              }
              responseText += `\n**Full Content:**\n${content}\n`;
            } else if (result.contentPreview && result.contentPreview.trim()) {
              let content = result.contentPreview;
              if (maxLength && maxLength > 0 && content.length > maxLength) {
                content = content.substring(0, maxLength) + `\n\n[Content truncated at ${maxLength} characters]`;
              }
              responseText += `\n**Content Preview:**\n${content}\n`;
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
