import express from 'express';
import { getAuthToken } from '../utils/tboAuth.js';

const router = express.Router();

// @route   GET /api/tbo/auth
// @desc    Get TBO API authentication token
// @access  Public
router.get('/auth', async (req, res) => {
  try {
    const authData = await getAuthToken();
    res.json({
      success: true,
      data: authData,
    });
  } catch (error) {
    console.error('TBO Auth Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to authenticate with TBO API',
    });
  }
});

export default router;
