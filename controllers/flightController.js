import { searchFlights, getFareRules, getFareQuote, bookFlight, confirmBooking, getBookingDetails } from '../utils/travelBoutiqueApi.js';
import { validationResult } from 'express-validator';

// @desc    Search for flights
// @route   POST /api/flights/search
// @access  Public
export const searchFlightsCtrl = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const searchParams = {
      origin: req.body.origin,
      destination: req.body.destination,
      departureDate: req.body.departureDate,
      returnDate: req.body.returnDate,
      adults: parseInt(req.body.adults) || 1,
      children: parseInt(req.body.children) || 0,
      infants: parseInt(req.body.infants) || 0,
      cabinClass: req.body.cabinClass || '1', // 1: All, 2: Economy, 3: Premium Economy, etc.
      journeyType: req.body.journeyType || '1' // 1: OneWay, 2: Return
    };

    const results = await searchFlights(searchParams, req);
    
    if (results.success) {
      res.json({
        success: true,
        data: results
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: results.code || 'SEARCH_ERROR',
          message: results.message || 'Failed to search for flights'
        }
      });
    }
  } catch (error) {
    console.error('Search controller error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : {}
      }
    });
  }
};

// @desc    Get fare rules for a specific flight
// @route   POST /api/flights/fare-rules
// @access  Public
export const getFareRulesCtrl = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const { resultIndex, traceId } = req.body;
    
    if (!resultIndex || !traceId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'resultIndex and traceId are required'
        }
      });
    }

    const fareRules = await getFareRules(resultIndex, traceId, req);
    
    res.json({
      success: true,
      data: fareRules
    });
  } catch (error) {
    console.error('Get fare rules error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get fare rules',
        details: process.env.NODE_ENV === 'development' ? error.message : {}
      }
    });
  }
};

// @desc    Get fare quote for a specific flight
// @route   POST /api/flights/fare-quote
// @access  Public
export const getFareQuoteCtrl = async (req, res) => {
  try {
    const { resultIndex, traceId } = req.body;
    
    if (!resultIndex || !traceId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'resultIndex and traceId are required'
        }
      });
    }

    const fareQuote = await getFareQuote(resultIndex, traceId, req);
    
    res.json({
      success: true,
      data: fareQuote
    });
  } catch (error) {
    console.error('Get fare quote error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get fare quote',
        details: process.env.NODE_ENV === 'development' ? error.message : {}
      }
    });
  }
};

// @desc    Book a flight
// @route   POST /api/flights/book
// @access  Private
export const bookFlightCtrl = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const bookingData = {
      ...req.body,
      userId: req.user?.id // Add user ID from auth middleware if available
    };

    const bookingResult = await bookFlight(bookingData, req);
    
    res.status(201).json({
      success: true,
      data: bookingResult
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BOOKING_ERROR',
        message: 'Failed to book flight',
        details: process.env.NODE_ENV === 'development' ? error.message : {}
      }
    });
  }
};

// @desc    Confirm flight booking
// @route   POST /api/flights/confirm-booking
// @access  Private
export const confirmBookingCtrl = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const confirmationResult = await confirmBooking(req.body, req);
    
    res.json({
      success: true,
      data: confirmationResult
    });
  } catch (error) {
    console.error('Booking confirmation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIRMATION_ERROR',
        message: 'Failed to confirm booking',
        details: process.env.NODE_ENV === 'development' ? error.message : {}
      }
    });
  }
};

// @desc    Get booking details
// @route   GET /api/flights/booking/:bookingId
// @access  Private
export const getBookingDetailsCtrl = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'bookingId is required'
        }
      });
    }

    const bookingDetails = await getBookingDetails({ BookingId: bookingId }, req);
    
    res.json({
      success: true,
      data: bookingDetails
    });
  } catch (error) {
    console.error('Get booking details error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BOOKING_DETAILS_ERROR',
        message: 'Failed to get booking details',
        details: process.env.NODE_ENV === 'development' ? error.message : {}
      }
    });
  }
};

export default {
  search: searchFlightsCtrl,
  getFareRules: getFareRulesCtrl,
  getFareQuote: getFareQuoteCtrl,
  book: bookFlightCtrl,
  confirmBooking: confirmBookingCtrl,
  getBookingDetails: getBookingDetailsCtrl
};
