import express from 'express';
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
            TokenId: authData.TokenId,
            Origin: origin,
            Destination: destination,
            DepartureDate: departureDate,
            ReturnDate: returnDate || '',
            Adults: adults || 1,
            Childs: children || 0,
            Infants: infants || 0,
            PreferredAirlines: [],
            JourneyType: returnDate ? 2 : 1, // 1 for one-way, 2 for round-trip
            CabinClass: cabinClass || '2', // 2 for Economy
            DirectFlight: false,
            OneStopFlight: false,
            PreferredDepartureTime: '',
            PreferredArrivalTime: '',
            AllFlights: true,
        };

        // Make the flight search request to TBO API
        const response = await axios.post(
            'https://api.travelboutiqueonline.com/AirAPI_V10/AirService.svc/rest/Search',
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
