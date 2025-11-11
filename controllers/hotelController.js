import {
    searchHotels,
    getHotelDetails,
    preBookHotel,
    bookHotel,
    getBookingDetails,
    getHotelCodeList
} from '../utils/travelBoutiqueHotelApi.js';
import Hotel from '../models/Hotel.js';

// Search hotels
export const search = async (req, res) => {
    try {
        const { checkIn, checkOut, city, country, guests, rooms, hotelCodes } = req.body;

        // Process guests into room configuration
        const roomGuests = [];
        let guestIndex = 0;

        for (let i = 0; i < rooms; i++) {
            const room = {
                Adults: 0,
                Children: 0,
                ChildrenAges: []
            };

            // Add adults
            for (let j = 0; j < guests.adults; j++) {
                if (guestIndex < guests.adults) {
                    room.Adults++;
                    guestIndex++;
                }
            }

            // Add children
            for (let j = 0; j < guests.children; j++) {
                if (j < guests.childrenAges.length) {
                    room.Children++;
                    room.ChildrenAges.push(parseInt(guests.childrenAges[j]));
                }
            }

            roomGuests.push(room);
        }

        const searchParams = {
            CheckIn: checkIn,
            CheckOut: checkOut,
            CityId: city,
            CountryCode: country,
            GuestNationality: 'IN',
            PaxRooms: roomGuests,
            ResponseTime: 23.0,
            IsDetailedResponse: true,
            HotelCodes: hotelCodes || [],
            Filters: {
                Refundable: false,
                NoOfRooms: rooms,
                MealType: 0,
                OrderBy: 0,
                StarRating: 0
            }
        };

        const result = await searchHotels(searchParams);
        res.json(result);
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
        const { searchQuery } = req.query;
        const result = await getHotelCodeList({
            SearchQuery: searchQuery
        });
        res.json(result);
    } catch (error) {
        console.error('Get hotel codes error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get hotel codes',
            error: error.message
        });
    }
};