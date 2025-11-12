import express from 'express';
import {
    search,
    getDetails,
    preBook,
    book,
    getBooking,
    getHotelCodes
} from '../controllers/hotelController.js';

const router = express.Router();

// Search hotels
router.post('/search', search);

// Get hotel details
router.post('/details', getDetails);

// Pre-book hotel
router.post('/prebook', preBook);

// Confirm booking
router.post('/book', book);

// Get booking details
router.get('/booking/:bookingId', getBooking);

// Search hotel codes
router.get('/hotel-codes', getHotelCodes);

// Register a new hotel
// router.post('/register', register);

export default router;