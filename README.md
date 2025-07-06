# Web Search MCP Server for use with Local LLMs

A TypeScript MCP (Model Context Protocol) server that performs web searches and extracts full page content from search results.

## Features

- **Multi-Engine Web Search**: Tries Google Search first, and automatically falls back to DuckDuckGo if Google fails (e.g., due to bot detection or no results)
- **Full Page Content Extraction**: Fetches and extracts complete page content from search results
- **MCP Protocol Compliance**: Implements the Model Context Protocol for seamless integration with AI assistants
- **TypeScript**: Built with TypeScript for type safety and better development experience
- **CLI Executable**: Can be run as a standalone CLI tool or integrated with MCP clients

## How It Works

When a search is requested, the server:
1. Attempts to fetch results from Google Search.
2. If Google returns a bot detection page, fails, or returns no results, it automatically retries the search using DuckDuckGo.
3. Extracts and returns the full content from the top results of whichever engine succeeded.

## Compatibility

This MCP server has been developed and tested with **LM Studio**. It has not been tested with other MCP clients.

### Model Compatibility
**Important:** Prioritise using more recent models designated for tool use. 

Older models (even those with tool use specified) may not work and may throw a "Model failed to generate a tool call", "The AI has nothing to say" or a different error.

- ✅ Works with: Recent **Deepseek R1** (e.g 0528 works, older models don't)
- ✅ Works with: Recent **Llama 3.1** (e.g 3.1 swallow-8B works, older models don't)
- ✅ Works well with: **Qwen3**
- ✅ Works well with: **Gemma 3**
- ❌ Known issues with: Older versions of **Llama 3.1**, **Llama 3.2** and **Deepseek R1**

## Installation (Recommended)

1. Download the latest release zip file from the [Releases page](https://github.com/mrkrsl/web-search-mcp/releases)
2. Extract the zip file to a location on your system (e.g., `~/mcp-servers/web-search-mcp/`)
3. **Open a terminal in the extracted folder and run:**
   ```bash
   npm install
   ```
   This will create a `node_modules` folder with all required dependencies.
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
- Windows: `C:\\mcp-servers\web-search-mcp\dist\index.js`

**Note:** You must run `npm install` in the root of the extracted folder (not in `dist/`).

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

## MCP Tool

This server provides a `full-web-search` tool that:

1. Takes a search query and optional number of results (1-10, default 5)
2. Performs a web search (tries Google, then DuckDuckGo if needed)
3. Fetches full page content from each result URL
4. Returns structured data with search results and extracted content

### Example Usage
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
