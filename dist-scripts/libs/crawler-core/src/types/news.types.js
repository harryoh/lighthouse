'use strict';
/**
 * News-specific type definitions
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.KOREAN_DATE_PARSER_CONFIG =
  exports.DEFAULT_NEWS_USER_AGENTS =
  exports.KOREAN_NEWS_PRESETS =
    void 0;
// Korean news site presets
exports.KOREAN_NEWS_PRESETS = {
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
        articleListSelector: '.sa_item, .ss_item, .ct_wrap',
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
exports.DEFAULT_NEWS_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
];
exports.KOREAN_DATE_PARSER_CONFIG = {
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
