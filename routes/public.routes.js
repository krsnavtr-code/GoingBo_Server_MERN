import express from 'express';
import { getPublicProfile } from '../controllers/profile.controller.js';

const router = express.Router();

// Public route to get profile data
router.get('/profile', getPublicProfile);

export default router;
