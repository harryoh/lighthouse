#!/usr/bin/env ts-node

/**
 * Analyze Naver News HTML structure to find correct selectors
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

async function analyzeNaverStructure() {
  console.log('🔍 Analyzing Naver News HTML structure...\n');

  const testUrl = 'https://news.naver.com/section/100';

  try {
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

    // Find article links
    const articleLinks = $('a[href*="/article/"]');
    console.log(`Found ${articleLinks.length} article links\n`);

    if (articleLinks.length > 0) {
      // Analyze the parent structure of article links
      console.log('📊 Analyzing parent structure of article links:');
      console.log('='.repeat(60));

      // Get unique parent classes
      const parentClasses = new Set<string>();
      const grandparentClasses = new Set<string>();

      articleLinks.each((i, elem) => {
        const $link = $(elem);
        const parent = $link.parent();
        const grandparent = parent.parent();

        const parentClass = parent.attr('class') || 'no-class';
        const grandparentClass = grandparent.attr('class') || 'no-class';

        parentClasses.add(parentClass);
        grandparentClasses.add(grandparentClass);

        // Show first 3 examples
        if (i < 3) {
          const href = $link.attr('href');
          const text = $link.text().trim().substring(0, 40);
          console.log(`\nExample ${i + 1}:`);
          console.log(`  Text: "${text}..."`);
          console.log(`  Link: ${href}`);
          console.log(
            `  Parent: <${parent.get(0)?.name} class="${parentClass}">`
          );
          console.log(
            `  Grandparent: <${
              grandparent.get(0)?.name
            } class="${grandparentClass}">`
          );
        }
      });

      console.log('\n📝 Unique parent classes found:');
      Array.from(parentClasses).forEach((cls) => {
        const count = articleLinks.filter(
          (i, elem) => $(elem).parent().attr('class') === cls
        ).length;
        console.log(`  - ".${cls}": ${count} articles`);
      });

      console.log('\n📝 Unique grandparent classes found:');
      Array.from(grandparentClasses).forEach((cls) => {
        const count = articleLinks.filter(
          (i, elem) => $(elem).parent().parent().attr('class') === cls
        ).length;
        console.log(`  - ".${cls}": ${count} articles`);
      });

      // Find the most common container
      console.log('\n🎯 Recommended selectors:');

      // Check if there's a common container class
      const containerCounts = new Map<string, number>();

      articleLinks.each((i, elem) => {
        const $link = $(elem);
        // Check various parent levels
        for (let level = 1; level <= 4; level++) {
          let $container = $link;
          for (let j = 0; j < level; j++) {
            $container = $container.parent();
          }
          const containerClass = $container.attr('class');
          if (containerClass) {
            containerClass.split(' ').forEach((cls) => {
              if (cls) {
                containerCounts.set(cls, (containerCounts.get(cls) || 0) + 1);
              }
            });
          }
        }
      });

      // Sort by count and show top classes
      const sortedContainers = Array.from(containerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      console.log('  Most common container classes:');
      sortedContainers.forEach(([cls, count]) => {
        console.log(`    .${cls}: ${count} occurrences`);
      });

      // Test specific selector patterns
      console.log('\n🧪 Testing specific selector patterns:');
      const testSelectors = [
        '.sa_item',
        '.sa_text',
        '.sa_text_title',
        '.sa_item_inner',
        '.ct_wrap',
        '[class*="sa_"]',
      ];

      for (const selector of testSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          // Check if these contain article links
          const withLinks = elements.filter(
            (i, elem) => $(elem).find('a[href*="/article/"]').length > 0
          ).length;
          console.log(
            `  ${selector}: ${elements.length} elements (${withLinks} with article links)`
          );
        }
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

analyzeNaverStructure().catch(console.error);
