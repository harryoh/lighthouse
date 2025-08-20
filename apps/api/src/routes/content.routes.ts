import { Router } from 'express';
import { contentController } from '../controllers/content.controller';
import {
  validateContentInput,
  validateContentUpdate,
} from '../middleware/validation';

const router = Router();

/**
 * Content API Routes
 * Base path: /api/contents
 */

// GET /api/contents/stats - Get content statistics
router.get('/stats', contentController.getStats);

// GET /api/contents/exists - Check if content exists by URL
router.get('/exists', contentController.checkExists);

// GET /api/contents/search - Search contents
router.get('/search', contentController.search);

// GET /api/contents - Get all contents with filters and pagination
router.get('/', contentController.getAll);

// GET /api/contents/:id - Get content by ID
router.get('/:id', contentController.getById);

// POST /api/contents - Create new content
router.post('/', validateContentInput, contentController.create);

// PUT /api/contents/:id - Update content
router.put('/:id', validateContentUpdate, contentController.update);

// DELETE /api/contents/:id - Delete content
router.delete('/:id', contentController.delete);

export default router;
