import axios from 'axios';
import * as cheerio from 'cheerio';
import { ContentExtractionOptions, SearchResult } from './types.js';
import { cleanText, getWordCount, getContentPreview, generateTimestamp, getRandomUserAgent } from './utils.js';

export class ContentExtractor {
  private readonly defaultTimeout: number;
  private readonly maxContentLength: number;

  constructor() {
    this.defaultTimeout = 10000;
    this.maxContentLength = 10000; // 10KB limit as per specification
  }

  async extractContent(options: ContentExtractionOptions): Promise<string> {
    const { url, timeout = this.defaultTimeout, maxContentLength = this.maxContentLength } = options;
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
        },
        timeout,
        maxContentLength,
        validateStatus: (status: number) => status < 400,
      });

      return this.parseContent(response.data);
    } catch (error) {
      console.error(`Content extraction error for ${url}:`, error);
      throw new Error(`Failed to extract content from ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractContentForResults(results: SearchResult[]): Promise<SearchResult[]> {
    const enhancedResults = await Promise.allSettled(
      results.map(async (result) => {
        try {
          const content = await this.extractContent({ url: result.url });
          const cleanedContent = cleanText(content, this.maxContentLength);
          
          return {
            ...result,
            fullContent: cleanedContent,
            contentPreview: getContentPreview(cleanedContent),
            wordCount: getWordCount(cleanedContent),
            timestamp: generateTimestamp(),
            fetchStatus: 'success' as const,
          };
        } catch (error) {
          return {
            ...result,
            fullContent: '',
            contentPreview: '',
            wordCount: 0,
            timestamp: generateTimestamp(),
            fetchStatus: 'error' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return enhancedResults.map((promiseResult) => {
      if (promiseResult.status === 'fulfilled') {
        return promiseResult.value;
      } else {
        return {
          title: '',
          url: '',
          description: '',
          fullContent: '',
          contentPreview: '',
          wordCount: 0,
          timestamp: generateTimestamp(),
          fetchStatus: 'error' as const,
          error: 'Promise rejected',
        };
      }
    });
  }

  private parseContent(html: string): string {
    const $ = cheerio.load(html);
    
    // Remove script and style elements
    $('script, style, noscript, iframe, img, video, audio').remove();
    
    // Remove navigation, header, footer, and other non-content elements
    $('nav, header, footer, .nav, .header, .footer, .sidebar, .menu, .breadcrumb, aside, .ad, .advertisement').remove();
    
    // Extract text from main content areas (prioritize article, main, or body)
    const mainContent = $('article, main, [role="main"], .content, .post-content, .entry-content')
      .first()
      .text()
      .trim();
    
    if (mainContent) {
      return cleanText(mainContent, this.maxContentLength);
    }
    
    // Fallback to body content
    return cleanText($('body').text(), this.maxContentLength);
  }
}
