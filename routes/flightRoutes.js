import express from 'express';
import { body } from 'express-validator';
import flightController from '../controllers/flightController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/flights/search
// @desc    Search for flights
// @access  Public
router.post(
  '/search',
  [
    body('origin', 'Origin is required').not().isEmpty(),
    body('destination', 'Destination is required').not().isEmpty(),
    body('departureDate', 'Departure date is required').isISO8601(),
    body('returnDate', 'Return date must be a valid date').optional().isISO8601(),
    body('adults', 'Adults must be a positive number').optional().isInt({ min: 1 }),
    body('children', 'Children must be a positive number').optional().isInt({ min: 0 }),
    body('infants', 'Infants must be a positive number').optional().isInt({ min: 0 }),
    body('cabinClass', 'Invalid cabin class').optional().isIn(['Economy', 'Premium Economy', 'Business', 'First']),
    body('nonStop', 'Non-stop must be a boolean').optional().isBoolean()
  ],
  flightController.search
);

// @route   POST /api/flights/fare-rules
// @desc    Get fare rules for a specific flight
// @access  Public
router.post(
  '/fare-rules',
  [
    body('sessionId', 'Session ID is required').not().isEmpty(),
    body('resultIndex', 'Result index is required').not().isEmpty()
  ],
  flightController.getFareRules
);

// @route   POST /api/flights/book
// @desc    Book a flight
// @access  Private
router.post(
  '/book',
  protect,
  [
    body('sessionId', 'Session ID is required').not().isEmpty(),
    body('resultIndex', 'Result index is required').not().isEmpty(),
    body('passengers', 'Passengers array is required').isArray({ min: 1 }),
    body('passengers.*.type', 'Passenger type is required').isIn(['adult', 'child', 'infant']),
    body('passengers.*.title', 'Title is required').not().isEmpty(),
    body('passengers.*.first_name', 'First name is required').not().isEmpty(),
    body('passengers.*.last_name', 'Last name is required').not().isEmpty(),
    body('passengers.*.date_of_birth', 'Valid date of birth is required').isISO8601(),
    body('passengers.*.passport_number', 'Passport number is required').not().isEmpty(),
    body('passengers.*.passport_expiry', 'Passport expiry date is required').isISO8601(),
    body('passengers.*.nationality', 'Nationality is required').not().isEmpty(),
    body('passengers.*.gender', 'Gender is required').isIn(['M', 'F', 'O']),
    body('contact_info.email', 'Valid email is required').isEmail(),
    body('contact_info.phone', 'Phone number is required').not().isEmpty(),
    body('payment.type', 'Payment type is required').isIn(['credit_card', 'debit_card', 'upi', 'net_banking']),
    body('payment.card_number', 'Card number is required').not().isEmpty(),
    body('payment.expiry', 'Card expiry is required').matches(/^(0[1-9]|1[0-2])\/([0-9]{2})$/),
    body('payment.cvv', 'CVV is required').isLength({ min: 3, max: 4 }),
    body('payment.name_on_card', 'Name on card is required').not().isEmpty()
  ],
  flightController.book
);

export default router;
