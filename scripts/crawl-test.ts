#!/usr/bin/env ts-node

/**
 * Test script for NaverNewsCrawler - Development only
 * WARNING: This disables robots.txt checking for testing purposes
 * DO NOT use this in production!
 */

import { NaverNewsCrawler } from '../libs/crawler-core/src/crawlers/NaverNewsCrawler';

async function testCrawl() {
  console.log('🚀 Starting Naver News Crawler Test (Dev Mode)...\n');
  console.log('⚠️  WARNING: Robots.txt checking is disabled for testing\n');

  try {
    // Test with politics section
    const testUrl = 'https://news.naver.com/section/100';
    console.log(`📰 Crawling: ${testUrl}`);
    console.log('='.repeat(60));

    // Create crawler with robots checking disabled (dev only!)
    const crawler = new NaverNewsCrawler(
      testUrl,
      undefined, // logger
      undefined, // playwrightConfig
      {
        userAgent: 'Mozilla/5.0 (Development Test Bot)',
        respectCrawlDelay: false,
      }
    );

    const result = await crawler.crawl();

    if (!result.success) {
      console.error('❌ Crawl failed:', result.error?.message);
      return;
    }

    if (!result.contents || result.contents.length === 0) {
      console.log('⚠️ No articles found');
      return;
    }

    console.log(
      `\n✅ Successfully crawled ${result.contents.length} articles!\n`
    );

    // Display first 3 articles with full details
    const articlesToShow = Math.min(3, result.contents.length);
    for (let i = 0; i < articlesToShow; i++) {
      const article = result.contents[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📄 Article ${i + 1}/${articlesToShow}`);
      console.log(`${'='.repeat(60)}`);
      console.log(`📌 Title: ${article.title}`);
      console.log(`🔗 URL: ${article.url}`);
      console.log(`📅 Date: ${article.publishedAt || 'N/A'}`);
      console.log(`✍️  Author: ${article.author || 'N/A'}`);
      console.log(`📝 Content Preview:`);
      console.log(`   ${article.body?.substring(0, 300)}...`);

      if (article.metadata?.images && Array.isArray(article.metadata.images)) {
        console.log(`🖼️  Images: ${article.metadata.images.length} found`);
      }
      if (article.metadata?.tags && Array.isArray(article.metadata.tags)) {
        console.log(
          `🏷️  Tags: ${(article.metadata.tags as string[]).join(', ')}`
        );
      }
    }

    // Show statistics
    console.log('\n' + '='.repeat(60));
    console.log('📊 Crawl Statistics:');
    console.log('='.repeat(60));
    console.log(`✅ Success Count: ${result.stats.successCount} articles`);
    console.log(`❌ Failure Count: ${result.stats.failureCount} articles`);
    console.log(`⏱️  Total Duration: ${result.stats.duration}ms`);
    console.log(
      `⚡ Average Time per Article: ${Math.round(
        result.stats.duration / result.stats.successCount
      )}ms`
    );

    // Cleanup
    await crawler.cleanup();
    console.log('\n🧹 Crawler cleanup completed');
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the test
console.log('Naver News Crawler Test Script (Development Mode)');
console.log('='.repeat(60));
testCrawl().catch(console.error);
