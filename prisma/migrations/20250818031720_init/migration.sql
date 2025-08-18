-- CreateTable
CREATE TABLE `sources` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `url` VARCHAR(255) NOT NULL,
    `type` ENUM('NEWS', 'BLOG', 'SOCIAL', 'COMMUNITY') NOT NULL,
    `config` JSON NOT NULL,
    `status` ENUM('ACTIVE', 'PAUSED', 'ERROR', 'MAINTENANCE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `sources_status_idx`(`status`),
    INDEX `sources_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contents` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `body` TEXT NOT NULL,
    `author` VARCHAR(100) NULL,
    `publishedAt` DATETIME(3) NOT NULL,
    `rawHtml` LONGTEXT NOT NULL,
    `contentHash` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `contents_url_key`(`url`),
    INDEX `contents_sourceId_publishedAt_idx`(`sourceId`, `publishedAt`),
    INDEX `contents_contentHash_idx`(`contentHash`),
    INDEX `contents_publishedAt_idx`(`publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analyses` (
    `id` VARCHAR(191) NOT NULL,
    `contentId` VARCHAR(191) NOT NULL,
    `type` ENUM('SENTIMENT', 'KEYWORD', 'SUMMARY', 'POLITICAL', 'ENTITY') NOT NULL,
    `result` JSON NOT NULL,
    `score` FLOAT NULL,
    `analyzedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `analyses_contentId_type_idx`(`contentId`, `type`),
    INDEX `analyses_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'USER', 'VIEWER') NOT NULL DEFAULT 'USER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NULL,
    `type` ENUM('CRAWL', 'ANALYSIS', 'CLEANUP', 'EXPORT') NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `payload` JSON NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `jobs_status_type_idx`(`status`, `type`),
    INDEX `jobs_sourceId_createdAt_idx`(`sourceId`, `createdAt`),
    INDEX `jobs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `contents` ADD CONSTRAINT `contents_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `sources`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `analyses` ADD CONSTRAINT `analyses_contentId_fkey` FOREIGN KEY (`contentId`) REFERENCES `contents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
