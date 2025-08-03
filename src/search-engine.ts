import axios from 'axios';
import * as cheerio from 'cheerio';
import { SearchOptions, SearchResult, SearchResultWithMetadata } from './types.js';
import { generateTimestamp, sanitizeQuery } from './utils.js';
import { RateLimiter } from './rate-limiter.js';
import { BrowserPool } from './browser-pool.js';

export class SearchEngine {
  private readonly rateLimiter: RateLimiter;
  private browserPool: BrowserPool;

  constructor() {
    this.rateLimiter = new RateLimiter(10); // 10 requests per minute
    this.browserPool = new BrowserPool();
  }

  async search(options: SearchOptions): Promise<SearchResultWithMetadata> {
    const { query, numResults = 5, timeout = 10000 } = options;
    const sanitizedQuery = sanitizeQuery(query);
    
    console.log(`[SearchEngine] Starting search for query: "${sanitizedQuery}"`);
    
    try {
      return await this.rateLimiter.execute(async () => {
        console.log(`[SearchEngine] Starting search with multiple engines...`);
        
        // Configuration from environment variables
        const enableQualityCheck = process.env.ENABLE_RELEVANCE_CHECKING !== 'false';
        const qualityThreshold = parseFloat(process.env.RELEVANCE_THRESHOLD || '0.3');
        const forceMultiEngine = process.env.FORCE_MULTI_ENGINE_SEARCH === 'true';
        const debugBrowsers = process.env.DEBUG_BROWSER_LIFECYCLE === 'true';
        
        console.log(`[SearchEngine] Quality checking: ${enableQualityCheck}, threshold: ${qualityThreshold}, multi-engine: ${forceMultiEngine}, debug: ${debugBrowsers}`);

        // Try multiple approaches to get search results, starting with most reliable
        const approaches = [
          { method: this.tryBrowserBingSearch.bind(this), name: 'Browser Bing' },
          { method: this.tryBrowserBraveSearch.bind(this), name: 'Browser Brave' },
          { method: this.tryDuckDuckGoSearch.bind(this), name: 'Axios DuckDuckGo' }
        ];
        
        let bestResults: SearchResult[] = [];
        let bestEngine = 'None';
        let bestQuality = 0;
        
        for (let i = 0; i < approaches.length; i++) {
          const approach = approaches[i];
          try {
            console.log(`[SearchEngine] Attempting ${approach.name} (${i + 1}/${approaches.length})...`);
            
            // Use more aggressive timeouts for faster fallback
            const approachTimeout = Math.min(timeout / 3, 4000); // Max 4 seconds per approach for faster fallback
            const results = await approach.method(sanitizedQuery, numResults, approachTimeout);
            if (results.length > 0) {
              console.log(`[SearchEngine] Found ${results.length} results with ${approach.name}`);
              
              // Validate result quality to detect irrelevant results
              const qualityScore = enableQualityCheck ? this.assessResultQuality(results, sanitizedQuery) : 1.0;
              console.log(`[SearchEngine] ${approach.name} quality score: ${qualityScore.toFixed(2)}/1.0`);
              
              // Track the best results so far
              if (qualityScore > bestQuality) {
                bestResults = results;
                bestEngine = approach.name;
                bestQuality = qualityScore;
              }
              
              // If quality is excellent, return immediately (unless forcing multi-engine)
              if (qualityScore >= 0.8 && !forceMultiEngine) {
                console.log(`[SearchEngine] Excellent quality results from ${approach.name}, returning immediately`);
                return { results, engine: approach.name };
              }
              
              // If quality is acceptable and this isn't Bing (first engine), return
              if (qualityScore >= qualityThreshold && approach.name !== 'Browser Bing' && !forceMultiEngine) {
                console.log(`[SearchEngine] Good quality results from ${approach.name}, using as primary`);
                return { results, engine: approach.name };
              }
              
              // If this is the last engine or quality is acceptable, prepare to return
              if (i === approaches.length - 1) {
                if (bestQuality >= qualityThreshold || !enableQualityCheck) {
                  console.log(`[SearchEngine] Using best results from ${bestEngine} (quality: ${bestQuality.toFixed(2)})`);
                  return { results: bestResults, engine: bestEngine };
                } else if (bestResults.length > 0) {
                  console.log(`[SearchEngine] Warning: Low quality results from all engines, using best available from ${bestEngine}`);
                  return { results: bestResults, engine: bestEngine };
                }
              } else {
                console.log(`[SearchEngine] ${approach.name} results quality: ${qualityScore.toFixed(2)}, continuing to try other engines...`);
              }
            }
          } catch (error) {
            console.error(`[SearchEngine] ${approach.name} approach failed:`, error);
            
            // Handle browser-specific errors (no cleanup needed since each engine uses dedicated browsers)
            await this.handleBrowserError(error, approach.name);
          }
        }
        
        console.log(`[SearchEngine] All approaches failed, returning empty results`);
        return { results: [], engine: 'None' };
      });
    } catch (error) {
      console.error('[SearchEngine] Search error:', error);
      if (axios.isAxiosError(error)) {
        console.error('[SearchEngine] Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data?.substring(0, 500),
        });
      }
      throw new Error(`Failed to perform search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }




  private async tryBrowserBraveSearch(query: string, numResults: number, timeout: number): Promise<SearchResult[]> {
    console.log(`[SearchEngine] Trying browser-based Brave search with dedicated browser...`);
    
    // Try with retry mechanism
    for (let attempt = 1; attempt <= 2; attempt++) {
      let browser;
      try {
        // Create a dedicated browser instance for Brave search only
        const { firefox } = await import('playwright');
        browser = await firefox.launch({
          headless: process.env.BROWSER_HEADLESS !== 'false',
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
          ],
        });
        
        console.log(`[SearchEngine] Brave search attempt ${attempt}/2 with fresh browser`);
        const results = await this.tryBrowserBraveSearchInternal(browser, query, numResults, timeout);
        return results;
      } catch (error) {
        console.error(`[SearchEngine] Brave search attempt ${attempt}/2 failed:`, error);
        if (attempt === 2) {
          throw error; // Re-throw on final attempt
        }
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 500));
      } finally {
        // Always close the dedicated browser
        if (browser) {
          try {
            await browser.close();
          } catch (closeError) {
            console.log(`[SearchEngine] Error closing Brave browser:`, closeError);
          }
        }
      }
    }
    
    throw new Error('All Brave search attempts failed');
  }

  private async tryBrowserBraveSearchInternal(browser: any, query: string, numResults: number, timeout: number): Promise<SearchResult[]> {
    // Validate browser is still functional before proceeding
    if (!browser.isConnected()) {
      throw new Error('Browser is not connected');
    }
    
    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
      });

      try {
        const page = await context.newPage();
        
        // Navigate to Brave search
        const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
        console.log(`[SearchEngine] Browser navigating to Brave: ${searchUrl}`);
        
        await page.goto(searchUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: timeout
        });

        // Wait for search results to load
        try {
          await page.waitForSelector('[data-type="web"]', { timeout: 3000 });
        } catch {
          console.log(`[SearchEngine] Browser Brave results selector not found, proceeding anyway`);
        }

        // Get the page content
        const html = await page.content();
        
        console.log(`[SearchEngine] Browser Brave got HTML with length: ${html.length}`);
        
        const results = this.parseBraveResults(html, numResults);
        console.log(`[SearchEngine] Browser Brave parsed ${results.length} results`);
        
        await context.close();
        return results;
      } catch (error) {
        // Ensure context is closed even on error
        await context.close();
        throw error;
      }
    } catch (error) {
      console.error(`[SearchEngine] Browser Brave search failed:`, error);
      throw error;
    }
  }

  private async tryBrowserBingSearch(query: string, numResults: number, timeout: number): Promise<SearchResult[]> {
    console.log(`[SearchEngine] Trying browser-based Bing search with dedicated browser...`);
    
    // Try with retry mechanism
    for (let attempt = 1; attempt <= 2; attempt++) {
      let browser;
      try {
        // Create a dedicated browser instance for Bing search only
        const { chromium } = await import('playwright');
        browser = await chromium.launch({
          headless: process.env.BROWSER_HEADLESS !== 'false',
          args: [
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
        });
        
        console.log(`[SearchEngine] Bing search attempt ${attempt}/2 with fresh browser`);
        const results = await this.tryBrowserBingSearchInternal(browser, query, numResults, timeout);
        return results;
      } catch (error) {
        console.error(`[SearchEngine] Bing search attempt ${attempt}/2 failed:`, error);
        if (attempt === 2) {
          throw error; // Re-throw on final attempt
        }
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 500));
      } finally {
        // Always close the dedicated browser
        if (browser) {
          try {
            await browser.close();
          } catch (closeError) {
            console.log(`[SearchEngine] Error closing Bing browser:`, closeError);
          }
        }
      }
    }
    
    throw new Error('All Bing search attempts failed');
  }

  private async tryBrowserBingSearchInternal(browser: any, query: string, numResults: number, timeout: number): Promise<SearchResult[]> {
    // Validate browser is still functional before proceeding
    if (!browser.isConnected()) {
      throw new Error('Browser is not connected');
    }
    
    try {
      // Enhanced browser context with more realistic fingerprinting
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        colorScheme: 'light',
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none'
        }
      });

      const page = await context.newPage();
      
      try {
        // Try enhanced Bing search with proper web interface flow
        try {
          const results = await this.tryEnhancedBingSearch(page, query, numResults, timeout);
          await context.close();
          return results;
        } catch (enhancedError) {
          console.log(`[SearchEngine] Enhanced Bing search failed, trying fallback: ${enhancedError instanceof Error ? enhancedError.message : 'Unknown error'}`);
          
          // Fallback to direct URL approach with enhanced parameters
          const results = await this.tryDirectBingSearch(page, query, numResults, timeout);
          await context.close();
          return results;
        }
      } catch (error) {
        // Ensure context is closed even on error
        await context.close();
        throw error;
      }
    } catch (error) {
      console.error(`[SearchEngine] Browser Bing search failed:`, error);
      throw error;
    }
  }

  private async tryEnhancedBingSearch(page: any, query: string, numResults: number, timeout: number): Promise<SearchResult[]> {
    console.log(`[SearchEngine] Trying enhanced Bing search via web interface...`);
    
    // Navigate to Bing homepage first to establish proper session
    await page.goto('https://www.bing.com', { 
      waitUntil: 'domcontentloaded',
      timeout: timeout / 2
    });
    
    // Wait a moment for page to fully load
    await page.waitForTimeout(500);
    
    // Find and use the search box (more realistic than direct URL)
    try {
      await page.waitForSelector('#sb_form_q', { timeout: 2000 });
      await page.fill('#sb_form_q', query);
      
      // Submit the search form
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: timeout }),
        page.click('#search_icon')
      ]);
      
    } catch (formError) {
      console.log(`[SearchEngine] Search form submission failed, falling back to URL navigation`);
      throw formError;
    }
    
    // Wait for search results to load
    try {
      await page.waitForSelector('.b_algo, .b_result', { timeout: 3000 });
    } catch {
      console.log(`[SearchEngine] Enhanced Bing results selector not found, proceeding anyway`);
    }

    const html = await page.content();
    console.log(`[SearchEngine] Enhanced Bing got HTML with length: ${html.length}`);
    
    const results = this.parseBingResults(html, numResults);
    console.log(`[SearchEngine] Enhanced Bing parsed ${results.length} results`);
    
    return results;
  }

  private async tryDirectBingSearch(page: any, query: string, numResults: number, timeout: number): Promise<SearchResult[]> {
    console.log(`[SearchEngine] Trying direct Bing search with enhanced parameters...`);
    
    // Generate a conversation ID (cvid) similar to what Bing uses
    const cvid = this.generateConversationId();
    
    // Construct URL with enhanced parameters based on successful manual searches
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${Math.min(numResults, 10)}&form=QBLH&sp=-1&qs=n&cvid=${cvid}`;
    console.log(`[SearchEngine] Browser navigating to enhanced Bing URL: ${searchUrl}`);
    
    await page.goto(searchUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: timeout
    });

    // Wait for search results to load
    try {
      await page.waitForSelector('.b_algo, .b_result', { timeout: 3000 });
    } catch {
      console.log(`[SearchEngine] Direct Bing results selector not found, proceeding anyway`);
    }

    const html = await page.content();
    console.log(`[SearchEngine] Direct Bing got HTML with length: ${html.length}`);
    
    const results = this.parseBingResults(html, numResults);
    console.log(`[SearchEngine] Direct Bing parsed ${results.length} results`);
    
    return results;
  }

  private generateConversationId(): string {
    // Generate a conversation ID similar to Bing's format (32 hex characters)
    const chars = '0123456789ABCDEF';
    let cvid = '';
    for (let i = 0; i < 32; i++) {
      cvid += chars[Math.floor(Math.random() * chars.length)];
    }
    return cvid;
  }


  private async tryDuckDuckGoSearch(query: string, numResults: number, timeout: number): Promise<SearchResult[]> {
    console.log(`[SearchEngine] Trying DuckDuckGo as fallback...`);
    
    try {
      const response = await axios.get('https://html.duckduckgo.com/html/', {
        params: {
          q: query,
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout,
        validateStatus: (status: number) => status < 400,
      });

      console.log(`[SearchEngine] DuckDuckGo got response with status: ${response.status}`);
      
      const results = this.parseDuckDuckGoResults(response.data, numResults);
      console.log(`[SearchEngine] DuckDuckGo parsed ${results.length} results`);
      
      return results;
    } catch {
      console.error(`[SearchEngine] DuckDuckGo search failed`);
      throw new Error('DuckDuckGo search failed');
    }
  }

  private parseSearchResults(html: string, maxResults: number): SearchResult[] {
    console.log(`[SearchEngine] Parsing HTML with length: ${html.length}`);
    
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];
    const timestamp = generateTimestamp();

    // Log what selectors we find - more comprehensive debugging
    const gElements = $('div.g');
    const sokobanElements = $('div[data-sokoban-container]');
    const tF2CxcElements = $('.tF2Cxc');
    const rcElements = $('.rc');
    const vedElements = $('[data-ved]');
    const h3Elements = $('h3');
    const linkElements = $('a[href]');
    
    console.log(`[SearchEngine] Found elements:`);
    console.log(`  - div.g: ${gElements.length}`);
    console.log(`  - div[data-sokoban-container]: ${sokobanElements.length}`);
    console.log(`  - .tF2Cxc: ${tF2CxcElements.length}`);
    console.log(`  - .rc: ${rcElements.length}`);
    console.log(`  - [data-ved]: ${vedElements.length}`);
    console.log(`  - h3: ${h3Elements.length}`);
    console.log(`  - a[href]: ${linkElements.length}`);
    
    // Try multiple approaches to find search results
    const searchResultSelectors = [
      'div.g',
      'div[data-sokoban-container]',
      '.tF2Cxc',
      '.rc',
      '[data-ved]',
      'div[jscontroller]'
    ];
    
    let foundResults = false;
    
    for (const selector of searchResultSelectors) {
      if (foundResults) break;
      
      console.log(`[SearchEngine] Trying selector: ${selector}`);
      const elements = $(selector);
      console.log(`[SearchEngine] Found ${elements.length} elements with selector ${selector}`);
      
      elements.each((_index, element) => {
        if (results.length >= maxResults) return false;
        
        const $element = $(element);
        
        // Try multiple title selectors
        const titleSelectors = ['h3', '.LC20lb', '.DKV0Md', 'a[data-ved]', '.r', '.s'];
        let title = '';
        let url = '';
        
        for (const titleSelector of titleSelectors) {
          const $title = $element.find(titleSelector).first();
          if ($title.length) {
            title = $title.text().trim();
            console.log(`[SearchEngine] Found title with ${titleSelector}: "${title}"`);
            
            // Try to find the link
            const $link = $title.closest('a');
            if ($link.length) {
              url = $link.attr('href') || '';
              console.log(`[SearchEngine] Found URL: "${url}"`);
            } else {
              // Try to find any link in the element
              const $anyLink = $element.find('a[href]').first();
              if ($anyLink.length) {
                url = $anyLink.attr('href') || '';
                console.log(`[SearchEngine] Found URL from any link: "${url}"`);
              }
            }
            break;
          }
        }
        
        // Try multiple snippet selectors
        const snippetSelectors = ['.VwiC3b', '.st', '.aCOpRe', '.IsZvec', '.s3v9rd', '.MUxGbd', '.aCOpRe', '.snippet-content'];
        let snippet = '';
        
        for (const snippetSelector of snippetSelectors) {
          const $snippet = $element.find(snippetSelector).first();
          if ($snippet.length) {
            snippet = $snippet.text().trim();
            console.log(`[SearchEngine] Found snippet with ${snippetSelector}: "${snippet.substring(0, 100)}..."`);
            break;
          }
        }
        
        if (title && url && this.isValidSearchUrl(url)) {
          console.log(`[SearchEngine] Adding result: ${title}`);
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
          foundResults = true;
        } else {
          console.log(`[SearchEngine] Skipping result: title="${title}", url="${url}", isValid=${this.isValidSearchUrl(url)}`);
        }
      });
    }

    console.log(`[SearchEngine] Found ${results.length} results with all selectors`);

    // If still no results, try a more aggressive approach - look for any h3 with links
    if (results.length === 0) {
      console.log(`[SearchEngine] No results found, trying aggressive h3 search...`);
      $('h3').each((_index, element) => {
        if (results.length >= maxResults) return false;
        
        const $h3 = $(element);
        const title = $h3.text().trim();
        const $link = $h3.closest('a');
        
        if ($link.length && title) {
          const url = $link.attr('href') || '';
          console.log(`[SearchEngine] Aggressive search found: "${title}" -> "${url}"`);
          
          if (this.isValidSearchUrl(url)) {
            results.push({
              title,
              url: this.cleanGoogleUrl(url),
              description: 'No description available',
              fullContent: '',
              contentPreview: '',
              wordCount: 0,
              timestamp,
              fetchStatus: 'success',
            });
          }
        }
      });
      
      console.log(`[SearchEngine] Aggressive search found ${results.length} results`);
    }

    return results;
  }

  private parseBraveResults(html: string, maxResults: number): SearchResult[] {
    console.log(`[SearchEngine] Parsing Brave HTML with length: ${html.length}`);
    
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];
    const timestamp = generateTimestamp();

    // Brave result selectors
    const resultSelectors = [
      '[data-type="web"]',     // Main Brave results
      '.result',               // Alternative format
      '.fdb'                   // Brave specific format
    ];
    
    let foundResults = false;
    
    for (const selector of resultSelectors) {
      if (foundResults && results.length >= maxResults) break;
      
      console.log(`[SearchEngine] Trying Brave selector: ${selector}`);
      const elements = $(selector);
      console.log(`[SearchEngine] Found ${elements.length} elements with selector ${selector}`);
      
      elements.each((_index, element) => {
        if (results.length >= maxResults) return false;

        const $element = $(element);
        
        // Try multiple title selectors for Brave
        const titleSelectors = [
          '.title a',              // Brave specific
          'h2 a',                  // Common format  
          '.result-title a',       // Alternative format
          'a[href*="://"]',        // Any external link
          '.snippet-title a'       // Snippet title
        ];
        
        let title = '';
        let url = '';
        
        for (const titleSelector of titleSelectors) {
          const $titleElement = $element.find(titleSelector).first();
          if ($titleElement.length) {
            title = $titleElement.text().trim();
            url = $titleElement.attr('href') || '';
            console.log(`[SearchEngine] Brave found title with ${titleSelector}: "${title}"`);
            if (title && url && url.startsWith('http')) {
              break;
            }
          }
        }
        
        // If still no title, try getting it from any text content
        if (!title) {
          const textContent = $element.text().trim();
          const lines = textContent.split('\n').filter(line => line.trim().length > 0);
          if (lines.length > 0) {
            title = lines[0].trim();
            console.log(`[SearchEngine] Brave found title from text content: "${title}"`);
          }
        }
        
        // Try multiple snippet selectors for Brave
        const snippetSelectors = [
          '.snippet-content',      // Brave specific
          '.snippet',              // Generic
          '.description',          // Alternative
          'p'                      // Fallback paragraph
        ];
        
        let snippet = '';
        for (const snippetSelector of snippetSelectors) {
          const $snippetElement = $element.find(snippetSelector).first();
          if ($snippetElement.length) {
            snippet = $snippetElement.text().trim();
            break;
          }
        }
        
        if (title && url && this.isValidSearchUrl(url)) {
          console.log(`[SearchEngine] Brave found: "${title}" -> "${url}"`);
          results.push({
            title,
            url: this.cleanBraveUrl(url),
            description: snippet || 'No description available',
            fullContent: '',
            contentPreview: '',
            wordCount: 0,
            timestamp,
            fetchStatus: 'success',
          });
          foundResults = true;
        }
      });
    }

    console.log(`[SearchEngine] Brave found ${results.length} results`);
    return results;
  }

  private parseBingResults(html: string, maxResults: number): SearchResult[] {
    console.log(`[SearchEngine] Parsing Bing HTML with length: ${html.length}`);
    
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];
    const timestamp = generateTimestamp();

    // Bing result selectors
    const resultSelectors = [
      '.b_algo',     // Main Bing results
      '.b_result',   // Alternative Bing format
      '.b_card'      // Card format
    ];
    
    let foundResults = false;
    
    for (const selector of resultSelectors) {
      if (foundResults && results.length >= maxResults) break;
      
      console.log(`[SearchEngine] Trying Bing selector: ${selector}`);
      const elements = $(selector);
      console.log(`[SearchEngine] Found ${elements.length} elements with selector ${selector}`);
      
      elements.each((_index, element) => {
        if (results.length >= maxResults) return false;

        const $element = $(element);
        
        // Try multiple title selectors for Bing
        const titleSelectors = [
          'h2 a',           // Standard Bing format
          '.b_title a',     // Alternative format
          'a[data-seid]'    // Bing specific
        ];
        
        let title = '';
        let url = '';
        
        for (const titleSelector of titleSelectors) {
          const $titleElement = $element.find(titleSelector).first();
          if ($titleElement.length) {
            title = $titleElement.text().trim();
            url = $titleElement.attr('href') || '';
            console.log(`[SearchEngine] Bing found title with ${titleSelector}: "${title}"`);
            break;
          }
        }
        
        // Try multiple snippet selectors for Bing
        const snippetSelectors = [
          '.b_caption p',           // Standard Bing snippet
          '.b_snippet',             // Alternative format
          '.b_descript',            // Description format
          '.b_caption',             // Caption without p tag
          '.b_caption > span',      // Caption span
          '.b_excerpt',             // Excerpt format
          'p',                      // Any paragraph in the result
          '.b_algo_content p',      // Content paragraph
          '.b_algo_content',        // Full content area
          '.b_context'              // Context information
        ];
        
        let snippet = '';
        for (const snippetSelector of snippetSelectors) {
          const $snippetElement = $element.find(snippetSelector).first();
          if ($snippetElement.length) {
            const candidateSnippet = $snippetElement.text().trim();
            // Skip very short snippets or those that look like metadata
            if (candidateSnippet.length > 20 && !candidateSnippet.match(/^\d+\s*(min|sec|hour|day|week|month|year)/i)) {
              snippet = candidateSnippet;
              console.log(`[SearchEngine] Bing found snippet with ${snippetSelector}: "${snippet.substring(0, 100)}..."`);
              break;
            }
          }
        }
        
        if (title && url && this.isValidSearchUrl(url)) {
          console.log(`[SearchEngine] Bing found: "${title}" -> "${url}"`);
          results.push({
            title,
            url: this.cleanBingUrl(url),
            description: snippet || 'No description available',
            fullContent: '',
            contentPreview: '',
            wordCount: 0,
            timestamp,
            fetchStatus: 'success',
          });
          foundResults = true;
        }
      });
    }

    console.log(`[SearchEngine] Bing found ${results.length} results`);
    return results;
  }

  private parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
    console.log(`[SearchEngine] Parsing DuckDuckGo HTML with length: ${html.length}`);
    
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];
    const timestamp = generateTimestamp();

    // DuckDuckGo results are in .result elements
    $('.result').each((_index, element) => {
      if (results.length >= maxResults) return false;

      const $element = $(element);
      
      // Extract title and URL
      const $titleElement = $element.find('.result__title a');
      const title = $titleElement.text().trim();
      const url = $titleElement.attr('href');
      
      // Extract snippet
      const snippet = $element.find('.result__snippet').text().trim();
      
      if (title && url) {
        console.log(`[SearchEngine] DuckDuckGo found: "${title}" -> "${url}"`);
        results.push({
          title,
          url: this.cleanDuckDuckGoUrl(url),
          description: snippet || 'No description available',
          fullContent: '',
          contentPreview: '',
          wordCount: 0,
          timestamp,
          fetchStatus: 'success',
        });
      }
    });

    console.log(`[SearchEngine] DuckDuckGo found ${results.length} results`);
    return results;
  }

  private isValidSearchUrl(url: string): boolean {
    // Google search results URLs can be in various formats
    return url.startsWith('/url?') || 
           url.startsWith('http://') || 
           url.startsWith('https://') ||
           url.startsWith('//') ||
           url.startsWith('/search?') ||
           url.startsWith('/') ||
           url.includes('google.com') ||
           url.length > 10; // Accept any reasonably long URL
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
      } catch {
        console.warn('Failed to parse Google redirect URL:', url);
      }
    }

    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      return 'https:' + url;
    }

    return url;
  }

  private cleanBraveUrl(url: string): string {
    // Brave URLs are usually direct, but check for any redirect patterns
    if (url.startsWith('//')) {
      return 'https:' + url;
    }
    
    // If it's already a full URL, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    return url;
  }

  private cleanBingUrl(url: string): string {
    // Bing URLs are usually direct, but check for any redirect patterns
    if (url.startsWith('//')) {
      return 'https:' + url;
    }
    
    // If it's already a full URL, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    return url;
  }

  private cleanDuckDuckGoUrl(url: string): string {
    // DuckDuckGo URLs are redirect URLs that need to be decoded
    if (url.startsWith('//duckduckgo.com/l/')) {
      try {
        // Extract the uddg parameter which contains the actual URL
        const urlParams = new URLSearchParams(url.substring(url.indexOf('?') + 1));
        const actualUrl = urlParams.get('uddg');
        if (actualUrl) {
          // Decode the URL
          const decodedUrl = decodeURIComponent(actualUrl);
          console.log(`[SearchEngine] Decoded DuckDuckGo URL: ${decodedUrl}`);
          return decodedUrl;
        }
      } catch {
        console.log(`[SearchEngine] Failed to decode DuckDuckGo URL: ${url}`);
      }
    }
    
    // If it's a protocol-relative URL, add https:
    if (url.startsWith('//')) {
      return 'https:' + url;
    }
    
    return url;
  }

  private assessResultQuality(results: SearchResult[], originalQuery: string): number {
    if (results.length === 0) return 0;

    // Extract keywords from the original query (ignore common words)
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'group', 'members']);
    const queryWords = originalQuery.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word));

    if (queryWords.length === 0) return 0.5; // Default score if no meaningful keywords

    console.log(`[SearchEngine] Quality assessment - Query keywords: [${queryWords.join(', ')}]`);

    let totalScore = 0;
    let scoredResults = 0;

    for (const result of results) {
      const titleText = result.title.toLowerCase();
      const descText = result.description.toLowerCase();
      const urlText = result.url.toLowerCase();
      const combinedText = `${titleText} ${descText} ${urlText}`;

      // Count keyword matches
      let keywordMatches = 0;
      let phraseMatches = 0;

      // Check for exact phrase matches (higher value)
      if (queryWords.length >= 2) {
        const queryPhrases = [];
        for (let i = 0; i < queryWords.length - 1; i++) {
          queryPhrases.push(queryWords.slice(i, i + 2).join(' '));
        }
        if (queryWords.length >= 3) {
          queryPhrases.push(queryWords.slice(0, 3).join(' '));
        }

        for (const phrase of queryPhrases) {
          if (combinedText.includes(phrase)) {
            phraseMatches++;
          }
        }
      }

      // Check individual keyword matches
      for (const keyword of queryWords) {
        if (combinedText.includes(keyword)) {
          keywordMatches++;
        }
      }

      // Calculate score for this result
      const keywordRatio = keywordMatches / queryWords.length;
      const phraseBonus = phraseMatches * 0.3; // Bonus for phrase matches
      const resultScore = Math.min(1.0, keywordRatio + phraseBonus);

      // Penalty for obvious irrelevant content
      const irrelevantPatterns = [
        /recipe/i, /cooking/i, /food/i, /restaurant/i, /menu/i,
        /weather/i, /temperature/i, /forecast/i,
        /shopping/i, /sale/i, /price/i, /buy/i, /store/i,
        /movie/i, /film/i, /tv show/i, /entertainment/i,
        /sports/i, /game/i, /score/i, /team/i,
        /fashion/i, /clothing/i, /style/i,
        /travel/i, /hotel/i, /flight/i, /vacation/i,
        /car/i, /vehicle/i, /automotive/i,
        /real estate/i, /property/i, /house/i, /apartment/i
      ];

      let penalty = 0;
      for (const pattern of irrelevantPatterns) {
        if (pattern.test(combinedText)) {
          penalty += 0.2;
        }
      }

      const finalScore = Math.max(0, resultScore - penalty);
      
      console.log(`[SearchEngine] Result "${result.title.substring(0, 50)}..." - Score: ${finalScore.toFixed(2)} (keywords: ${keywordMatches}/${queryWords.length}, phrases: ${phraseMatches}, penalty: ${penalty.toFixed(2)})`);
      
      totalScore += finalScore;
      scoredResults++;
    }

    const averageScore = scoredResults > 0 ? totalScore / scoredResults : 0;
    return averageScore;
  }

  private async validateBrowserHealth(browser: any): Promise<boolean> {
    const debugBrowsers = process.env.DEBUG_BROWSER_LIFECYCLE === 'true';
    
    try {
      if (debugBrowsers) console.log(`[SearchEngine] Validating browser health...`);
      
      // Check if browser is still connected
      if (!browser.isConnected()) {
        if (debugBrowsers) console.log(`[SearchEngine] Browser is not connected`);
        return false;
      }
      
      // Try to create a simple context to test browser responsiveness
      const testContext = await browser.newContext();
      await testContext.close();
      
      if (debugBrowsers) console.log(`[SearchEngine] Browser health check passed`);
      return true;
    } catch (error) {
      console.log(`[SearchEngine] Browser health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  private async handleBrowserError(error: any, engineName: string, attemptNumber: number = 1): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[SearchEngine] ${engineName} browser error (attempt ${attemptNumber}): ${errorMessage}`);
    
    // Check for specific browser-related errors
    if (errorMessage.includes('Target page, context or browser has been closed') ||
        errorMessage.includes('Browser has been closed') ||
        errorMessage.includes('Session has been closed')) {
      
      console.log(`[SearchEngine] Detected browser session closure, attempting to refresh browser pool`);
      
      // Try to refresh the browser pool for subsequent attempts
      try {
        await this.browserPool.closeAll();
        console.log(`[SearchEngine] Browser pool refreshed for ${engineName}`);
      } catch (refreshError) {
        console.error(`[SearchEngine] Failed to refresh browser pool: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`);
      }
    }
  }

  async closeAll(): Promise<void> {
    await this.browserPool.closeAll();
  }
}
