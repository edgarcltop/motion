# Web Search MCP Server for use with Local LLMs

A TypeScript MCP (Model Context Protocol) server that provides comprehensive web search capabilities with multiple tools for different use cases.

## Features

- **Enhanced Bot Detection Avoidance**: Intelligent fallback system using Playwright headless browsers when traditional HTTP requests fail
- **Multi-Engine Web Search**: Prioritizes Bing > Brave > DuckDuckGo for optimal reliability and performance
- **Smart Request Strategy**: Uses fast axios requests first, then falls back to browser-based extraction when bot detection is encountered
- **Full Page Content Extraction**: Fetches and extracts complete page content from search results with human-like behavior simulation
- **Concurrent Processing**: Extracts content from multiple pages simultaneously with intelligent timeout management
- **HTTP/2 Error Recovery**: Automatically handles protocol errors with fallback to HTTP/1.1
- **Memory Leak Prevention**: Proper browser cleanup prevents EventEmitter memory leaks
- **Multiple Search Tools**: Three specialised tools for different use cases
- **Browser Pool Management**: Efficient browser instance management with automatic cleanup and rotation
- **MCP Protocol Compliance**: Implements the Model Context Protocol for seamless integration with AI assistants
- **TypeScript**: Built with TypeScript for type safety and better development experience
- **CLI Executable**: Can be run as a standalone CLI tool or integrated with MCP clients

## How It Works

The server provides three specialised tools for different web search needs:

### 1. `full-web-search` (Main Tool)
When a comprehensive search is requested, the server uses an **optimized search strategy**:
1. **Browser-based Bing Search** - Primary method using Playwright with excellent reliability
2. **Browser-based Brave Search** - Secondary option with good performance
3. **Axios DuckDuckGo Search** - Final fallback using traditional HTTP (proven reliable)
4. **Content extraction**: Tries axios first, then falls back to browser with human behavior simulation
5. **Concurrent processing**: Extracts content from multiple pages simultaneously with timeout protection
6. **HTTP/2 error recovery**: Automatically falls back to HTTP/1.1 when protocol errors occur

### 2. `get-web-search-summaries` (Lightweight Alternative)
For quick search results without full content extraction:
1. Performs the same optimized multi-engine search as `full-web-search`
2. Returns only the search result snippets/descriptions
3. Does not follow links to extract full page content
4. **Automatic browser cleanup**: Prevents memory leaks by properly closing browsers after search

### 3. `get-single-web-page-content` (Utility Tool)
For extracting content from a specific webpage:
1. Takes a single URL as input
2. Follows the URL and extracts the main page content
3. Removes navigation, ads, and other non-content elements

## Compatibility

This MCP server has been developed and tested with **LM Studio**. It has not been tested with other MCP clients.

### Model Compatibility
**Important:** Prioritise using more recent models designated for tool use. 

Older models (even those with tool use specified) may not work or may work erratically. This seems to be the case with Llama and Deepseek. Qwen3 and Gemma 3 currently have the best restults.

- ✅ Works well with: **Qwen3**
- ✅ Works well with: **Gemma 3**
- ✅ Works with: **Llama 3.2**
- ✅ Works with: Recent **Llama 3.1** (e.g 3.1 swallow-8B)
- ✅ Works with: Recent **Deepseek R1** (e.g 0528 works)
- ⚠️ May have issues with: Some versions of **Llama** and **Deepseek R1**
- ❌ May not work with: Older versions of **Llama** and **Deepseek R1**

## Installation (Recommended)

**Requirements:**
- Node.js 18.0.0 or higher
- npm 8.0.0 or higher

1. Download the latest release zip file from the [Releases page](https://github.com/mrkrsl/web-search-mcp/releases)
2. Extract the zip file to a location on your system (e.g., `~/mcp-servers/web-search-mcp/`)
3. **Open a terminal in the extracted folder and run:**
   ```bash
   npm install
   npm run build
   ```
   This will create a `node_modules` folder with all required dependencies and build the project.
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

**Example paths:**
- macOS/Linux: `~/mcp-servers/web-search-mcp/dist/index.js`
- Windows: `C:\\mcp-servers\\web-search-mcp\\dist\\index.js`

**Note:** You must run `npm install` in the root of the extracted folder (not in `dist/`).

**Troubleshooting:**
- If `npm install` fails, try updating Node.js to version 18+ and npm to version 8+
- If `npm run build` fails, ensure you have the latest Node.js version installed
- For older Node.js versions, you may need to use an older release of this project
- **Content Length Issues:** If you experience odd behavior due to content length limits, try setting `"MAX_CONTENT_LENGTH": "10000"`, or another value, in your `mcp.json` environment variables:

```json
{
  "mcpServers": {
    "web-search": {
      "command": "node",
      "args": ["/path/to/web-search-mcp/dist/index.js"],
      "env": {
        "MAX_CONTENT_LENGTH": "10000",
        "BROWSER_HEADLESS": "true",
        "MAX_BROWSERS": "3",
        "BROWSER_FALLBACK_THRESHOLD": "3"
      }
    }
  }
}
```

## Environment Variables

The server supports several environment variables for configuration:

- **`MAX_CONTENT_LENGTH`**: Maximum content length in characters (default: 500000)
- **`DEFAULT_TIMEOUT`**: Default timeout for requests in milliseconds (default: 6000)
- **`BROWSER_HEADLESS`**: Run browsers in headless mode (default: true, set to 'false' for visible browsers)
- **`MAX_BROWSERS`**: Maximum number of browser instances to maintain (default: 3)
- **`BROWSER_TYPES`**: Comma-separated list of browser types to use (default: 'chromium,firefox', options: chromium, firefox, webkit)
- **`BROWSER_FALLBACK_THRESHOLD`**: Number of axios failures before using browser fallback (default: 3)

## Troubleshooting

### Slow Response Times
- **Optimized timeouts**: Default timeout reduced to 6 seconds with concurrent processing for faster results
- **Concurrent extraction**: Content is now extracted from multiple pages simultaneously
- **Reduce timeouts further**: Set `DEFAULT_TIMEOUT=4000` for even faster responses (may reduce success rate)
- **Use fewer browsers**: Set `MAX_BROWSERS=1` to reduce memory usage

### Search Failures
- **Check browser installation**: Run `npx playwright install` to ensure browsers are available
- **Try headless mode**: Ensure `BROWSER_HEADLESS=true` (default) for server environments
- **Network restrictions**: Some networks block browser automation - try different network or VPN
- **HTTP/2 issues**: The server automatically handles HTTP/2 protocol errors with fallback to HTTP/1.1

### Memory Usage
- **Automatic cleanup**: Browsers are automatically cleaned up after each operation to prevent memory leaks
- **Limit browsers**: Reduce `MAX_BROWSERS` (default: 3)
- **EventEmitter warnings**: Fixed - browsers are properly closed to prevent listener accumulation

## For Development
```bash
git clone https://github.com/mrkrsl/web-search-mcp.git
cd web-search-mcp
npm install
npm run build
```

## Development

```bash
npm run dev    # Development with hot reload
npm run build  # Build TypeScript to JavaScript
npm run lint   # Run ESLint
npm run format # Run Prettier
```

## MCP Integration

### LM Studio Configuration

Add to your `mcp.json`:
```json
{
  "mcpServers": {
    "web-search": {
      "command": "node",
      "args": ["/path/to/web-search-mcp/dist/index.js"]
    }
  }
}
```

## MCP Tools

This server provides three specialised tools for different web search needs:

### 1. `full-web-search` (Main Tool)
The most comprehensive web search tool that:
1. Takes a search query and optional number of results (1-10, default 5)
2. Performs a web search (tries Bing, then Brave, then DuckDuckGo if needed)
3. Fetches full page content from each result URL with concurrent processing
4. Returns structured data with search results and extracted content
5. **Enhanced reliability**: HTTP/2 error recovery, reduced timeouts, and better error handling

**Example Usage:**
```json
{
  "name": "full-web-search",
  "arguments": {
    "query": "TypeScript MCP server",
    "limit": 3,
    "includeContent": true
  }
}
```

### 2. `get-web-search-summaries` (Lightweight Alternative)
A lightweight alternative for quick search results:
1. Takes a search query and optional number of results (1-10, default 5)
2. Performs the same optimized multi-engine search as `full-web-search`
3. Returns only search result snippets/descriptions (no content extraction)
4. Faster and more efficient for quick research

**Example Usage:**
```json
{
  "name": "get-web-search-summaries",
  "arguments": {
    "query": "TypeScript MCP server",
    "limit": 5
  }
}
```

### 3. `get-single-web-page-content` (Utility Tool)
A utility tool for extracting content from a specific webpage:
1. Takes a single URL as input
2. Follows the URL and extracts the main page content
3. Removes navigation, ads, and other non-content elements
4. Useful for getting detailed content from a known webpage

**Example Usage:**
```json
{
  "name": "get-single-web-page-content",
  "arguments": {
    "url": "https://example.com/article",
    "maxContentLength": 5000
  }
}
```

## Standalone Usage

You can also run the server directly:
```bash
# If running from source
npm start
```

## Documentation

See [API.md](./docs/API.md) for complete technical details.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Feedback

This is an open source project and we welcome feedback! If you encounter any issues or have suggestions for improvements, please:

- Open an issue on GitHub
- Submit a pull request
- Share your experience with different models or MCP clients
