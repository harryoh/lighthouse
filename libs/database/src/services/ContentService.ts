import { Content, ContentVersion, Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import {
  ContentInput,
  ContentFilters,
  ContentUpdateInput,
  ContentUpdateInputWithVersion,
  ContentWithRelations,
  PaginationOptions,
  SearchOptions,
  PaginatedResponse,
  ServiceResponse,
  HashOptions,
  SoftDeleteOptions,
  RestoreOptions,
  VersioningOptions,
  VersionDiff,
  CleanupOptions,
} from '../types/content.types';
import { prisma as defaultPrisma } from '../prisma';

export class ContentService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || defaultPrisma;
  }

  /**
   * Save new content with deduplication check
   */
  async saveContent(data: ContentInput): Promise<ServiceResponse<Content>> {
    try {
      // Validate input
      this.validateContentInput(data);

      // Generate content hash for deduplication
      const contentHash = this.generateContentHash(data);

      // Check for existing content with same hash
      const existingContent = await this.prisma.content.findFirst({
        where: { contentHash },
      });

      if (existingContent) {
        return {
          success: false,
          error: `Content already exists with ID: ${existingContent.id}`,
          data: existingContent,
        };
      }

      // Create new content in transaction
      const content = await this.prisma.$transaction(async (tx) => {
        return await tx.content.create({
          data: {
            ...data,
            contentHash,
          },
        });
      });

      return {
        success: true,
        data: content,
      };
    } catch (error) {
      console.error('Error saving content:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to save content',
      };
    }
  }

  /**
   * Get content by ID or filters
   */
  async getContent(
    id?: string,
    filters?: ContentFilters,
    options?: PaginationOptions
  ): Promise<
    ServiceResponse<
      Content | ContentWithRelations[] | PaginatedResponse<ContentWithRelations>
    >
  > {
    try {
      // Get single content by ID
      if (id) {
        const content = await this.prisma.content.findUnique({
          where: { id },
          include: {
            source: true,
            analyses: true,
          },
        });

        if (!content) {
          return {
            success: false,
            error: `Content not found with ID: ${id}`,
          };
        }

        return {
          success: true,
          data: content,
        };
      }

      // Get multiple content with filters
      const whereClause = this.buildWhereClause(filters);
      const orderBy = this.buildOrderBy(options);

      // Handle pagination
      if (options?.page && options?.limit) {
        const page = Math.max(1, options.page);
        const limit = Math.min(100, Math.max(1, options.limit));
        const skip = (page - 1) * limit;

        const [data, total] = await this.prisma.$transaction([
          this.prisma.content.findMany({
            where: whereClause,
            orderBy,
            skip,
            take: limit,
            include: {
              source: true,
              analyses: true,
            },
          }),
          this.prisma.content.count({ where: whereClause }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
          success: true,
          data: {
            data,
            pagination: {
              page,
              limit,
              total,
              totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1,
            },
          },
        };
      }

      // Get all matching content without pagination
      const data = await this.prisma.content.findMany({
        where: whereClause,
        orderBy,
        include: {
          source: true,
          analyses: true,
        },
      });

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error getting content:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get content',
      };
    }
  }

  /**
   * Search content with full-text search
   */
  async searchContent(
    searchOptions: SearchOptions
  ): Promise<ServiceResponse<PaginatedResponse<ContentWithRelations>>> {
    try {
      const {
        query,
        searchIn = ['title', 'body'],
        ...paginationOptions
      } = searchOptions;

      // Build search conditions
      const searchConditions: Prisma.ContentWhereInput[] = [];

      if (searchIn.includes('title')) {
        searchConditions.push({ title: { contains: query } });
      }
      if (searchIn.includes('body')) {
        searchConditions.push({ body: { contains: query } });
      }
      if (searchIn.includes('author')) {
        searchConditions.push({ author: { contains: query } });
      }

      const whereClause: Prisma.ContentWhereInput = {
        OR: searchConditions,
      };

      const orderBy = this.buildOrderBy(paginationOptions);
      const page = Math.max(1, paginationOptions.page || 1);
      const limit = Math.min(100, Math.max(1, paginationOptions.limit || 10));
      const skip = (page - 1) * limit;

      const [data, total] = await this.prisma.$transaction([
        this.prisma.content.findMany({
          where: whereClause,
          orderBy,
          skip,
          take: limit,
          include: {
            source: true,
            analyses: true,
          },
        }),
        this.prisma.content.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: {
          data,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
      };
    } catch (error) {
      console.error('Error searching content:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to search content',
      };
    }
  }

  /**
   * Update existing content with versioning
   */
  async updateContent(
    id: string,
    data: ContentUpdateInput | ContentUpdateInputWithVersion
  ): Promise<ServiceResponse<Content>> {
    try {
      // Check if content exists
      const existingContent = await this.prisma.content.findUnique({
        where: { id },
      });

      if (!existingContent) {
        return {
          success: false,
          error: `Content not found with ID: ${id}`,
        };
      }

      // Check if content is soft-deleted
      if (existingContent.deletedAt) {
        return {
          success: false,
          error: `Cannot update deleted content. Please restore it first.`,
        };
      }

      // Extract versioning options if provided
      const versioningOptions = (data as ContentUpdateInputWithVersion)
        .versioningOptions;
      const updateData = { ...data };
      if ('versioningOptions' in updateData) {
        delete (updateData as Record<string, unknown>)['versioningOptions'];
      }

      // Perform update with version creation in transaction
      const updatedContent = await this.prisma.$transaction(async (tx) => {
        // Create version record if versioning is enabled (default: true)
        if (versioningOptions?.createVersion !== false) {
          await tx.contentVersion.create({
            data: {
              contentId: existingContent.id,
              version: existingContent.version,
              title: existingContent.title,
              body: existingContent.body,
              author: existingContent.author,
              publishedAt: existingContent.publishedAt,
              rawHtml: existingContent.rawHtml,
              contentHash: existingContent.contentHash,
              changedBy: versioningOptions?.changedBy || null,
              changeReason: versioningOptions?.changeReason || null,
            },
          });
        }

        // Update content with incremented version
        return await tx.content.update({
          where: { id },
          data: {
            ...updateData,
            version: existingContent.version + 1,
            // Regenerate hash if content changed
            contentHash: this.shouldRegenerateHash(updateData)
              ? this.generateContentHash({
                  ...existingContent,
                  ...updateData,
                } as ContentInput)
              : undefined,
          },
        });
      });

      return {
        success: true,
        data: updatedContent,
      };
    } catch (error) {
      console.error('Error updating content:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update content',
      };
    }
  }

  /**
   * Delete content (hard delete)
   */
  async deleteContent(id: string): Promise<ServiceResponse<boolean>> {
    try {
      // Check if content exists
      const existingContent = await this.prisma.content.findUnique({
        where: { id },
      });

      if (!existingContent) {
        return {
          success: false,
          error: `Content not found with ID: ${id}`,
        };
      }

      // Delete content and related analyses (cascade delete)
      await this.prisma.content.delete({
        where: { id },
      });

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error deleting content:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete content',
      };
    }
  }

  /**
   * Check if content exists by URL
   */
  async contentExistsByUrl(url: string): Promise<boolean> {
    const count = await this.prisma.content.count({
      where: { url },
    });
    return count > 0;
  }

  /**
   * Get content statistics
   */
  async getContentStats() {
    const [total, bySource, byDate] = await this.prisma.$transaction([
      this.prisma.content.count({
        where: { deletedAt: null }, // Exclude soft-deleted items
      }),
      this.prisma.content.groupBy({
        by: ['sourceId'],
        where: { deletedAt: null },
        _count: {
          _all: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      }),
      this.prisma.$queryRaw`
        SELECT 
          DATE(publishedAt) as date,
          COUNT(*) as count
        FROM contents
        WHERE publishedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          AND deletedAt IS NULL
        GROUP BY DATE(publishedAt)
        ORDER BY date DESC
      `,
    ]);

    return {
      total,
      bySource,
      byDate,
    };
  }

  /**
   * Soft delete content
   */
  async softDelete(
    id: string,
    options?: SoftDeleteOptions
  ): Promise<ServiceResponse<Content>> {
    try {
      // Check if content exists and is not already deleted
      const existingContent = await this.prisma.content.findUnique({
        where: { id },
      });

      if (!existingContent) {
        return {
          success: false,
          error: `Content not found with ID: ${id}`,
        };
      }

      if (existingContent.deletedAt) {
        return {
          success: false,
          error: `Content is already deleted`,
        };
      }

      // If permanent delete is requested, perform hard delete
      if (options?.permanent) {
        await this.prisma.content.delete({
          where: { id },
        });
        return {
          success: true,
          data: existingContent, // Return the content before deletion
        };
      }

      // Perform soft delete
      const deletedContent = await this.prisma.content.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedBy: options?.deletedBy || null,
        },
      });

      return {
        success: true,
        data: deletedContent,
      };
    } catch (error) {
      console.error('Error soft deleting content:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to soft delete content',
      };
    }
  }

  /**
   * Restore soft-deleted content
   */
  async restore(
    id: string,
    _options?: RestoreOptions // Prefixed with _ to indicate unused parameter
  ): Promise<ServiceResponse<Content>> {
    try {
      // Check if content exists and is deleted
      const existingContent = await this.prisma.content.findUnique({
        where: { id },
      });

      if (!existingContent) {
        return {
          success: false,
          error: `Content not found with ID: ${id}`,
        };
      }

      if (!existingContent.deletedAt) {
        return {
          success: false,
          error: `Content is not deleted`,
        };
      }

      // Restore the content
      // Note: _options?.restoredBy could be used for audit logging if needed
      const restoredContent = await this.prisma.content.update({
        where: { id },
        data: {
          deletedAt: null,
          deletedBy: null,
        },
      });

      return {
        success: true,
        data: restoredContent,
      };
    } catch (error) {
      console.error('Error restoring content:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to restore content',
      };
    }
  }

  /**
   * Permanently delete content (hard delete after retention period)
   */
  async permanentlyDelete(id: string): Promise<ServiceResponse<boolean>> {
    try {
      // This is the original hard delete
      return await this.deleteContent(id);
    } catch (error) {
      console.error('Error permanently deleting content:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to permanently delete content',
      };
    }
  }

  /**
   * Clean up soft-deleted content older than retention period
   */
  async cleanupDeletedContent(
    options: CleanupOptions = {}
  ): Promise<ServiceResponse<number>> {
    const { retentionDays = 30, batchSize = 100 } = options;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Find content to delete
      const contentToDelete = await this.prisma.content.findMany({
        where: {
          deletedAt: {
            not: null,
            lt: cutoffDate,
          },
        },
        select: { id: true },
        take: batchSize,
      });

      if (contentToDelete.length === 0) {
        return {
          success: true,
          data: 0,
        };
      }

      // Delete in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Delete related versions first
        await tx.contentVersion.deleteMany({
          where: {
            contentId: {
              in: contentToDelete.map((c) => c.id),
            },
          },
        });

        // Delete content
        const deleted = await tx.content.deleteMany({
          where: {
            id: {
              in: contentToDelete.map((c) => c.id),
            },
          },
        });

        return deleted.count;
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Error cleaning up deleted content:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to cleanup deleted content',
      };
    }
  }

  /**
   * Get content version history
   */
  async getContentHistory(
    contentId: string
  ): Promise<ServiceResponse<ContentVersion[]>> {
    try {
      // Check if content exists
      const content = await this.prisma.content.findUnique({
        where: { id: contentId },
      });

      if (!content) {
        return {
          success: false,
          error: `Content not found with ID: ${contentId}`,
        };
      }

      // Get all versions
      const versions = await this.prisma.contentVersion.findMany({
        where: { contentId },
        orderBy: { version: 'desc' },
      });

      return {
        success: true,
        data: versions,
      };
    } catch (error) {
      console.error('Error getting content history:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get content history',
      };
    }
  }

  /**
   * Get specific content version
   */
  async getContentVersion(
    contentId: string,
    version: number
  ): Promise<ServiceResponse<ContentVersion>> {
    try {
      const contentVersion = await this.prisma.contentVersion.findUnique({
        where: {
          contentId_version: {
            contentId,
            version,
          },
        },
      });

      if (!contentVersion) {
        return {
          success: false,
          error: `Version ${version} not found for content ID: ${contentId}`,
        };
      }

      return {
        success: true,
        data: contentVersion,
      };
    } catch (error) {
      console.error('Error getting content version:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get content version',
      };
    }
  }

  /**
   * Restore content to a specific version
   */
  async restoreVersion(
    contentId: string,
    version: number,
    options?: VersioningOptions
  ): Promise<ServiceResponse<Content>> {
    try {
      // Get the version to restore
      const versionToRestore = await this.prisma.contentVersion.findUnique({
        where: {
          contentId_version: {
            contentId,
            version,
          },
        },
      });

      if (!versionToRestore) {
        return {
          success: false,
          error: `Version ${version} not found for content ID: ${contentId}`,
        };
      }

      // Get current content
      const currentContent = await this.prisma.content.findUnique({
        where: { id: contentId },
      });

      if (!currentContent) {
        return {
          success: false,
          error: `Content not found with ID: ${contentId}`,
        };
      }

      // Restore in transaction
      const restoredContent = await this.prisma.$transaction(async (tx) => {
        // Save current version before restoring
        if (options?.createVersion !== false) {
          await tx.contentVersion.create({
            data: {
              contentId: currentContent.id,
              version: currentContent.version,
              title: currentContent.title,
              body: currentContent.body,
              author: currentContent.author,
              publishedAt: currentContent.publishedAt,
              rawHtml: currentContent.rawHtml,
              contentHash: currentContent.contentHash,
              changedBy: options?.changedBy || null,
              changeReason:
                options?.changeReason || `Restored to version ${version}`,
            },
          });
        }

        // Restore content
        return await tx.content.update({
          where: { id: contentId },
          data: {
            title: versionToRestore.title,
            body: versionToRestore.body,
            author: versionToRestore.author,
            publishedAt: versionToRestore.publishedAt,
            rawHtml: versionToRestore.rawHtml,
            contentHash: versionToRestore.contentHash,
            version: currentContent.version + 1,
          },
        });
      });

      return {
        success: true,
        data: restoredContent,
      };
    } catch (error) {
      console.error('Error restoring version:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to restore version',
      };
    }
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    contentId: string,
    version1: number,
    version2: number
  ): Promise<ServiceResponse<VersionDiff>> {
    try {
      // Get both versions
      const [v1, v2] = await Promise.all([
        this.getContentVersion(contentId, version1),
        this.getContentVersion(contentId, version2),
      ]);

      if (!v1.success || !v1.data) {
        return {
          success: false,
          error: `Version ${version1} not found`,
        };
      }

      if (!v2.success || !v2.data) {
        return {
          success: false,
          error: `Version ${version2} not found`,
        };
      }

      const changes: VersionDiff['changes'] = [];

      // Compare fields
      const fieldsToCompare: (keyof ContentVersion)[] = [
        'title',
        'body',
        'author',
        'publishedAt',
      ];

      for (const field of fieldsToCompare) {
        if (v1.data[field] !== v2.data[field]) {
          changes.push({
            field,
            oldValue: v1.data[field],
            newValue: v2.data[field],
          });
        }
      }

      return {
        success: true,
        data: {
          version1,
          version2,
          changes,
        },
      };
    } catch (error) {
      console.error('Error comparing versions:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to compare versions',
      };
    }
  }

  // Private helper methods

  private validateContentInput(data: ContentInput): void {
    const requiredFields: (keyof ContentInput)[] = [
      'sourceId',
      'url',
      'title',
      'body',
      'publishedAt',
      'rawHtml',
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate URL format
    try {
      new URL(data.url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Validate publishedAt is a valid date
    if (
      !(data.publishedAt instanceof Date) ||
      isNaN(data.publishedAt.getTime())
    ) {
      throw new Error('Invalid publishedAt date');
    }
  }

  private generateContentHash(
    data: ContentInput,
    options: HashOptions = {
      includeUrl: true,
      includeTitle: true,
      includeBody: true,
    }
  ): string {
    const parts: string[] = [];

    if (options.includeUrl) parts.push(data.url);
    if (options.includeTitle) parts.push(data.title);
    if (options.includeBody) parts.push(data.body);
    if (options.includeAuthor && data.author) parts.push(data.author);

    const hashInput = parts.join('|');
    return createHash('sha256').update(hashInput).digest('hex');
  }

  private shouldRegenerateHash(data: ContentUpdateInput): boolean {
    return !!(data.title || data.body || data.author !== undefined);
  }

  private buildWhereClause(filters?: ContentFilters): Prisma.ContentWhereInput {
    const where: Prisma.ContentWhereInput = {};

    // Handle soft delete filtering
    if (filters?.onlyDeleted) {
      // Only show deleted items
      where.deletedAt = { not: null };
    } else if (!filters?.includeDeleted) {
      // By default, exclude deleted items
      where.deletedAt = null;
    }
    // If includeDeleted is true, don't add any deletedAt filter

    if (filters) {
      if (filters.sourceId) where.sourceId = filters.sourceId;
      if (filters.url) where.url = filters.url;
      if (filters.author) where.author = filters.author;
      if (filters.contentHash) where.contentHash = filters.contentHash;

      // Date range filters
      if (filters.publishedAtFrom || filters.publishedAtTo) {
        where.publishedAt = {};
        if (filters.publishedAtFrom) {
          where.publishedAt.gte = filters.publishedAtFrom;
        }
        if (filters.publishedAtTo) {
          where.publishedAt.lte = filters.publishedAtTo;
        }
      }
    }

    return where;
  }

  private buildOrderBy(
    options?: PaginationOptions
  ): Prisma.ContentOrderByWithRelationInput {
    const { sortBy = 'publishedAt', sortOrder = 'desc' } = options || {};
    return {
      [sortBy]: sortOrder,
    };
  }
}

// Export singleton instance
export const contentService = new ContentService();
