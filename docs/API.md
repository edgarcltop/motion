# Web Search MCP Server - API Documentation

## Overview

The Web Search MCP Server provides a single tool `web_search_full` that performs Google web searches and extracts full page content from the results.

## Tool: web_search_full

### Description
Performs a Google web search and extracts full page content from each result URL.

### Input Schema
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The search query to perform"
    },
    "num_results": {
      "type": "number",
      "description": "Number of results to return (1-10, default 5)",
      "minimum": 1,
      "maximum": 10,
      "default": 5
    }
  },
  "required": ["query"]
}
```

### Output Schema
```json
{
  "type": "object",
  "properties": {
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string",
            "description": "Page title"
          },
          "url": {
            "type": "string",
            "description": "Page URL"
          },
          "snippet": {
            "type": "string",
            "description": "Search result snippet"
          },
          "content": {
            "type": "string",
            "description": "Extracted page content (if successful)"
          },
          "error": {
            "type": "string",
            "description": "Error message if content extraction failed"
          }
        },
        "required": ["title", "url", "snippet"]
      }
    },
    "total_results": {
      "type": "number",
      "description": "Total number of results returned"
    },
    "search_time_ms": {
      "type": "number",
      "description": "Total execution time in milliseconds"
    },
    "query": {
      "type": "string",
      "description": "Original search query"
    }
  },
  "required": ["results", "total_results", "search_time_ms", "query"]
}
```

## Usage Examples

### Basic Search
```json
{
  "name": "web_search_full",
  "arguments": {
    "query": "TypeScript MCP server"
  }
}
```

### Search with Custom Result Count
```json
{
  "name": "web_search_full",
  "arguments": {
    "query": "web development best practices",
    "num_results": 8
  }
}
```

## Response Examples

### Successful Response
```json
{
  "content": [
    {
      "type": "text",
      "text": "Search completed successfully"
    }
  ],
  "isError": false,
  "toolResults": [
    {
      "result": {
        "results": [
          {
            "title": "Getting Started with TypeScript",
            "url": "https://www.typescriptlang.org/docs/",
            "snippet": "TypeScript is a strongly typed programming language that builds on JavaScript...",
            "content": "TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale. This tutorial will help you get started with TypeScript..."
          },
          {
            "title": "Model Context Protocol Documentation",
            "url": "https://modelcontextprotocol.io/",
            "snippet": "The Model Context Protocol (MCP) is a protocol for AI assistants to connect to external data sources...",
            "content": "The Model Context Protocol (MCP) enables AI assistants to connect to external data sources and tools. This documentation provides comprehensive information about implementing MCP servers..."
          }
        ],
        "total_results": 2,
        "search_time_ms": 2450,
        "query": "TypeScript MCP server"
      }
    }
  ]
}
```

### Error Response
```json
{
  "content": [
    {
      "type": "text",
      "text": "Search failed: Network timeout"
    }
  ],
  "isError": true,
  "toolResults": [
    {
      "result": {
        "error": "Search failed: Network timeout"
      }
    }
  ]
}
```

## Error Handling

### Common Error Types

1. **Network Errors**
   - Timeout errors
   - Connection refused
   - DNS resolution failures

2. **Search Errors**
   - Invalid search queries
   - Rate limiting by Google
   - CAPTCHA challenges

3. **Content Extraction Errors**
   - Page access denied (403, 404)
   - Content encoding issues
   - Malformed HTML

### Error Response Format
```json
{
  "error": {
    "message": "Error description",
    "type": "error_type",
    "details": "Additional error information"
  }
}
```

## Rate Limiting

The server implements rate limiting to respect Google's terms of service:

- Maximum 10 requests per minute
- Maximum 5 concurrent content extractions
- Automatic retry with exponential backoff

## Performance Considerations

### Response Times
- Search execution: 1-5 seconds
- Content extraction: 2-10 seconds per URL
- Total response time: 3-15 seconds (depending on result count)

### Content Limits
- Maximum content length: 50KB per page
- Maximum concurrent requests: 5
- Request timeout: 10 seconds

## Integration Examples

### LM Studio Configuration
```json
{
  "mcpServers": {
    "web-search": {
      "command": "web-search-mcp",
      "args": [],
      "env": {
        "GOOGLE_SEARCH_TIMEOUT": "15000",
        "MAX_CONTENT_LENGTH": "75000"
      }
    }
  }
}
```

### Claude Desktop Configuration
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

## Best Practices

### Query Optimization
- Use specific, descriptive queries
- Include relevant keywords
- Avoid overly broad searches

### Result Handling
- Check for content extraction errors
- Handle partial failures gracefully
- Consider result relevance

### Error Recovery
- Implement retry logic for transient errors
- Provide fallback content when extraction fails
- Log errors for debugging

## Troubleshooting

### Common Issues

1. **No Results Returned**
   - Check query validity
   - Verify network connectivity
   - Check for rate limiting

2. **Content Extraction Failures**
   - Verify URL accessibility
   - Check content encoding
   - Review error messages

3. **Performance Issues**
   - Reduce concurrent requests
   - Increase timeout values
   - Check system resources

### Debug Mode
Enable debug logging by setting the environment variable:
```bash
export DEBUG=web-search-mcp:*
```

## Support

For issues and questions:
- Check the [SPECIFICATION.md](./SPECIFICATION.md) for technical details
- Review error logs for debugging information
- Ensure proper configuration and dependencies
