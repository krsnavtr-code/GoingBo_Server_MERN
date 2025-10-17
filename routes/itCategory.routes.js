import express from 'express';
import * as itCategoryController from '../controllers/itCategory.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);
router.use(authorize('admin'));

router
  .route('/')
  .get(itCategoryController.getAllCategories)
  .post(itCategoryController.createCategory);

router
  .route('/reorder')
  .patch(itCategoryController.reorderCategories);

router
  .route('/:id')
  .get(itCategoryController.getCategory)
  .patch(itCategoryController.updateCategory)
  .delete(itCategoryController.deleteCategory);

export default router;
