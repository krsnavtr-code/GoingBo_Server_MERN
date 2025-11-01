import { body, validationResult } from 'express-validator';
import { BadRequestError } from '../utils/errors.js';

// Validation middleware for FAQ creation/updation
export const validateFaq = [
  // Validate question
  body('question')
    .trim()
    .notEmpty()
    .withMessage('Question is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Question must be between 10 and 500 characters'),
  
  // Validate answer
  body('answer')
    .trim()
    .notEmpty()
    .withMessage('Answer is required')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Answer must be between 10 and 5000 characters'),
  
  // Validate isActive (optional, defaults to true if not provided)
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
  
  // Check for validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({
        field: error.param,
        message: error.msg
      }));
      
      throw new BadRequestError('Validation failed', errorMessages);
    }
    next();
  }
];

// Middleware to validate MongoDB ObjectId
// This can be used in routes that need to validate IDs
export const validateId = (req, res, next) => {
  const { id } = req.params;
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    throw new BadRequestError('Invalid FAQ ID');
  }
  next();
};
