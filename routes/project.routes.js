import express from 'express';
import * as projectController from '../controllers/project.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { validateProject, projectExists } from '../middleware/projectValidation.js';

const router = express.Router();

// Public routes
router.get('/', projectController.getProjects);
router.get('/:id', projectController.getProject);
router.get('/slug/:slug', projectController.getProjectBySlug);
router.get('/category/:categoryId', projectController.getProjectsByCategory);

// Protected routes (require authentication)
router.use(protect);

// Admin-only routes
router.use(restrictTo('admin'));

router.post('/', validateProject, projectController.createProject);
router.patch('/:id', projectExists, validateProject, projectController.updateProject);
router.delete('/:id', projectExists, projectController.deleteProject);
router.patch('/:id/toggle-publish', projectExists, projectController.togglePublishProject);

export default router;
