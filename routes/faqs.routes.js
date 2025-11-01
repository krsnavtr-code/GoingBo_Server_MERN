import express from 'express';
import { 
    createFaq, 
    getFaqs, 
    updateFaq, 
    deleteFaq, 
    getFaqById, 
    toggleFaqStatus 
} from '../controllers/faqs.controller.js';
import { protect, authorize } from '../middleware/auth.js';
import { validateFaq } from '../middleware/faqsValidation.js';

const router = express.Router();

// Public routes
router.get('/', getFaqs);
router.get('/:id', getFaqById);

// Protected routes (require authentication and admin role)
router.use(protect);
router.use(authorize('admin'));

// Create, update, delete operations
router.post('/', validateFaq, createFaq);

// Routes with ID parameter
router.route('/:id')
  .get(getFaqById)
  .put(validateFaq, updateFaq)
  .delete(deleteFaq);

// Toggle status
router.patch('/:id/toggle', toggleFaqStatus);

export default router;
