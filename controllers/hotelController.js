import { searchHotelsByCity } from '../utils/tboCityApi.js';
import { search_hotels } from '../utils/travelBoutiqueHotelApi.js';
import Hotel from '../models/Hotel.js';

// Search hotels
export const search = async (req, res) => {
    try {
        const { checkIn, checkOut, city, country = 'IN', guests = {}, rooms = 1, hotelCodes = [] } = req.body;

        // Validate required fields
        if (!checkIn || !checkOut) {
            return res.status(400).json({
                success: false,
                message: 'Check-in and check-out dates are required'
            });
        }

        if (!city) {
            return res.status(400).json({
                success: false,
                message: 'City is required'
            });
        }

        // Set default values if not provided
        const adults = parseInt(guests.adults) || 1;
        const children = parseInt(guests.children) || 0;
        const childrenAges = Array.isArray(guests.childrenAges) 
            ? guests.childrenAges.map(age => parseInt(age) || 0).filter(age => age > 0)
            : [];

        // Search for hotels in the specified city
        try {
            const hotelSearch = await searchHotelsByCity(city);

            if (!hotelSearch.success || !hotelSearch.hotels?.length) {
                return res.status(404).json({
                    success: false,
                    message: 'No hotels found in the specified city. Please try another city.'
                });
            }

            // Get hotel codes from the search results
            const hotelCodes = hotelSearch.hotels.map(hotel => hotel.HotelCode);

            // Prepare search parameters for availability check
            const searchParams = {
                checkIn,
                checkOut,
                guestCountry: country,
                hotelcodes: hotelCodes,
                adult: adults,
                child: children,
                childAges: childrenAges,
                rooms: parseInt(rooms) || 1
            };

            // Search for available hotels with the given parameters
            const searchResults = await search_hotels(searchParams);

            if (!searchResults || !searchResults.HotelResults) {
                return res.status(404).json({
                    success: false,
                    message: 'No available hotels found for the selected dates',
                    results: []
                });
            }

            // Return the search results
            return res.json({
                success: true,
                message: 'Hotels found successfully',
                results: searchResults.HotelResults,
                totalHotels: searchResults.HotelResults.length
            });

        } catch (error) {
            console.error('Error searching hotels:', error);
            return res.status(500).json({
                success: false,
                message: 'Error searching for hotels',
                error: error.message
            });
        }
    } catch (error) {
        console.error('Hotel search error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search hotels',
            error: error.message
        });
    }
};

// Get hotel details
export const getDetails = async (req, res) => {
    try {
        const { hotelCode, checkIn, checkOut, guestNationality = 'IN' } = req.body;

        const result = await getHotelDetails({
            HotelCode: hotelCode,
            CheckIn: checkIn,
            CheckOut: checkOut,
            GuestNationality: guestNationality
        });

        res.json(result);
    } catch (error) {
        console.error('Get hotel details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get hotel details',
            error: error.message
        });
    }
};

// Pre-book hotel
export const preBook = async (req, res) => {
    try {
        const { bookingDetails } = req.body;
        const result = await preBookHotel(bookingDetails);
        res.json(result);
    } catch (error) {
        console.error('Pre-book error:', error);
        res.status(500).json({
            success: false,
            message: 'Pre-booking failed',
            error: error.message
        });
    }
};

// Confirm booking
export const book = async (req, res) => {
    try {
        const { bookingDetails } = req.body;
        const result = await bookHotel(bookingDetails);
        res.json(result);
    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Booking failed',
            error: error.message
        });
    }
};

// Get booking details
export const getBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const result = await getBookingDetails(bookingId);
        res.json(result);
    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get booking details',
            error: error.message
        });
    }
};

// Get hotel codes
export const getHotelCodes = async (req, res) => {
    try {
        const { countryCode = 'IN' } = req.query;
        const result = await getTBOHotelCodeList({ countryCode });
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Get hotel codes error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get hotel codes',
            error: error.message
        });
    }
};

/**
 * Search for cities by name or code
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const searchCities = async (req, res) => {
    try {
        const { query = '', countryCode = 'IN' } = req.query;

        if (!query || query.length < 2) {
            return res.json({
                success: true,
                data: []
            });
        }

        // Get all cities for the country
        const response = await getCitiesByCountry(countryCode);
        
        // Log the raw response for debugging
        console.log('Raw cities response:', JSON.stringify(response, null, 2));
        
        // The response should have a CityList array
        const cities = (response && response.CityList && Array.isArray(response.CityList)) 
            ? response.CityList 
            : [];
            
        console.log('Processed cities:', cities.length);

        // Filter cities based on the search query
        const searchTerm = query.toLowerCase();
        const filteredCities = cities.filter(city => {
            if (!city) return false;
            
            const cityName = city.Name || '';
            const cityCode = city.Code || '';
            
            return (
                cityName.toLowerCase().includes(searchTerm) ||
                cityCode.toLowerCase().includes(searchTerm)
            );
        });
        
        // Transform the data to match the expected format
        const transformedCities = filteredCities.map(city => ({
            CityId: city.Code,
            CityName: city.Name.split(',')[0].trim(), // Get just the city name part
            CountryName: 'India' // Default to India for now
        }));

        res.json({
            success: true,
            data: transformedCities
        });
    } catch (error) {
        console.error('Search cities error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search cities',
            error: error.message
        });
    }
};