/**
 * Factory for creating crawler instances
 */

import * as winston from 'winston';
import { BaseCrawler } from './BaseCrawler';
import { SourceConfig } from '../types/crawler.types';
import { SourceType } from '@prisma/client';

/**
 * Crawler constructor type
 */
type CrawlerConstructor = new (
  source: SourceConfig,
  logger?: winston.Logger
) => BaseCrawler;

/**
 * Factory for creating and managing crawler instances
 */
export class CrawlerFactory {
  private static crawlerRegistry = new Map<SourceType, CrawlerConstructor>();
  private static logger: winston.Logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    defaultMeta: { service: 'CrawlerFactory' },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
    ],
  });

  /**
   * Register a crawler for a specific source type
   */
  public static registerCrawler(
    type: SourceType,
    crawlerClass: CrawlerConstructor
  ): void {
    if (this.crawlerRegistry.has(type)) {
      this.logger.warn(`Overwriting existing crawler for type ${type}`);
    }
    this.crawlerRegistry.set(type, crawlerClass);
    this.logger.info(
      `Registered crawler for type ${type}: ${crawlerClass.name}`
    );
  }

  /**
   * Unregister a crawler for a specific source type
   */
  public static unregisterCrawler(type: SourceType): void {
    if (this.crawlerRegistry.delete(type)) {
      this.logger.info(`Unregistered crawler for type ${type}`);
    } else {
      this.logger.warn(`No crawler registered for type ${type}`);
    }
  }

  /**
   * Create a crawler instance for the given source
   */
  public static createCrawler(
    source: SourceConfig,
    logger?: winston.Logger
  ): BaseCrawler {
    const CrawlerClass = this.crawlerRegistry.get(source.type);

    if (!CrawlerClass) {
      throw new Error(`No crawler registered for source type: ${source.type}`);
    }

    this.logger.info(
      `Creating crawler instance for source: ${source.name} (${source.type})`
    );
    return new CrawlerClass(source, logger);
  }

  /**
   * Check if a crawler is registered for a specific type
   */
  public static hasCrawler(type: SourceType): boolean {
    return this.crawlerRegistry.has(type);
  }

  /**
   * Get all registered crawler types
   */
  public static getRegisteredTypes(): SourceType[] {
    return Array.from(this.crawlerRegistry.keys());
  }

  /**
   * Clear all registered crawlers
   */
  public static clearRegistry(): void {
    this.crawlerRegistry.clear();
    this.logger.info('Cleared all registered crawlers');
  }

  /**
   * Set factory logger
   */
  public static setLogger(logger: winston.Logger): void {
    this.logger = logger;
  }
}
