import express from 'express';
import {
  createSkill,
  getAllSkills,
  getSkill,
  updateSkill,
  deleteSkill,
  getSkillStats
} from '../controllers/skill.controller.js';
import { protect, restrictTo } from '../controllers/auth.controller.js';

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Only admin can access these routes
router.use(restrictTo('admin'));

// Stats route
router.get('/stats', getSkillStats);

// CRUD routes
router
  .route('/')
  .get(getAllSkills)
  .post(createSkill);

router
  .route('/:id')
  .get(getSkill)
  .patch(updateSkill)
  .delete(deleteSkill);

export default router;
