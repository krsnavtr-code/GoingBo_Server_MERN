import { searchFlights, getFareRules, getFareQuote, bookFlight, confirmTicket as confirmBooking, getBookingDetails } from '../utils/tboFlightService.js';
import { validationResult } from 'express-validator';
import logger from '../utils/logger.js';

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

    const {
      origin,
      destination,
      departureDate,
      returnDate,
      adults = 1,
      children = 0,
      infants = 0,
      cabinClass = '2', // Default to Economy
      tripType = 'oneway'
    } = req.body;

    logger.info('Flight search request:', {
      origin,
      destination,
      departureDate,
      returnDate,
      adults,
      children,
      infants,
      cabinClass,
      tripType,
      ip: req.ip
    });

    const searchParams = {
      origin,
      destination,
      departure_date: departureDate,
      return_date: returnDate,
      adults: parseInt(adults),
      children: parseInt(children),
      infants: parseInt(infants),
      travelclass: cabinClass,
      journey_type: tripType === 'roundtrip' ? '2' : '1'
    };

    const results = await searchFlights(searchParams);
    
    if (results && results.success) {
      return res.json({
        success: true,
        data: results
      });
    }
    
    // If we get here, there was an error
    throw new Error(results?.message || 'Failed to search for flights');
  } catch (error) {
    logger.error('Flight search error:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      params: req.params,
      query: req.query,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    const statusCode = error.statusCode || 500;
    const errorCode = error.code || 'SERVER_ERROR';
    const errorMessage = error.message || 'An unexpected error occurred';
    
    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { details: error.stack })
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
