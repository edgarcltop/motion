# Web Search MCP Server

A TypeScript MCP (Model Context Protocol) server that performs Google web searches and extracts full page content from search results.

## Features

- **Google Search Integration**: Performs web searches using Google
- **Full Page Content Extraction**: Fetches and extracts complete page content from search results
- **MCP Protocol Compliance**: Implements the Model Context Protocol for seamless integration with AI assistants
- **TypeScript**: Built with TypeScript for type safety and better development experience
- **CLI Executable**: Can be run as a standalone CLI tool or integrated with MCP clients

## Installation

### For Development
```bash
git clone https://github.com/mrkrsl/web-search-mcp.git
cd web-search-mcp
npm install
npm run build
```

### For Global Installation
```bash
npm install -g web-search-mcp-server
```

### For MCP Integration (Recommended)
```bash
npm install web-search-mcp-server
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
      "command": "web-search-mcp",
      "args": []
    }
  }
}
```

### Claude Desktop Configuration

Add to your `mcp.json`:
```json
{
  "mcpServers": {
    "web-search": {
      "command": "/usr/local/bin/web-search-mcp",
      "args": []
    }
  }
}
```

### Using npx (No Installation Required)

```json
{
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["web-search-mcp-server"]
    }
  }
}
```

## MCP Tool

This server provides a `web_search_full` tool that:

1. Takes a search query and optional number of results (1-10, default 5)
2. Performs a Google search
3. Fetches full page content from each result URL
4. Returns structured data with search results and extracted content

### Example Usage
```json
{
  "name": "web_search_full",
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
# If installed globally
web-search-mcp

# If using npx
npx web-search-mcp-server

# If running from source
npm start
```

## Documentation

See [SPECIFICATION.md](./docs/SPECIFICATION.md) for complete technical details, including:

- Interface definitions
- Implementation requirements
- Error handling strategy
- Performance optimization
- Security considerations
- Testing strategy

## License

MIT License - see [LICENSE](./LICENSE) for details.
