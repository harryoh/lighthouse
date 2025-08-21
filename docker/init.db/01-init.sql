-- Create database if not exists
CREATE DATABASE IF NOT EXISTS lighthouse;
USE lighthouse;

-- Sources table
CREATE TABLE IF NOT EXISTS `sources` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `url` VARCHAR(255) NOT NULL,
  `type` ENUM('NEWS', 'BLOG', 'SOCIAL', 'COMMUNITY') NOT NULL,
  `config` JSON NOT NULL,
  `status` ENUM('ACTIVE', 'PAUSED', 'ERROR', 'MAINTENANCE') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `sources_url_key` (`url`),
  KEY `sources_status_idx` (`status`),
  KEY `sources_type_idx` (`type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Contents table with versioning and soft delete
CREATE TABLE IF NOT EXISTS `contents` (
  `id` VARCHAR(191) NOT NULL,
  `sourceId` VARCHAR(191) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `body` TEXT NOT NULL,
  `author` VARCHAR(100) NULL,
  `publishedAt` DATETIME(3) NOT NULL,
  `rawHtml` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(64) NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `deletedAt` DATETIME(3) NULL,
  `deletedBy` VARCHAR(100) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `contents_url_key` (`url`),
  KEY `contents_sourceId_publishedAt_idx` (`sourceId`, `publishedAt`),
  KEY `contents_contentHash_idx` (`contentHash`),
  KEY `contents_publishedAt_idx` (`publishedAt`),
  KEY `contents_deletedAt_idx` (`deletedAt`),
  CONSTRAINT `contents_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `sources` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Content Versions table for version history
CREATE TABLE IF NOT EXISTS `content_versions` (
  `id` VARCHAR(191) NOT NULL,
  `contentId` VARCHAR(191) NOT NULL,
  `version` INT NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `body` TEXT NOT NULL,
  `author` VARCHAR(100) NULL,
  `publishedAt` DATETIME(3) NOT NULL,
  `rawHtml` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(64) NOT NULL,
  `changedBy` VARCHAR(100) NULL,
  `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `changeReason` TEXT NULL,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `content_versions_contentId_version_key` (`contentId`, `version`),
  KEY `content_versions_contentId_version_idx` (`contentId`, `version`),
  KEY `content_versions_changedAt_idx` (`changedAt`),
  CONSTRAINT `content_versions_contentId_fkey` FOREIGN KEY (`contentId`) REFERENCES `contents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Analyses table
CREATE TABLE IF NOT EXISTS `analyses` (
  `id` VARCHAR(191) NOT NULL,
  `contentId` VARCHAR(191) NOT NULL,
  `type` ENUM('SENTIMENT', 'KEYWORD', 'SUMMARY', 'POLITICAL', 'ENTITY') NOT NULL,
  `result` JSON NOT NULL,
  `score` DOUBLE NULL,
  `analyzedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  
  PRIMARY KEY (`id`),
  KEY `analyses_contentId_type_idx` (`contentId`, `type`),
  KEY `analyses_type_idx` (`type`),
  CONSTRAINT `analyses_contentId_fkey` FOREIGN KEY (`contentId`) REFERENCES `contents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Users table
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `role` ENUM('ADMIN', 'USER', 'VIEWER') NOT NULL DEFAULT 'USER',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`),
  KEY `users_email_idx` (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Jobs table
CREATE TABLE IF NOT EXISTS `jobs` (
  `id` VARCHAR(191) NOT NULL,
  `sourceId` VARCHAR(191) NULL,
  `type` ENUM('CRAWL', 'ANALYSIS', 'CLEANUP', 'EXPORT') NOT NULL,
  `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `payload` JSON NULL,
  `error` TEXT NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  
  PRIMARY KEY (`id`),
  KEY `jobs_status_type_idx` (`status`, `type`),
  KEY `jobs_sourceId_createdAt_idx` (`sourceId`, `createdAt`),
  KEY `jobs_createdAt_idx` (`createdAt`),
  CONSTRAINT `jobs_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `sources` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Insert sample data for testing
INSERT INTO `sources` (`id`, `name`, `url`, `type`, `config`, `status`, `createdAt`, `updatedAt`) VALUES
  ('src-001', 'Naver News', 'https://news.naver.com', 'NEWS', '{"crawlDepth": 3, "maxPages": 100}', 'ACTIVE', NOW(), NOW()),
  ('src-002', 'Daum Blog', 'https://blog.daum.net', 'BLOG', '{"crawlDepth": 2, "maxPages": 50}', 'ACTIVE', NOW(), NOW()),
  ('src-003', 'Twitter Korea', 'https://twitter.com', 'SOCIAL', '{"hashtags": ["korea", "news"]}', 'PAUSED', NOW(), NOW())
ON DUPLICATE KEY UPDATE `updatedAt` = NOW();

-- Insert sample contents
INSERT INTO `contents` (`id`, `sourceId`, `url`, `title`, `body`, `author`, `publishedAt`, `rawHtml`, `contentHash`, `createdAt`) VALUES
  ('cnt-001', 'src-001', 'https://news.naver.com/article/001', '한국 경제 성장률 전망 상향', '한국의 경제 성장률이 예상보다 높을 것으로 전망됩니다. 수출 증가와 내수 회복이 주요 요인입니다.', '김기자', '2024-01-15 09:00:00', '<html>...</html>', SHA2('content1', 256), NOW()),
  ('cnt-002', 'src-001', 'https://news.naver.com/article/002', 'K-팝 글로벌 인기 지속', 'K-팝의 글로벌 인기가 계속되고 있습니다. BTS와 블랙핑크를 비롯한 많은 그룹들이 세계 무대에서 활약하고 있습니다.', '이기자', '2024-01-15 10:00:00', '<html>...</html>', SHA2('content2', 256), NOW()),
  ('cnt-003', 'src-002', 'https://blog.daum.net/post/001', '맛집 탐방: 서울 강남 베스트 10', '서울 강남 지역의 숨은 맛집들을 소개합니다. 현지인들이 추천하는 진짜 맛집 리스트.', '푸드블로거', '2024-01-14 18:00:00', '<html>...</html>', SHA2('content3', 256), NOW())
ON DUPLICATE KEY UPDATE `createdAt` = NOW();

-- Insert sample jobs
INSERT INTO `jobs` (`id`, `sourceId`, `type`, `status`, `payload`, `startedAt`, `completedAt`, `createdAt`) VALUES
  ('job-001', 'src-001', 'CRAWL', 'COMPLETED', '{"pages": 50, "items": 234}', '2024-01-15 08:00:00', '2024-01-15 08:30:00', NOW()),
  ('job-002', 'src-001', 'CRAWL', 'RUNNING', '{"pages": 20, "items": 95}', '2024-01-15 14:00:00', NULL, NOW()),
  ('job-003', 'src-002', 'CRAWL', 'PENDING', '{"scheduled": true}', NULL, NULL, NOW()),
  ('job-004', 'src-001', 'ANALYSIS', 'COMPLETED', '{"type": "SENTIMENT", "count": 100}', '2024-01-15 09:00:00', '2024-01-15 09:15:00', NOW())
ON DUPLICATE KEY UPDATE `createdAt` = NOW();

-- Insert sample analyses
INSERT INTO `analyses` (`id`, `contentId`, `type`, `result`, `score`, `analyzedAt`) VALUES
  ('ana-001', 'cnt-001', 'SENTIMENT', '{"positive": 0.8, "negative": 0.1, "neutral": 0.1}', 0.8, NOW()),
  ('ana-002', 'cnt-001', 'KEYWORD', '{"keywords": ["경제", "성장률", "수출", "내수"]}', NULL, NOW()),
  ('ana-003', 'cnt-002', 'SENTIMENT', '{"positive": 0.9, "negative": 0.05, "neutral": 0.05}', 0.9, NOW())
ON DUPLICATE KEY UPDATE `analyzedAt` = NOW();

-- Insert sample user (password: 'admin123' - you should hash this properly in production)
INSERT INTO `users` (`id`, `email`, `passwordHash`, `role`, `createdAt`, `updatedAt`) VALUES
  ('usr-001', 'admin@lighthouse.com', '$2b$10$YourHashedPasswordHere', 'ADMIN', NOW(), NOW())
ON DUPLICATE KEY UPDATE `updatedAt` = NOW();