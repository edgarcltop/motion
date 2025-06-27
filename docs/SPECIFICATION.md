# TypeScript Web Search MCP Server - Project Specification

## Project Overview

Create a comprehensive TypeScript MCP (Model Context Protocol) server that performs web searches and fetches full page content from the top results. This server will extend the basic Google search functionality to include complete page content extraction.

## Project Setup

### 1. Initialize Project in Cursor

```bash
mkdir web-search-mcp-server
cd web-search-mcp-server
npm init -y
```

### 2. Install Dependencies

```bash
# Core MCP dependencies
npm install @modelcontextprotocol/sdk

# Web scraping and HTTP
npm install axios cheerio

# Development dependencies
npm install -D typescript @types/node tsx eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier

# Optional: for better error handling
npm install p-limit p-retry
```

### 3. TypeScript Configuration

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. Package.json Scripts

Update `package.json`:
```json
{
  "name": "web-search-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for web search with full page content extraction",
  "main": "dist/index.js",
  "type": "module",
  "bin": {
    "web-search-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "prepare": "npm run build"
  },
  "keywords": ["mcp", "web-search", "ai", "llm"],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/web-search-mcp-server.git"
  }
}
```

## Core Functionality Specification

### 1. Enhanced Interface Definition

```typescript
interface SearchResult {
  title: string;
  url: string;
  description: string;      // Google snippet
  fullContent: string;      // Complete page content
  contentPreview: string;   // First 500 chars of content
  wordCount: number;        // Content word count
  timestamp: string;        // When fetched
  fetchStatus: 'success' | 'error' | 'timeout';
  error?: string;           // Error message if fetch failed
}

interface SearchResponse {
  query: string;
  limit: number;
  results: SearchResult[];
  totalFound: number;
  searchTimestamp: string;
  processingTimeMs: number;
}
```

### 2. Enhanced Search Implementation

Key features to implement:

- **Concurrent page fetching** using `Promise.all()` with rate limiting
- **Robust error handling** for individual page failures
- **Content cleaning** - remove scripts, styles, navigation, ads
- **Timeout handling** - 10 second timeout per page
- **Content length limiting** - max 10,000 characters per page
- **Retry logic** for failed requests
- **User-agent rotation** to avoid blocking

### 3. Content Processing Pipeline

```typescript
private async processPageContent(html: string): Promise<string> {
  const $ = cheerio.load(html);
  
  // Remove unwanted elements
  $('script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar').remove();
  
  // Extract main content (prioritize article, main, or body)
  const mainContent = $('article, main, [role="main"], .content, .post-content, .entry-content')
    .first()
    .text()
    .trim();
  
  if (mainContent) {
    return mainContent.substring(0, 10000); // Limit content
  }
  
  // Fallback to body content
  return $('body').text().trim().substring(0, 10000);
}
```

### 4. MCP Tool Definition

```typescript
{
  name: 'web_search_full',
  description: 'Search the web and fetch complete page content from top results',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query to execute'
      },
      limit: {
        type: 'number',
        description: 'Number of results to return with full content (1-10)',
        minimum: 1,
        maximum: 10,
        default: 5
      },
      includeContent: {
        type: 'boolean',
        description: 'Whether to fetch full page content (default: true)',
        default: true
      }
    },
    required: ['query']
  },
  annotations: {
    title: 'Web Search with Full Content',
    description: 'Searches Google and fetches complete page content',
    readOnlyHint: true,
    openWorldHint: true
  }
}
```

## Project Structure

```
web-search-mcp-server/
├── src/
│   ├── index.ts              # Main entry point
│   ├── types.ts              # Type definitions
│   ├── search-engine.ts      # Google search logic
│   ├── content-extractor.ts  # Page content extraction
│   ├── rate-limiter.ts       # Request rate limiting
│   └── utils.ts              # Utility functions
├── dist/                     # Compiled JavaScript
├── tests/                    # Test files
├── .github/
│   └── workflows/
│       └── ci.yml            # GitHub Actions
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── README.md
└── LICENSE
```

## Implementation Requirements

### 1. Error Handling Strategy

- **Graceful degradation** - if some pages fail, return successful ones
- **Detailed error reporting** - include specific error messages
- **Timeout protection** - prevent hanging requests
- **Rate limiting** - avoid overwhelming servers

### 2. Performance Optimization

- **Concurrent fetching** - fetch multiple pages simultaneously
- **Content streaming** - return results as they're processed
- **Memory management** - limit content size and cleanup
- **Request pooling** - reuse HTTP connections

### 3. Security Considerations

- **Input validation** - sanitize search queries
- **Content sanitization** - remove potentially harmful content
- **Rate limiting** - prevent abuse
- **User-agent compliance** - respect robots.txt where possible

## Testing Strategy

### 1. Unit Tests
- Search query parsing
- Content extraction logic
- Error handling scenarios
- Rate limiting functionality

### 2. Integration Tests
- End-to-end search and content extraction
- MCP protocol compliance
- Performance benchmarks

### 3. Manual Testing
- Test with various search queries
- Verify content quality and completeness
- Test error scenarios (network failures, blocked sites)

## GitHub Repository Setup

### 1. Repository Structure
```bash
# Initialize git
git init
git add .
git commit -m "Initial commit: Web Search MCP Server"

# Create GitHub repository
gh repo create web-search-mcp-server --public --description "MCP server for web search with full page content extraction"
git push -u origin main
```

### 2. MIT License
Create `LICENSE` file with standard MIT license text.

### 3. GitHub Actions CI/CD
Create `.github/workflows/ci.yml`:
```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test
```

### 4. Documentation
Create comprehensive `README.md` with:
- Installation instructions
- Configuration examples
- Usage examples
- API documentation
- Contributing guidelines

## Configuration for LM Studio

Users will configure the server in their `mcp.json`:

```json
{
  "mcpServers": {
    "web-search-full": {
      "command": "npx",
      "args": ["web-search-mcp-server"]
    }
  }
}
```

## Success Criteria

1. **Functional Requirements**
   - ✅ Performs Google searches
   - ✅ Fetches full page content from top N results
   - ✅ Returns structured JSON with complete data
   - ✅ Handles errors gracefully
   - ✅ Respects rate limits

2. **Technical Requirements**
   - ✅ TypeScript implementation with proper types
   - ✅ MCP protocol compliance
   - ✅ Concurrent content fetching
   - ✅ Comprehensive error handling
   - ✅ Performance optimization

3. **Project Requirements**
   - ✅ MIT license
   - ✅ GitHub repository with CI/CD
   - ✅ Comprehensive documentation
   - ✅ Easy installation and configuration

This specification provides a complete roadmap for building a production-ready MCP server that extends basic web search with full content extraction capabilities.