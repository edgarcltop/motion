import axios from 'axios';
import * as cheerio from 'cheerio';
import { SearchOptions, SearchResult } from './types.js';
import { getRandomUserAgent, sanitizeQuery, generateTimestamp } from './utils.js';
import { RateLimiter } from './rate-limiter.js';

export class SearchEngine {
  private readonly baseUrl: string;
  private readonly rateLimiter: RateLimiter;

  constructor() {
    this.baseUrl = 'https://www.google.com/search';
    this.rateLimiter = new RateLimiter(10); // 10 requests per minute
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { query, numResults = 5, timeout = 10000 } = options;
    const sanitizedQuery = sanitizeQuery(query);
    
    try {
      return await this.rateLimiter.execute(async () => {
        const response = await axios.get(this.baseUrl, {
          params: {
            q: sanitizedQuery,
            num: Math.min(numResults, 10), // Google limits to 10 results per request
            hl: 'en', // Language
            safe: 'off', // Safe search off
          },
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
          timeout,
          validateStatus: (status: number) => status < 400,
        });

        return this.parseSearchResults(response.data, numResults);
      });
    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Failed to perform search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseSearchResults(html: string, maxResults: number): SearchResult[] {
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];
    const timestamp = generateTimestamp();

    // Google search results are typically in divs with class 'g'
    // Each result has a title in h3, URL in a href, and snippet in div
    $('div.g').each((index, element) => {
      if (results.length >= maxResults) return false; // Stop if we have enough results

      const $element = $(element);
      
      // Extract title and URL from the main link
      const $titleElement = $element.find('h3');
      const $linkElement = $titleElement.closest('a');
      
      if ($titleElement.length && $linkElement.length) {
        const title = $titleElement.text().trim();
        const url = $linkElement.attr('href');
        
        // Extract snippet/description
        const snippet = $element.find('.VwiC3b, .st, .aCOpRe, .IsZvec').text().trim();
        
        if (title && url && this.isValidSearchUrl(url)) {
          results.push({
            title,
            url: this.cleanGoogleUrl(url),
            description: snippet || 'No description available',
            fullContent: '', // Will be filled by content extractor
            contentPreview: '',
            wordCount: 0,
            timestamp,
            fetchStatus: 'success',
          });
        }
      }
    });

    // If we didn't find results with the 'g' class, try alternative selectors
    if (results.length === 0) {
      return this.parseAlternativeResults($, maxResults, timestamp);
    }

    return results;
  }

  private parseAlternativeResults($: cheerio.CheerioAPI, maxResults: number, timestamp: string): SearchResult[] {
    const results: SearchResult[] = [];

    // Try different selectors that Google might use
    const selectors = [
      'div[data-sokoban-container]',
      '.tF2Cxc',
      '.rc',
      '[data-ved]'
    ];

    for (const selector of selectors) {
      $(selector).each((index, element) => {
        if (results.length >= maxResults) return false;

        const $element = $(element);
        
        // Look for title in various possible locations
        const titleSelectors = ['h3', '.LC20lb', '.DKV0Md', 'a[data-ved]'];
        let title = '';
        let url = '';

        for (const titleSelector of titleSelectors) {
          const $title = $element.find(titleSelector).first();
          if ($title.length) {
            title = $title.text().trim();
            const $link = $title.closest('a');
            if ($link.length) {
              url = $link.attr('href') || '';
            }
            break;
          }
        }

        // Look for snippet in various possible locations
        const snippetSelectors = ['.VwiC3b', '.st', '.aCOpRe', '.IsZvec', '.s3v9rd', '.MUxGbd'];
        let snippet = '';
        
        for (const snippetSelector of snippetSelectors) {
          const $snippet = $element.find(snippetSelector).first();
          if ($snippet.length) {
            snippet = $snippet.text().trim();
            break;
          }
        }

        if (title && url && this.isValidSearchUrl(url)) {
          results.push({
            title,
            url: this.cleanGoogleUrl(url),
            description: snippet || 'No description available',
            fullContent: '',
            contentPreview: '',
            wordCount: 0,
            timestamp,
            fetchStatus: 'success',
          });
        }
      });

      if (results.length > 0) break; // Found results with this selector
    }

    return results;
  }

  private isValidSearchUrl(url: string): boolean {
    // Google search results URLs should start with /url? or be direct URLs
    return url.startsWith('/url?') || 
           url.startsWith('http://') || 
           url.startsWith('https://') ||
           url.startsWith('//');
  }

  private cleanGoogleUrl(url: string): string {
    // Handle Google's redirect URLs
    if (url.startsWith('/url?')) {
      try {
        const urlParams = new URLSearchParams(url.substring(5));
        const actualUrl = urlParams.get('q') || urlParams.get('url');
        if (actualUrl) {
          return actualUrl;
        }
      } catch (error) {
        console.warn('Failed to parse Google redirect URL:', url);
      }
    }

    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      return 'https:' + url;
    }

    return url;
  }
}
