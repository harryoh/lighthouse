import { Request, Response, NextFunction } from 'express';
import {
  contentService,
  ContentInput,
  ContentFilters,
  PaginationOptions,
  SearchOptions,
} from '@lighthouse/database';

export class ContentController {
  /**
   * Create new content
   * POST /api/contents
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contentInput: ContentInput = {
        sourceId: req.body.sourceId,
        url: req.body.url,
        title: req.body.title,
        body: req.body.body,
        author: req.body.author || null,
        publishedAt: new Date(req.body.publishedAt),
        rawHtml: req.body.rawHtml,
      };

      const result = await contentService.saveContent(contentInput);

      if (result.success) {
        res.status(201).json({
          success: true,
          data: result.data,
        });
      } else {
        res.status(result.data ? 409 : 400).json({
          success: false,
          error: result.error,
          data: result.data,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get content by ID
   * GET /api/contents/:id
   */
  async getById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await contentService.getContent(id);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all contents with filters and pagination
   * GET /api/contents
   */
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters: ContentFilters = {
        sourceId: req.query.sourceId as string,
        url: req.query.url as string,
        author: req.query.author as string,
        contentHash: req.query.contentHash as string,
      };

      // Parse date filters
      if (req.query.publishedAtFrom) {
        filters.publishedAtFrom = new Date(req.query.publishedAtFrom as string);
      }
      if (req.query.publishedAtTo) {
        filters.publishedAtTo = new Date(req.query.publishedAtTo as string);
      }

      // Remove undefined values
      Object.keys(filters).forEach((key) => {
        if (filters[key as keyof ContentFilters] === undefined) {
          delete filters[key as keyof ContentFilters];
        }
      });

      const paginationOptions: PaginationOptions = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        sortBy: req.query.sortBy as 'publishedAt' | 'createdAt' | 'title',
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const result = await contentService.getContent(
        undefined,
        Object.keys(filters).length > 0 ? filters : undefined,
        paginationOptions
      );

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search contents
   * GET /api/contents/search
   */
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, searchIn, page, limit, sortBy, sortOrder } = req.query;

      if (!query) {
        res.status(400).json({
          success: false,
          error: 'Search query is required',
        });
        return;
      }

      const searchOptions: SearchOptions = {
        query: query as string,
        searchIn: searchIn
          ? ((searchIn as string).split(',') as ('title' | 'body' | 'author')[])
          : ['title', 'body'],
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
        sortBy: sortBy as 'publishedAt' | 'createdAt' | 'title',
        sortOrder: sortOrder as 'asc' | 'desc',
      };

      const result = await contentService.searchContent(searchOptions);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update content
   * PUT /api/contents/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = {
        title: req.body.title,
        body: req.body.body,
        author: req.body.author,
        publishedAt: req.body.publishedAt
          ? new Date(req.body.publishedAt)
          : undefined,
        rawHtml: req.body.rawHtml,
      };

      // Remove undefined values
      Object.keys(updateData).forEach((key) => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      const result = await contentService.updateContent(id!, updateData);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
        });
      } else {
        res.status(result.error?.includes('not found') ? 404 : 400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete content
   * DELETE /api/contents/:id
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await contentService.deleteContent(id!);

      if (result.success) {
        res.status(204).send();
      } else {
        res.status(404).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get content statistics
   * GET /api/contents/stats
   */
  async getStats(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await contentService.getContentStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check if content exists by URL
   * GET /api/contents/exists
   */
  async checkExists(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { url } = req.query;

      if (!url) {
        res.status(400).json({
          success: false,
          error: 'URL is required',
        });
        return;
      }

      const exists = await contentService.contentExistsByUrl(url as string);

      res.json({
        success: true,
        data: { exists },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const contentController = new ContentController();
