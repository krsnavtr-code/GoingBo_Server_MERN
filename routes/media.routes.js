import express from 'express';
import * as mediaController from '../controllers/media.controller.js';

const router = express.Router();

// Protect all routes after this middleware
// Routes for media management
router.route('/')
  .get(mediaController.getAllMedia)
  .post(mediaController.uploadMedia);

router.route('/:id')
  .delete(mediaController.deleteMedia);

export default router;
