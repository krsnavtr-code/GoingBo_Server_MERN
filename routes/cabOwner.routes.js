import express from 'express';
import {
  registerCabOwner,
  getOwnerProfile,
  updateOwnerProfile,
  getOwnerDashboard,
  getOwnerCabs,
  getOwnerBookings,
  requestPayout,
  updateCabStatus
} from '../controllers/cabOwner.controller.js';
import { protect, restrictTo } from '../controllers/auth.controller.js';

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Only cab owners can access these routes
router.use(restrictTo('cabOwner'));

// Register as cab owner (user must be authenticated but not necessarily a cab owner yet)
router.post('/register', registerCabOwner);

// Get and update owner profile
router
  .route('/profile')
  .get(getOwnerProfile)
  .patch(updateOwnerProfile);

// Owner dashboard
router.get('/dashboard', getOwnerDashboard);

// Owner's cabs
router.get('/cabs', getOwnerCabs);

// Owner's bookings
router.get('/bookings', getOwnerBookings);

// Payouts
router.post('/request-payout', requestPayout);

// Update cab status
router.patch('/cabs/:cabId/status', updateCabStatus);

export default router;
