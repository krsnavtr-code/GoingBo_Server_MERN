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

        // Function to perform flight search with retry logic
        const performSearch = async (retryCount = 1) => {
            try {
                // Get a fresh token for each attempt
                const authData = await getAuthToken();

                // Prepare the request payload according to TBO API format
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

                // Add return segment for round-trip
                if (returnDate) {
                    searchParams.Segments.push({
                        Origin: destination,
                        Destination: origin,
                        FlightCabinClass: cabinClass || '1',
                        PreferredDepartureTime: `${returnDate}T00:00:00`,
                        PreferredArrivalTime: `${returnDate}T23:59:59`
                    });
                }

                console.log('Sending search request with token:', authData.TokenId);

                // Make the flight search request to TBO API
                const response = await axios.post(
                    'http://api.tektravels.com/BookingEngineService_Air/AirService.svc/rest/Search',
                    searchParams,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        timeout: 30000 // 30 seconds timeout
                    }
                );

                return response.data;
            } catch (error) {
                // If token is invalid and we haven't retried yet, try one more time
                if (error.response?.data?.Response?.Error?.ErrorCode === 6 && retryCount > 0) {
                    console.log('Token expired, retrying with fresh token...');
                    return performSearch(retryCount - 1);
                }
                throw error;
            }
        };

        // Perform the search with one retry attempt
        const searchResult = await performSearch(1);

        res.json({
            success: true,
            data: searchResult,
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
