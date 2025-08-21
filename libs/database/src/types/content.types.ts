import {
  Content,
  Source,
  Analysis,
  ContentVersion as PrismaContentVersion,
} from '@prisma/client';

// Input type for creating content
export interface ContentInput {
  sourceId: string;
  url: string;
  title: string;
  body: string;
  author?: string | null;
  publishedAt: Date;
  rawHtml: string;
}

// Filter options for retrieving content
export interface ContentFilters {
  sourceId?: string;
  url?: string;
  author?: string;
  publishedAtFrom?: Date;
  publishedAtTo?: Date;
  contentHash?: string;
  includeDeleted?: boolean; // Include soft-deleted items
  onlyDeleted?: boolean; // Only show deleted items
}

// Pagination options
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'publishedAt' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// Search options for full-text search
export interface SearchOptions extends PaginationOptions {
  query: string;
  searchIn?: ('title' | 'body' | 'author')[];
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Content with relations
export interface ContentWithRelations extends Content {
  source?: Source;
  analyses?: Analysis[];
}

// Update input type
export type ContentUpdateInput = Partial<
  Omit<ContentInput, 'sourceId' | 'url'>
>;

// Service response types
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Content hash options
export interface HashOptions {
  includeUrl?: boolean;
  includeTitle?: boolean;
  includeBody?: boolean;
  includeAuthor?: boolean;
}

// Content version type (extends Prisma model)
export type ContentVersion = PrismaContentVersion;

// Soft delete options
export interface SoftDeleteOptions {
  deletedBy?: string; // User who is deleting
  permanent?: boolean; // If true, perform hard delete instead
}

// Restore options
export interface RestoreOptions {
  restoredBy?: string; // User who is restoring
}

// Versioning options for updates
export interface VersioningOptions {
  changedBy?: string; // User making the change
  changeReason?: string; // Reason for the change
  createVersion?: boolean; // If false, skip version creation
}

// Extended update input with versioning
export interface ContentUpdateInputWithVersion extends ContentUpdateInput {
  versioningOptions?: VersioningOptions;
}

// Version comparison result
export interface VersionDiff {
  version1: number;
  version2: number;
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
}

// Cleanup options for deleted content
export interface CleanupOptions {
  retentionDays?: number; // How many days to keep deleted content (default: 30)
  batchSize?: number; // How many to delete at once (default: 100)
}
