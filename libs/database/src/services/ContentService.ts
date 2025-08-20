import { Content, Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import {
  ContentInput,
  ContentFilters,
  ContentUpdateInput,
  ContentWithRelations,
  PaginationOptions,
  SearchOptions,
  PaginatedResponse,
  ServiceResponse,
  HashOptions,
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
   * Update existing content
   */
  async updateContent(
    id: string,
    data: ContentUpdateInput
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

      // Update content
      const updatedContent = await this.prisma.content.update({
        where: { id },
        data: {
          ...data,
          // Regenerate hash if content changed
          contentHash: this.shouldRegenerateHash(data)
            ? this.generateContentHash({
                ...existingContent,
                ...data,
              } as ContentInput)
            : undefined,
        },
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
      this.prisma.content.count(),
      this.prisma.content.groupBy({
        by: ['sourceId'],
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
    if (!filters) return {};

    const where: Prisma.ContentWhereInput = {};

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
