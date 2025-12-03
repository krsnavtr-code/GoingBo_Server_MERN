import express from 'express';
import axios from 'axios';
import { getAuthToken } from '../utils/tboAuth.js';

const router = express.Router();

// @route   GET /api/tbo/auth
// @desc    Get TBO API authentication token
// @access  Public
router.get('/auth', async (req, res) => {
  try {
    const authData = await getAuthToken();
    res.json({
      success: true,
      data: authData,
    });
  } catch (error) {
    console.error('TBO Auth Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to authenticate with TBO API',
    });
  }
});

// @route   POST /api/v1/tbo/search-flights
// @desc    Search for flights using TBO API
// @access  Public
router.post('/search-flights', async (req, res) => {
    try {
        const { origin, destination, departureDate, returnDate, adults, children, infants, cabinClass } = req.body;

        // Validate required fields
        if (!origin || !destination || !departureDate) {
            return res.status(400).json({
                success: false,
                message: 'Origin, destination, and departure date are required',
            });
        }

        // Get authentication token first
        const authData = await getAuthToken();

        // Prepare the request payload
        const searchParams = {
            EndUserIp: req.ip || '192.168.1.1',
            TokenId: authData.TokenId,
            AdultCount: String(adults || 1),
            ChildCount: String(children || 0),
            InfantCount: String(infants || 0),
            DirectFlight: 'false',
            OneStopFlight: 'false',
            JourneyType: returnDate ? '2' : '1',
            PreferredAirlines: null,
            Segments: [
                {
                    Origin: origin,
                    Destination: destination,
                    FlightCabinClass: cabinClass || '1',
                    PreferredDepartureTime: `${departureDate}T00:00:00`,
                    PreferredArrivalTime: `${departureDate}T23:59:59`
                }
            ],
            Sources: null
        };

        if (returnDate) {
            searchParams.Segments.push({
                Origin: destination,
                Destination: origin,
                FlightCabinClass: cabinClass || '1',
                PreferredDepartureTime: `${returnDate}T00:00:00`,
                PreferredArrivalTime: `${returnDate}T23:59:59`
            });
        }
        
        // Make the flight search request to TBO API
        const response = await axios.post(
            'http://api.tektravels.com/BookingEngineService_Air/AirService.svc/rest/Search',
            searchParams,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            }
        );

        res.json({
            success: true,
            data: response.data,
        });
    } catch (error) {
        console.error('Flight Search Error:', error);
        res.status(500).json({
            success: false,
            message: error.response?.data?.Error?.ErrorMessage || 'Failed to search for flights',
            details: error.response?.data || error.message,
        });
    }
});

export default router;
