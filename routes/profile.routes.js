import express from 'express';
import { protect, restrictTo } from '../controllers/auth.controller.js';
import { getProfile, updateProfile } from '../controllers/profile.controller.js';

const router = express.Router();

// Admin routes
router.use(protect, restrictTo('admin'));

router
  .route('/')
  .get(getProfile)
  .patch(updateProfile);

export default router;
