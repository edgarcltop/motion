# Motion Server

A TypeScript MCP (Model Context Protocol) server that provides comprehensive web search capabilities using direct connections (no API keys required) with multiple tools for different use cases.

## Features

- **Multi-Engine Web Search**: Prioritises Bing > Brave > DuckDuckGo for optimal reliability and performance
- **Full Page Content Extraction**: Fetches and extracts complete page content from search results

## How It Works

The server provides three specialised tools for different web search needs:

### 1. `full-web-search` (Main Tool)
When a comprehensive search is requested, the server uses an **optimised search strategy**:
1. **Browser-based Bing Search** - Primary method using dedicated Chromium instance
2. **Browser-based Brave Search** - Secondary option using dedicated Firefox instance

### 2. `get-web-search-summaries` (Lightweight Alternative)
For quick search results without full content extraction:
1. Performs the same optimised multi-engine search as `full-web-search`


### 3. `get-single-web-page-content` (Utility Tool)
For extracting content from a specific webpage:
1. Takes a single URL as input
2. Follows the URL and extracts the main page content

## Compatibility

This MCP server has been developed and tested with **LM Studio** and **LibreChat**. It has not been tested with other MCP clients.

### Model Compatibility
## Installation (Recommended)

**Requirements:**
- Node.js 18.0.0 or higher


1. Download the latest release zip file from the 
2. Extract the zip file to a location on your system (e.g., `~/mcp-servers/web-search-mcp/`)
3. **Open a terminal in the extracted folder and run:**
   ```bash
   npm install
   npx playwright install
   npm run build
   ```
   This will create a `node_modules` folder with all required dependencies, install Playwright browsers, and build the project.

   **Note:** You must run `npm install` in the root of the extracted folder (not in `dist/`).
4. Configure your `mcp.json` to point to the extracted `dist/index.js` file:

```json
{
  "mcpServers": {
    "web-search": {
      "command": "node",
      "args": ["/path/to/extracted/web-search-mcp/dist/index.js"]
    }
  }
}
```

**Troubleshooting:**
- If `npm install` fails, try updating Node.js to version 18+ and npm to version 8+
- If `npm run build` fails, ensure you have the latest Node.js version installed
- For older Node.js versions, you may need to use an older release of this project
- **Content Length Issues:** If you experience odd behavior due to content length limits, try setting `"MAX_CONTENT_LENGTH": "10000"`, or another value, in your `mcp.json` environment variables:


## Environment Variables

The server supports several environment variables for configuration:

- **`MAX_CONTENT_LENGTH`**: Maximum content length in characters (default: 500000)
- **`DEFAULT_TIMEOUT`**: Default timeout for requests in milliseconds (default: 6000)
- **`MAX_BROWSERS`**: Maximum number of browser instances to maintain (default: 3)
- **`BROWSER_TYPES`**: Comma-separated list of browser types to use (default: 'chromium,firefox', options: chromium, firefox, webkit)
- **`BROWSER_FALLBACK_THRESHOLD`**: Number of axios failures before using browser fallback (default: 3)

### Search Quality and Engine Selection

- **`ENABLE_RELEVANCE_CHECKING`**: Enable/disable search result quality validation (default: true)
- **`RELEVANCE_THRESHOLD`**: Minimum quality score for search results (0.0-1.0, default: 0.3)
- **`FORCE_MULTI_ENGINE_SEARCH`**: Try all search engines and return best results (default: false)
- **`DEBUG_BROWSER_LIFECYCLE`**: Enable detailed browser lifecycle logging for debugging (default: false)
