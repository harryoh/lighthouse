import { Content, Source, Analysis } from '@prisma/client';

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
