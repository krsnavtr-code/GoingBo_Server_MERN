import express from 'express';
import {
  signup,
  login,
  protect,
  logout,
  forgotPassword,
  verifyOTP,
  resetPassword,
  updateProfile
} from '../controllers/auth.controller.js';

const router = express.Router();

// Public routes
router.post('/signup', signup);
router.post('/login', login);
// Password reset routes
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.patch('/reset-password/:token', resetPassword);

// Protected routes (require authentication)
router.use(protect);

// User profile routes
router.route('/me')
  .get((req, res) => {
    res.status(200).json({
      status: 'success',
      data: {
        user: req.user,
      },
    });
  })
  .patch(updateProfile);

// Logout route
router.get('/logout', logout);

export default router;
