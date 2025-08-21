import { ContentService } from './ContentService';
import { PrismaClient } from '@prisma/client';
import { ContentInput } from '../types/content.types';

// Type for transaction mock
type TransactionCallback = (tx: {
  content: {
    create?: jest.Mock;
    update?: jest.Mock;
    findUnique?: jest.Mock;
  };
  contentVersion?: {
    create?: jest.Mock;
  };
}) => Promise<unknown>;

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    content: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    contentVersion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
    Prisma: {
      ContentWhereInput: {},
      ContentOrderByWithRelationInput: {},
    },
  };
});

describe('ContentService', () => {
  let contentService: ContentService;
  // Using any for mock object since it's a test file
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    contentService = new ContentService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('saveContent', () => {
    const validContentInput: ContentInput = {
      sourceId: 'source-123',
      url: 'https://example.com/article',
      title: 'Test Article',
      body: 'This is the article body',
      author: 'John Doe',
      publishedAt: new Date('2024-01-01'),
      rawHtml: '<html>...</html>',
    };

    it('should save new content successfully', async () => {
      const mockContent = {
        id: 'content-123',
        ...validContentInput,
        contentHash: 'hash123',
        createdAt: new Date(),
      };

      mockPrisma.content.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(
        async (callback: TransactionCallback) => {
          const tx = {
            content: {
              create: jest.fn().mockResolvedValue(mockContent),
            },
          };
          return callback(tx);
        }
      );

      const result = await contentService.saveContent(validContentInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockContent);
      expect(mockPrisma.content.findFirst).toHaveBeenCalled();
    });

    it('should reject duplicate content', async () => {
      const existingContent = {
        id: 'existing-123',
        ...validContentInput,
        contentHash: 'hash123',
      };

      mockPrisma.content.findFirst.mockResolvedValue(existingContent);

      const result = await contentService.saveContent(validContentInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content already exists');
      expect(result.data).toEqual(existingContent);
    });

    it('should validate required fields', async () => {
      const invalidInput = {
        ...validContentInput,
        url: '', // Invalid empty URL
      };

      const result = await contentService.saveContent(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required field');
    });

    it('should validate URL format', async () => {
      const invalidInput = {
        ...validContentInput,
        url: 'not-a-valid-url',
      };

      const result = await contentService.saveContent(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });
  });

  describe('getContent', () => {
    it('should get content by ID', async () => {
      const mockContent = {
        id: 'content-123',
        title: 'Test Article',
        source: { id: 'source-123', name: 'Test Source' },
        analyses: [],
      };

      mockPrisma.content.findUnique.mockResolvedValue(mockContent);

      const result = await contentService.getContent('content-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockContent);
      expect(mockPrisma.content.findUnique).toHaveBeenCalledWith({
        where: { id: 'content-123' },
        include: { source: true, analyses: true },
      });
    });

    it('should return error for non-existent content', async () => {
      mockPrisma.content.findUnique.mockResolvedValue(null);

      const result = await contentService.getContent('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content not found');
    });

    it('should get content with filters and pagination', async () => {
      const mockContents = [
        { id: 'content-1', title: 'Article 1' },
        { id: 'content-2', title: 'Article 2' },
      ];

      mockPrisma.$transaction.mockResolvedValue([mockContents, 10]);

      const result = await contentService.getContent(
        undefined,
        { sourceId: 'source-123' },
        { page: 1, limit: 2 }
      );

      expect(result.success).toBe(true);
      if (result.data && 'pagination' in result.data) {
        expect(result.data.data).toEqual(mockContents);
        expect(result.data.pagination.total).toBe(10);
        expect(result.data.pagination.page).toBe(1);
        expect(result.data.pagination.limit).toBe(2);
      }
    });
  });

  describe('searchContent', () => {
    it('should search content by query', async () => {
      const mockResults = [
        { id: 'content-1', title: 'Matching Article', body: 'Content body' },
      ];

      mockPrisma.$transaction.mockResolvedValue([mockResults, 1]);

      const result = await contentService.searchContent({
        query: 'Matching',
        searchIn: ['title'],
        page: 1,
        limit: 10,
      });

      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data.data).toEqual(mockResults);
        expect(result.data.pagination.total).toBe(1);
      }
    });

    it('should search in multiple fields', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await contentService.searchContent({
        query: 'test',
        searchIn: ['title', 'body', 'author'],
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('updateContent', () => {
    it('should update existing content', async () => {
      const existingContent = {
        id: 'content-123',
        title: 'Old Title',
        body: 'Old Body',
        version: 1,
        publishedAt: new Date(),
        rawHtml: '<p>Old Body</p>',
        contentHash: 'hash123',
        author: 'Test Author',
      };

      const updatedContent = {
        ...existingContent,
        title: 'New Title',
        version: 2,
      };

      // Mock transaction to execute the callback
      mockPrisma.$transaction.mockImplementation(
        async (callback: TransactionCallback) => {
          const tx = {
            contentVersion: { create: jest.fn().mockResolvedValue({}) },
            content: { update: jest.fn().mockResolvedValue(updatedContent) },
          };
          return callback(tx);
        }
      );

      mockPrisma.content.findUnique.mockResolvedValue(existingContent);

      const result = await contentService.updateContent('content-123', {
        title: 'New Title',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedContent);
    });

    it('should return error for non-existent content', async () => {
      mockPrisma.content.findUnique.mockResolvedValue(null);

      const result = await contentService.updateContent('non-existent', {
        title: 'New Title',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content not found');
    });
  });

  describe('deleteContent', () => {
    it('should delete existing content', async () => {
      mockPrisma.content.findUnique.mockResolvedValue({ id: 'content-123' });
      mockPrisma.content.delete.mockResolvedValue({ id: 'content-123' });

      const result = await contentService.deleteContent('content-123');

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockPrisma.content.delete).toHaveBeenCalledWith({
        where: { id: 'content-123' },
      });
    });

    it('should return error for non-existent content', async () => {
      mockPrisma.content.findUnique.mockResolvedValue(null);

      const result = await contentService.deleteContent('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content not found');
    });
  });

  describe('contentExistsByUrl', () => {
    it('should return true if content exists', async () => {
      mockPrisma.content.count.mockResolvedValue(1);

      const exists = await contentService.contentExistsByUrl(
        'https://example.com'
      );

      expect(exists).toBe(true);
      expect(mockPrisma.content.count).toHaveBeenCalledWith({
        where: { url: 'https://example.com' },
      });
    });

    it('should return false if content does not exist', async () => {
      mockPrisma.content.count.mockResolvedValue(0);

      const exists = await contentService.contentExistsByUrl(
        'https://example.com'
      );

      expect(exists).toBe(false);
    });
  });

  describe('getContentStats', () => {
    it('should return content statistics', async () => {
      const mockStats = {
        total: 100,
        bySource: [{ sourceId: 'source-1', _count: { _all: 10 } }],
        byDate: [{ date: '2024-01-01', count: 5 }],
      };

      mockPrisma.$transaction.mockResolvedValue([
        mockStats.total,
        mockStats.bySource,
        mockStats.byDate,
      ]);

      const stats = await contentService.getContentStats();

      expect(stats).toEqual(mockStats);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    const mockContent = {
      id: 'content-123',
      title: 'Test Article',
      deletedAt: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should soft delete content successfully', async () => {
      const deletedContent = {
        ...mockContent,
        deletedAt: new Date(),
        deletedBy: 'user-123',
      };

      mockPrisma.content.findUnique.mockResolvedValue(mockContent);
      mockPrisma.content.update.mockResolvedValue(deletedContent);

      const result = await contentService.softDelete('content-123', {
        deletedBy: 'user-123',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(deletedContent);
      expect(mockPrisma.content.update).toHaveBeenCalledWith({
        where: { id: 'content-123' },
        data: {
          deletedAt: expect.any(Date),
          deletedBy: 'user-123',
        },
      });
    });

    it('should return error for non-existent content', async () => {
      mockPrisma.content.findUnique.mockResolvedValue(null);

      const result = await contentService.softDelete('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content not found');
    });

    it('should return error for already deleted content', async () => {
      const alreadyDeleted = { ...mockContent, deletedAt: new Date() };
      mockPrisma.content.findUnique.mockResolvedValue(alreadyDeleted);

      const result = await contentService.softDelete('content-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already deleted');
    });
  });

  describe('restore', () => {
    const mockDeletedContent = {
      id: 'content-123',
      title: 'Test Article',
      deletedAt: new Date(),
      deletedBy: 'user-123',
      version: 1,
    };

    it('should restore content successfully', async () => {
      const restoredContent = {
        ...mockDeletedContent,
        deletedAt: null,
        deletedBy: null,
      };

      mockPrisma.content.findUnique.mockResolvedValue(mockDeletedContent);
      mockPrisma.content.update.mockResolvedValue(restoredContent);

      const result = await contentService.restore('content-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(restoredContent);
      expect(mockPrisma.content.update).toHaveBeenCalledWith({
        where: { id: 'content-123' },
        data: {
          deletedAt: null,
          deletedBy: null,
        },
      });
    });

    it('should return error for non-deleted content', async () => {
      const notDeletedContent = { ...mockDeletedContent, deletedAt: null };
      mockPrisma.content.findUnique.mockResolvedValue(notDeletedContent);

      const result = await contentService.restore('content-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not deleted');
    });
  });

  describe('updateContent with versioning', () => {
    const mockExistingContent = {
      id: 'content-123',
      title: 'Original Title',
      body: 'Original body',
      version: 1,
      contentHash: 'original-hash',
      author: 'Original Author',
      publishedAt: new Date('2024-01-01'),
      rawHtml: '<html>original</html>',
      deletedAt: null,
    };

    it('should update content and create version', async () => {
      const updateData = { title: 'Updated Title', body: 'Updated body' };
      const updatedContent = {
        ...mockExistingContent,
        ...updateData,
        version: 2,
      };

      mockPrisma.content.findUnique.mockResolvedValue(mockExistingContent);
      mockPrisma.$transaction.mockImplementation(
        async (callback: TransactionCallback) => {
          const tx = {
            contentVersion: {
              create: jest.fn(),
            },
            content: {
              update: jest.fn().mockResolvedValue(updatedContent),
            },
          };
          return callback(tx);
        }
      );

      const result = await contentService.updateContent('content-123', {
        ...updateData,
        versioningOptions: {
          changedBy: 'user-123',
          changeReason: 'Content update',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data?.version).toBe(2);
    });

    it('should not update deleted content', async () => {
      const deletedContent = { ...mockExistingContent, deletedAt: new Date() };
      mockPrisma.content.findUnique.mockResolvedValue(deletedContent);

      const result = await contentService.updateContent('content-123', {
        title: 'New Title',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot update deleted content');
    });
  });

  describe('getContentHistory', () => {
    it('should return version history', async () => {
      const mockVersions = [
        {
          id: 'version-1',
          contentId: 'content-123',
          version: 2,
          title: 'Updated Title',
          changedAt: new Date(),
        },
        {
          id: 'version-2',
          contentId: 'content-123',
          version: 1,
          title: 'Original Title',
          changedAt: new Date(),
        },
      ];

      mockPrisma.content.findUnique.mockResolvedValue({ id: 'content-123' });
      mockPrisma.contentVersion.findMany.mockResolvedValue(mockVersions);

      const result = await contentService.getContentHistory('content-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockVersions);
      expect(mockPrisma.contentVersion.findMany).toHaveBeenCalledWith({
        where: { contentId: 'content-123' },
        orderBy: { version: 'desc' },
      });
    });
  });

  describe('restoreVersion', () => {
    const mockCurrentContent = {
      id: 'content-123',
      title: 'Current Title',
      body: 'Current body',
      version: 3,
      author: 'Current Author',
      publishedAt: new Date('2024-01-03'),
      rawHtml: '<html>current</html>',
      contentHash: 'current-hash',
    };

    const mockVersionToRestore = {
      id: 'version-1',
      contentId: 'content-123',
      version: 1,
      title: 'Original Title',
      body: 'Original body',
      author: 'Original Author',
      publishedAt: new Date('2024-01-01'),
      rawHtml: '<html>original</html>',
      contentHash: 'original-hash',
      changedAt: new Date(),
    };

    it('should restore to specific version', async () => {
      const restoredContent = {
        ...mockCurrentContent,
        title: mockVersionToRestore.title,
        body: mockVersionToRestore.body,
        version: 4,
      };

      mockPrisma.contentVersion.findUnique.mockResolvedValue(
        mockVersionToRestore
      );
      mockPrisma.content.findUnique.mockResolvedValue(mockCurrentContent);
      mockPrisma.$transaction.mockImplementation(
        async (callback: TransactionCallback) => {
          const tx = {
            contentVersion: {
              create: jest.fn(),
            },
            content: {
              update: jest.fn().mockResolvedValue(restoredContent),
            },
          };
          return callback(tx);
        }
      );

      const result = await contentService.restoreVersion('content-123', 1, {
        changedBy: 'user-123',
      });

      expect(result.success).toBe(true);
      expect(result.data?.title).toBe('Original Title');
      expect(result.data?.version).toBe(4);
    });

    it('should return error for non-existent version', async () => {
      mockPrisma.contentVersion.findUnique.mockResolvedValue(null);

      const result = await contentService.restoreVersion('content-123', 999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Version 999 not found');
    });
  });
});
