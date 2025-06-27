# Web Search MCP Server

A TypeScript MCP (Model Context Protocol) server that performs Google web searches and extracts full page content from search results.

## Features

- **Google Search Integration**: Performs web searches using Google
- **Full Page Content Extraction**: Fetches and extracts complete page content from search results
- **MCP Protocol Compliance**: Implements the Model Context Protocol for seamless integration with AI assistants
- **TypeScript**: Built with TypeScript for type safety and better development experience
- **CLI Executable**: Can be run as a standalone CLI tool or integrated with MCP clients

## Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Usage

```bash
npm start
```

## MCP Tool

This server provides a `web_search_full` tool that:

1. Takes a search query and optional number of results (1-10, default 5)
2. Performs a Google search
3. Fetches full page content from each result URL
4. Returns structured data with search results and extracted content

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
