/**
 * Crawler Core Library
 * Main entry point for the crawler functionality
 */

// Export types
export * from './types/crawler.types';
export * from './types/news.types';

// Export crawlers
export { BaseCrawler } from './crawlers/BaseCrawler';
export { CrawlerFactory } from './crawlers/CrawlerFactory';
export { NewsCrawler } from './crawlers/NewsCrawler';
export { NaverNewsCrawler } from './crawlers/NaverNewsCrawler';

// Export queue interfaces and implementation
export * from './queue/QueueInterface';
export { QueueManager } from './queue/QueueManager';
export { QueueFactory } from './queue/QueueFactory';
export {
  RedisConnectionManager,
  type RedisConfig,
} from './queue/RedisConnectionManager';
export {
  QueueInitializer,
  type QueueSystemConfig,
  type JobProcessors,
} from './queue/QueueInitializer';

// Export job processors
export * from './queue/processors';
