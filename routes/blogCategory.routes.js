import express from 'express';
import {
  getBlogCategories,
  getBlogCategory,
  createBlogCategory,
  updateBlogCategory,
  deleteBlogCategory
} from '../controllers/blogCategory.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.route('/')
  .get(getBlogCategories);

router.route('/:id')
  .get(getBlogCategory);

// Protected routes (require authentication and admin access)
router.use(protect);
router.use(authorize('admin'));

router.route('/')
  .post(createBlogCategory);

router.route('/:id')
  .put(updateBlogCategory)
  .delete(deleteBlogCategory);

export default router;
