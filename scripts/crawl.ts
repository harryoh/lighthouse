#!/usr/bin/env ts-node

/**
 * Simple test script to verify NaverNewsCrawler functionality
 * Run with: pnpm tsx scripts/crawl.ts
 */

import { NaverNewsCrawler } from '../libs/crawler-core/src/crawlers/NaverNewsCrawler';

async function testCrawl() {
  console.log('🚀 Starting Naver News Crawler Test...\n');

  try {
    // Test with politics section
    const testUrl = 'https://news.naver.com/section/100';
    console.log(`📰 Crawling: ${testUrl}`);
    console.log('='.repeat(60));

    const crawler = new NaverNewsCrawler(testUrl);
    const result = await crawler.crawl();

    if (!result.success) {
      console.error('❌ Crawl failed:', result.error?.message);
      return;
    }

    if (!result.contents || result.contents.length === 0) {
      console.log('⚠️ No articles found');
      return;
    }

    console.log(`\n✅ Found ${result.contents.length} articles\n`);

    // Display first 5 articles
    result.contents.slice(0, 5).forEach((article, index) => {
      console.log(`\n📄 Article ${index + 1}:`);
      console.log('-'.repeat(50));
      console.log(`Title: ${article.title}`);
      console.log(`URL: ${article.url}`);
      console.log(`Date: ${article.publishedAt || 'N/A'}`);
      console.log(`Author: ${article.author || 'N/A'}`);
      console.log(`Preview: ${article.content?.substring(0, 200)}...`);
    });

    // Show statistics
    console.log('\n' + '='.repeat(60));
    console.log('📊 Crawl Statistics:');
    console.log(`- Total Pages: ${result.stats.totalPages}`);
    console.log(`- Success Count: ${result.stats.successCount}`);
    console.log(`- Failure Count: ${result.stats.failureCount}`);
    console.log(`- Duration: ${result.stats.duration}ms`);
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the test
console.log('Naver News Crawler Test Script');
console.log('='.repeat(60));
testCrawl().catch(console.error);
