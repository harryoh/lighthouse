/**
 * News-specific type definitions
 */

import { SourceConfig, ParsedContent } from './crawler.types';

export interface NewsArticle {
  title: string;
  body: string;
  author?: string;
  publishedDate?: Date;
  images: string[];
  captions: string[];
  sourceUrl: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
}

export interface NewsSourceConfig extends SourceConfig {
  selectors: {
    titleSelector: string;
    bodySelector: string;
    authorSelector?: string;
    dateSelector?: string;
    imageSelector?: string;
    captionSelector?: string;
    excerptSelector?: string;
    categorySelector?: string;
    tagSelector?: string;
    articleListSelector?: string;
    paginationSelector?: string;
    nextPageSelector?: string;
    sectionSelector?: string;
  };
  dateFormats?: string[];
  timezone?: string;
  pagination?: PaginationConfig;
  discovery?: DiscoveryConfig;
  dynamicContentConfig?: {
    enabled?: boolean;
    detectAutomatically?: boolean;
    forcePlaywright?: boolean;
    scrollForContent?: boolean;
    waitForSelector?: string;
  };
}

export interface NewsContent extends ParsedContent {
  article: NewsArticle;
}

export interface PaginationConfig {
  maxPages?: number; // Default: 10
  pageParamPattern?: string; // e.g., "?page={page}", "/{page}", "?p={page}"
  infiniteScroll?: boolean;
  nextButtonSelector?: string;
  pageNumberSelector?: string;
  currentPageSelector?: string;
}

export interface DiscoveryConfig {
  maxDepth?: number; // Default: 3
  followCategories?: boolean;
  followSections?: boolean;
  allowedDomains?: string[]; // Restrict to specific domains
  excludePatterns?: string[]; // URL patterns to exclude
  includePatterns?: string[]; // URL patterns to include (overrides excludePatterns)
  minContentLength?: number; // Minimum article content length
}

export interface ArticleDiscoveryResult {
  urls: string[];
  nextPageUrl?: string;
  currentPage: number;
  totalPages?: number;
  hasMorePages: boolean;
}

export interface DiscoverySession {
  baseUrl: string;
  discoveredUrls: Set<string>;
  visitedPages: Set<string>;
  currentDepth: number;
  currentPage: number;
  categoryLinks: string[];
  sectionLinks: string[];
}

export interface NewsSourcePreset {
  name: string;
  domain: string;
  config: Omit<NewsSourceConfig, 'id' | 'name' | 'url'>;
}

// Korean news site presets
export const KOREAN_NEWS_PRESETS: Record<string, NewsSourcePreset> = {
  naver: {
    name: 'Naver News',
    domain: 'news.naver.com',
    config: {
      type: 'NEWS',
      selectors: {
        titleSelector: '#title_area span',
        bodySelector: '#dic_area',
        authorSelector: '.byline_s .name',
        dateSelector: '.byline .date_time',
        imageSelector: '#img1, .end_photo_org img',
        captionSelector: '.end_photo_org .txt',
        articleListSelector: '.list_news .bx, .cluster_body .item',
        paginationSelector: '.paging a',
        nextPageSelector: '.paging .btn_next',
        sectionSelector: '.snb .menu_list a, .nav .tab_menu a',
      },
      dateFormats: ['YYYY.MM.DD. HH:mm', 'YYYY.MM.DD.', 'MM.DD.'],
      timezone: 'Asia/Seoul',
      pagination: {
        maxPages: 10,
        pageParamPattern: '?page={page}',
        nextButtonSelector: '.paging .btn_next:not(.disabled)',
        currentPageSelector: '.paging .num.on',
      },
      discovery: {
        maxDepth: 3,
        followCategories: true,
        followSections: true,
        allowedDomains: ['news.naver.com'],
        excludePatterns: ['/sports/', '/entertainment/', '/opinion/'],
        minContentLength: 100,
      },
      config: {
        respectRobotsTxt: true,
        userAgent: 'Mozilla/5.0 (compatible; NewsBot/1.0)',
      },
    },
  },
  daum: {
    name: 'Daum News',
    domain: 'news.daum.net',
    config: {
      type: 'NEWS',
      selectors: {
        titleSelector: '.tit_view',
        bodySelector: '.article_view, .news_body',
        authorSelector: '.info_view .txt_info:first-child',
        dateSelector: '.info_view .txt_info:last-child',
        imageSelector: '.article_view img, .figure_view img',
        captionSelector: '.desc_img',
        articleListSelector: '.list_news2 .item_news, .list_thumb .item_thumb',
        paginationSelector: '.paging_news a',
        nextPageSelector: '.paging_news .link_next',
        sectionSelector: '.tab_news .tab_item a',
      },
      dateFormats: ['YYYY.MM.DD. HH:mm', 'YYYY-MM-DD HH:mm:ss'],
      timezone: 'Asia/Seoul',
      pagination: {
        maxPages: 10,
        pageParamPattern: '?page={page}',
        nextButtonSelector: '.paging_news .link_next:not(.disabled)',
        currentPageSelector: '.paging_news .num_page.on',
      },
      discovery: {
        maxDepth: 3,
        followCategories: true,
        followSections: true,
        allowedDomains: ['news.daum.net'],
        excludePatterns: ['/sports/', '/entertainment/'],
        minContentLength: 100,
      },
      config: {
        respectRobotsTxt: true,
        userAgent: 'Mozilla/5.0 (compatible; NewsBot/1.0)',
      },
    },
  },
};

export const DEFAULT_NEWS_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
];

export interface DateParserConfig {
  formats: string[];
  timezone: string;
  locale: string;
}

export const KOREAN_DATE_PARSER_CONFIG: DateParserConfig = {
  formats: [
    'YYYY.MM.DD. HH:mm',
    'YYYY.MM.DD.',
    'YYYY-MM-DD HH:mm:ss',
    'YYYY/MM/DD HH:mm',
    'YYYY/MM/DD',
    'MM.DD. HH:mm',
    'MM월 DD일',
    'YYYY년 MM월 DD일',
    'YYYY년 MM월 DD일 HH시 mm분',
    'YYYY년 MM월 DD일 오전 HH:mm',
    'YYYY년 MM월 DD일 오후 HH:mm',
    'MM월 DD일 오전 HH:mm',
    'MM월 DD일 오후 HH:mm',
  ],
  timezone: 'Asia/Seoul',
  locale: 'ko-KR',
};
