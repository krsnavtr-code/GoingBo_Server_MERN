import express from 'express';
import { protect, restrictTo } from '../controllers/auth.controller.js';
import { 
  getAllUsers, 
  getUser, 
  updateUser, 
  deleteUser,
  getDashboardStats
} from '../controllers/admin.controller.js';
import profileRouter from './profile.routes.js';

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);
// Only admin can access these routes
router.use(restrictTo('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Profile routes
router.use('/profile', profileRouter);

// User management
router.route('/users')
  .get(getAllUsers);

router.route('/users/:id')
  .get(getUser)
  .patch(updateUser)
  .delete(deleteUser);

export default router;
