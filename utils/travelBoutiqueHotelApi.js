import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Create necessary directories
const LOG_DIR = path.join(__dirname, '../logs/TBO/hotels');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// TBO Hotel API Configuration
const CONFIG = {
    username: process.env.TBO_HOTEL_USERNAME || 'DELG738',
    password: process.env.TBO_HOTEL_PASSWORD || 'Htl@DEL#38/G',
    baseUrl: 'https://api.travelboutiqueonline.com',
    hotelApiUrl: 'https://apiwr.tboholidays.com/HotelAPI',
    bookingApiUrl: 'https://hotelbooking.travelboutiqueonline.com/HotelAPI_V10/HotelService.svc/rest',
    logFile: path.join(LOG_DIR, `hotel_${new Date().toISOString().split('T')[0]}.log`),
    auth: null,
    clientId: 'travelcategory',
    clientSecret: 'Tra@59334536'
};

// Generate basic auth token
const getAuthToken = () => {
    return Buffer.from(`${CONFIG.username}:${CONFIG.password}`).toString('base64');
};

// Log messages to file
const logMessage = (message, type = 'info') => {
    try {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
        fs.appendFileSync(CONFIG.logFile, logEntry);
    } catch (error) {
        console.error('Error writing to hotel log file:', error);
    }
};

// Make authenticated request to TBO Hotel API
const makeHotelRequest = async (endpoint, params = {}, method = 'post', isBookingApi = false, useClientAuth = false) => {
    try {
        const baseUrl = isBookingApi ? CONFIG.bookingApiUrl : CONFIG.hotelApiUrl;
        const url = `${baseUrl}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': useClientAuth 
                ? `Basic ${Buffer.from(`${CONFIG.clientId}:${CONFIG.clientSecret}`).toString('base64')}`
                : `Basic ${getAuthToken()}`
        };
        
        // Add request ID for tracking
        const requestId = uuidv4();
        headers['X-Request-ID'] = requestId;

        logMessage(`Request: ${url}\n${JSON.stringify(params, null, 2)}`);

        const config = {
            method,
            url,
            headers,
            timeout: 60000 // 60 seconds timeout
        };

        if (method.toLowerCase() === 'get') {
            config.params = params;
        } else {
            config.data = params;
        }

        const response = await axios(config);
        logMessage(`Response (${response.status}): ${JSON.stringify(response.data, null, 2)}`);

        return response.data;
    } catch (error) {
        const errorMessage = error.response
            ? `API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`
            : `Request Error: ${error.message}`;

        logMessage(`Error: ${errorMessage}`, 'error');
        throw new Error(`Hotel API request failed: ${errorMessage}`);
    }
};

// Hotel API Methods

/**
 * Fetch hotels by city code
 * @param {Object} params - Search parameters
 * @param {string} params.CityCode - City code to search hotels in
 * @param {boolean} [params.IsDetailedResponse=false] - Whether to include detailed response
 * @returns {Promise<Object>} List of hotels
 */
export const fetchHotels = async (params) => {
    const defaultParams = {
        IsDetailedResponse: false,
        TokenId: process.env.TBO_AUTH_TOKEN || ''
    };
    
    const requestParams = { ...defaultParams, ...params };
    return makeHotelRequest('/TBOHotelCodeList', requestParams, 'post', false, true);
};

/**
 * Search hotels with detailed parameters
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} Search results
 */
/**
 * Search hotels with the given parameters
 * @param {Object} params - Search parameters
 * @param {string} params.CityId - City ID to search in
 * @param {string} params.CheckIn - Check-in date (YYYY-MM-DD)
 * @param {string} params.CheckOut - Check-out date (YYYY-MM-DD)
 * @param {Array} params.PaxRooms - Array of room configurations
 * @param {number} [params.ResponseTime=23.0] - Response time limit
 * @param {boolean} [params.IsDetailedResponse=true] - Whether to include detailed response
 * @param {string} [params.GuestNationality='IN'] - Guest nationality code
 * @param {Array} [params.HotelCodes=[]] - Specific hotel codes to search for
 * @returns {Promise<Object>} Search results
 */
export const searchHotels = async (params) => {
    try {
        // Validate required parameters
        if (!params.CityId) {
            throw new Error('CityId is required');
        }
        if (!params.CheckIn) {
            throw new Error('CheckIn date is required');
        }
        if (!params.CheckOut) {
            throw new Error('CheckOut date is required');
        }
        if (!params.PaxRooms || params.PaxRooms.length === 0) {
            throw new Error('At least one room configuration is required');
        }

        // Set default parameters
        const defaultParams = {
            CheckIn: '',
            CheckOut: '',
            CityId: '',
            CountryCode: 'IN',
            GuestNationality: 'IN',
            ResponseTime: 23.0,
            IsDetailedResponse: true,
            HotelCodes: [],
            Filters: {
                Refundable: false,
                NoOfRooms: 1,
                MealType: 0,
                OrderBy: 0,
                StarRating: 0
            }
        };

        // Merge parameters
        const requestParams = { ...defaultParams, ...params };

        // Log the request for debugging
        console.log('Sending hotel search request with params:', JSON.stringify(requestParams, null, 2));

        // Make the API request with authentication
        // The makeHotelRequest function will handle the authentication via headers
        const response = await makeHotelRequest('/Search', requestParams, 'post', false, false);
        
        // Check for error in response
        if (response.Status && response.Status.Code !== 200) {
            throw new Error(response.Status.Description || 'Failed to search hotels');
        }
        
        return response;
    } catch (error) {
        console.error('Error in searchHotels:', error);
        throw error;
    }
};

/**
 * Get detailed information about a specific hotel
 * @param {Object} params - Hotel details parameters
 * @param {string} params.HotelCode - Hotel code to get details for
 * @param {string} params.CheckIn - Check-in date (YYYY-MM-DD)
 * @param {string} params.CheckOut - Check-out date (YYYY-MM-DD)
 * @param {string} [params.GuestNationality=IN] - Guest nationality code
 * @returns {Promise<Object>} Hotel details
 */
export const getHotelDetails = async (params) => {
    const defaultParams = {
        GuestNationality: 'IN',
        TokenId: process.env.TBO_AUTH_TOKEN || ''
    };
    
    const requestParams = { ...defaultParams, ...params };
    return makeHotelRequest('/Hoteldetails', requestParams, 'post', false, true);
};

/**
 * Pre-book a hotel room
 * @param {Object} params - Pre-booking parameters
 * @returns {Promise<Object>} Pre-booking details
 */
export const preBookHotel = async (params) => {
    if (!params.TokenId) {
        params.TokenId = process.env.TBO_AUTH_TOKEN || '';
    }
    return makeHotelRequest('/PreBook', params, 'post', false, true);
};

/**
 * Book a hotel room
 * @param {Object} params - Booking parameters
 * @returns {Promise<Object>} Booking confirmation
 */
export const bookHotel = async (params) => {
    return makeHotelRequest('/Book', params, 'post', true);
};

export const getBookingDetails = async (bookingId) => {
    return makeHotelRequest('/GetBookingDetail', { BookingId: bookingId }, 'post', true);
};

export const getHotelCodeList = async (params) => {
    return makeHotelRequest('/TBOHotelCodeList', params);
};

/**
 * Get available countries
 * @returns {Promise<Object>} List of countries
 */
export const getCountries = async () => {
    return makeHotelRequest('/CountryList', {}, 'post', false, true);
};

/**
 * Get available cities in a country
 * @param {string} countryCode - Country code
 * @returns {Promise<Object>} List of cities
 */
export const getCitiesByCountry = async (countryCode) => {
    try {
        const response = await makeHotelRequest('/CityList', { CountryCode: countryCode }, 'post', false, true);
        
        // The API returns the city list in the response.CityList property
        if (response && response.CityList) {
            return response;
        }
        
        // If the response doesn't have the expected structure, log it and return an empty array
        console.error('Unexpected response format from CityList API:', response);
        return { CityList: [] };
    } catch (error) {
        console.error('Error in getCitiesByCountry:', error);
        return { CityList: [] }; // Return empty array on error
    }
};

/**
 * Get room types
 * @returns {Promise<Object>} List of room types
 */
export const getRoomTypes = async () => {
    return makeHotelRequest('/RoomType', {}, 'post', false, true);
};

export default {
    fetchHotels,
    searchHotels,
    getHotelDetails,
    preBookHotel,
    bookHotel,
    getBookingDetails,
    getHotelCodeList,
    getCountries,
    getCitiesByCountry,
    getRoomTypes
};