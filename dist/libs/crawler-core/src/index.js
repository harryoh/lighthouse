"use strict";
/**
 * Crawler Core Library
 * Main entry point for the crawler functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueManager = exports.NewsCrawler = exports.CrawlerFactory = exports.BaseCrawler = void 0;
const tslib_1 = require("tslib");
// Export types
tslib_1.__exportStar(require("./types/crawler.types"), exports);
tslib_1.__exportStar(require("./types/news.types"), exports);
// Export crawlers
var BaseCrawler_1 = require("./crawlers/BaseCrawler");
Object.defineProperty(exports, "BaseCrawler", { enumerable: true, get: function () { return BaseCrawler_1.BaseCrawler; } });
var CrawlerFactory_1 = require("./crawlers/CrawlerFactory");
Object.defineProperty(exports, "CrawlerFactory", { enumerable: true, get: function () { return CrawlerFactory_1.CrawlerFactory; } });
var NewsCrawler_1 = require("./crawlers/NewsCrawler");
Object.defineProperty(exports, "NewsCrawler", { enumerable: true, get: function () { return NewsCrawler_1.NewsCrawler; } });
// Export queue interfaces and implementation
tslib_1.__exportStar(require("./queue/QueueInterface"), exports);
var QueueManager_1 = require("./queue/QueueManager");
Object.defineProperty(exports, "QueueManager", { enumerable: true, get: function () { return QueueManager_1.QueueManager; } });
//# sourceMappingURL=index.js.map