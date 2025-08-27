#!/usr/bin/env ts-node

/**
 * Debug script to check what HTML Naver News returns
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

async function debugNaver() {
  console.log('🔍 Debugging Naver News HTML structure...\n');

  const testUrl = 'https://news.naver.com/section/100';

  try {
    console.log(`📡 Fetching: ${testUrl}`);

    const response = await axios.get(testUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    const $ = cheerio.load(response.data);

    console.log('\n📋 Testing selectors from news.types.ts:');
    console.log('='.repeat(60));

    // Test article list selector
    const articleListSelector = '.list_news .bx, .cluster_body .item';
    const articles = $(articleListSelector);
    console.log(
      `\n✅ Found ${articles.length} elements with selector: "${articleListSelector}"`
    );

    if (articles.length === 0) {
      // Try to find what actually contains article links
      console.log('\n🔍 Searching for potential article containers...');

      // Common patterns for news sites
      const potentialSelectors = [
        'article',
        '.article',
        '.news',
        '.item',
        '.list_item',
        '.news_item',
        '.content_item',
        '[class*="news"]',
        '[class*="article"]',
        '[class*="item"]',
        'a[href*="/article/"]',
        'a[href*="news.naver.com"]',
      ];

      for (const selector of potentialSelectors) {
        const count = $(selector).length;
        if (count > 0) {
          console.log(`  - "${selector}": ${count} elements`);
        }
      }
    }

    // Look for links with article patterns
    console.log('\n🔗 Article links found:');
    const articleLinks = $('a[href*="/article/"], a[href*="news.naver.com"]');
    console.log(`Found ${articleLinks.length} potential article links`);

    // Show first 5 links
    articleLinks.slice(0, 5).each((i, elem) => {
      const href = $(elem).attr('href');
      const text = $(elem).text().trim().substring(0, 50);
      console.log(`  ${i + 1}. ${text}... → ${href}`);
    });

    // Check page structure
    console.log('\n📄 Page structure analysis:');
    console.log(`  - Title: ${$('title').text()}`);
    console.log(`  - Has main tag: ${$('main').length > 0}`);
    console.log(`  - Has article tags: ${$('article').length}`);
    console.log(`  - Has section tags: ${$('section').length}`);

    // Save HTML for manual inspection
    const fs = require('fs');
    const htmlFile = './debug-naver.html';
    fs.writeFileSync(htmlFile, response.data);
    console.log(`\n💾 Full HTML saved to: ${htmlFile}`);
    console.log('   You can open this file to inspect the structure manually.');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugNaver().catch(console.error);
