import express from 'express';
import { protect, restrictTo } from '../controllers/auth.controller.js';
import { 
  getAllUsers, 
  getUser, 
  updateUser, 
  deleteUser,
  getDashboardStats,
  getAllContacts,
  getContact,
  updateContactStatus,
  getContactStats
} from '../controllers/admin.controller.js';
import profileRouter from './profile.routes.js';
import mediaRouter from './media.routes.js';

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);
// Only admin can access these routes
router.use(restrictTo('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Profile routes
router.use('/profile', profileRouter);

// Media routes
router.use('/media', mediaRouter);

// Contact Form Submissions
router.get('/contacts', getAllContacts);
router.get('/contacts/stats', getContactStats);
router
  .route('/contacts/:id')
  .get(getContact)
  .patch(updateContactStatus);


// User management
router.route('/users')
  .get(getAllUsers);

router.route('/users/:id')
  .get(getUser)
  .patch(updateUser)
  .delete(deleteUser);

export default router;
