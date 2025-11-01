import express from 'express';
import { body } from 'express-validator';
import {
  getMediaTags,
  addMediaTag,
  removeMediaTag,
  updateMediaTags
} from '../controllers/dynamicField.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply admin protection to all routes
router.use(protect, authorize('admin'));

// Get all media gallery tags
router.get('/media-tags', getMediaTags);

// Add a new tag
router.post(
  '/media-tags',
  [
    body('tag')
      .trim()
      .notEmpty()
      .withMessage('Tag is required')
      .isString()
      .withMessage('Tag must be a string')
  ],
  addMediaTag
);

// Remove a tag
router.delete('/media-tags/:tag', removeMediaTag);

// Update all tags (replace existing ones)
router.put(
  '/media-tags',
  [
    body('tags')
      .isArray()
      .withMessage('Tags must be an array')
      .custom(tags => {
        return tags.every(tag => typeof tag === 'string' && tag.trim() !== '');
      })
      .withMessage('All tags must be non-empty strings')
  ],
  updateMediaTags
);

export default router;
