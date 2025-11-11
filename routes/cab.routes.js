import express from 'express';
import { protect, restrictTo } from '../controllers/auth.controller.js';
import {
  getAllCabs,
  getCab,
  createCab,
  updateCab,
  deleteCab,
  getAllCabBookings,
  getBooking,
  updateBookingStatus,
  getCabStats,
  findAvailableCabs,
  assignDriverToBooking,
  addCabRoute,
  updateCabRoute,
  removeCabRoute,
  getAllDrivers,
  getCabSettings,
  updateCabSettings,
  createCabBooking,
  getMyBookings,
  registerCab,
} from '../controllers/cab.controller.js';

const router = express.Router();

// Public routes
router.get('/available', findAvailableCabs);
router.post('/register', registerCab);

// Protect all routes after this middleware
router.use(protect);

// Cab booking routes - these need to come before the /:id route
// User's own bookings
router.get('/my-bookings', getMyBookings);

// Admin booking routes
router
  .route('/bookings')
  .get(restrictTo('admin'), getAllCabBookings)  // Only admin can view all bookings
  .post(createCabBooking);  // Any authenticated user can create a booking

// Only admin can access routes after this point
router.use(restrictTo('admin'));

router
  .route('/bookings/:id')
  .get(getBooking)
  .patch(updateBookingStatus);

// Cab routes
router
  .route('/')
  .get(getAllCabs)
  .post(createCab);

// Drivers route - must come before /:id
router.get('/drivers', getAllDrivers);

// Settings route - must come before /:id
router
  .route('/settings')
  .get(getCabSettings)
  .patch(updateCabSettings);

router
  .route('/:id')
  .get(getCab)
  .patch(updateCab)
  .delete(deleteCab);

// Cab stats
router.get('/stats/cab-stats', getCabStats);

// Find available cabs
router.get('/available', findAvailableCabs);

// Assign driver to booking
router.patch('/bookings/:id/assign-driver', assignDriverToBooking);

// Cab routes management
router.post('/:id/routes', addCabRoute);
router.patch('/:id/routes/:routeId', updateCabRoute);
router.delete('/:id/routes/:routeId', removeCabRoute);

export default router;
