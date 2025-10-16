import express from 'express';
import {
  getBlogs,
  getBlog,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog
} from '../controllers/blog.controller.js';
import { protect, authorize } from '../middleware/auth.js';
import advancedResults from '../middleware/advancedResults.js';
import { Blog } from '../models/blog.model.js';

const router = express.Router();

// Public routes
router.route('/')
  .get(advancedResults(Blog, 'author'), getBlogs);

// Get blog by ID - must come before slug route
router.route('/:id')
  .get(getBlog);

// Route to get blog by slug
router.route('/slug/:slug')
  .get(getBlogBySlug);

// Protected routes (require authentication and authorization)
router.use(protect);
router.use(authorize('admin', 'publisher'));

router.route('/')
  .post(createBlog);

router.route('/:id')
  .put(updateBlog)
  .delete(deleteBlog);

export default router;
