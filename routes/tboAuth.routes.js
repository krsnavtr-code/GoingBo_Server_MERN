import express from 'express';
import axios from 'axios';
import tboAuth from '../utils/tboAuth.js';
const { getAuthToken, loadToken } = tboAuth;

const router = express.Router();

// @route   GET /api/tbo/auth
// @desc    Get TBO API authentication token
// @access  Public
router.get('/auth', async (req, res) => {
  try {
      const authData = await getAuthToken(true); // Force new token
    res.json({
      success: true,
        Token: authData.TokenId,
        Status: authData.Status === 1 ? 'Success' : 'Failed',
        User: authData.Member?.FirstName + ' ' + (authData.Member?.LastName || ''),
        ...authData // Include all response data
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
                const authData = await getAuthToken(true);

                console.log('Auth Data:', {
                    TokenId: authData.TokenId ? 'Token exists' : 'No token',
                    TokenLength: authData.TokenId?.length || 0,
                    IsFreshToken: !loadToken() ? 'Fresh token' : 'Cached token'
                });

                // Prepare the request payload according to TBO API format
                const searchParams = {
                    EndUserIp: req.ip || '82.112.236.83',
                    TokenId: authData.TokenId,
                    AdultCount: parseInt(adults) || 1,
                    ChildCount: parseInt(children) || 0,
                    InfantCount: parseInt(infants) || 0,
                    DirectFlight: false,
                    OneStopFlight: false,
                    JourneyType: returnDate ? 2 : 1,  // 1 for OneWay, 2 for Return
                    PreferredAirlines: null,
                    Segments: [
                        {
                            Origin: origin,
                            Destination: destination,
                            FlightCabinClass: cabinClass || '2',  // 2 for Economy
                            PreferredDepartureTime: `${departureDate}T00:00:00`,
                            // PreferredArrivalTime: `${departureDate}T23:59:59`
                        }
                    ],
                    Sources: ['GDS']  // For Amadeus/Galileo
                };

                // Add return segment for round-trip
                if (returnDate) {
                    searchParams.Segments.push({
                        Origin: destination,
                        Destination: origin,
                        FlightCabinClass: cabinClass || '2',
                        PreferredDepartureTime: `${returnDate}T00:00:00`,
                        // PreferredArrivalTime: `${returnDate}T23:59:59`
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
                            'Authorization': `Bearer ${authData.TokenId}` 
                        },
                        timeout: 30000
                    }
                );

                return response.data;
            } catch (error) {
                // If token is invalid and we haven't retried yet, try one more time
                // In the search endpoint, update the error handling:
                if (error.response?.data?.Response?.Error?.ErrorCode === 6 && retryCount > 0) {
                    console.log('Token expired, forcing token refresh...');
                    // Force a fresh token by passing true
                    const freshAuthData = await getAuthToken(true);
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
