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
    username: 'DELG738',
    password: 'Htl@DEL#38/G',
    clientId: 'ApiIntegrationNew',
    baseUrl: 'https://api.tektravels.com',
    logFile: path.join(LOG_DIR, `hotel_${new Date().toISOString().split('T')[0]}.log`),
    endUserIp: '82.112.236.83'
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

// Get authentication token from TBO API
const getAuthToken = async () => {
    try {
        const authUrl = `${CONFIG.baseUrl}/SharedServices/Authentication/Authenticate`;
        const requestBody = {
            ClientId: CONFIG.clientId,
            UserName: CONFIG.username,
            Password: CONFIG.password,
            EndUserIp: CONFIG.endUserIp
        };

        console.log('Authentication request:', {
            url: authUrl,
            requestBody: { ...requestBody, Password: '***' } // Don't log actual password
        });

        const response = await axios.post(
            "https://api.tektravels.com/SharedServices/Authentication/Authenticate",
            requestBody,
            { headers: { "Content-Type": "application/json" } }
        );
        
        console.log(response.data);

        if (response.data && response.data.TokenId) {
            return response.data.TokenId;
        }

        throw new Error(`Authentication failed: ${JSON.stringify(response.data || 'No token in response')}`);
    } catch (error) {
        const errorDetails = {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText,
            responseData: error.response?.data
        };
        
        console.error('Authentication error details:', JSON.stringify(errorDetails, null, 2));
        
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            throw new Error(`Authentication failed with status ${error.response.status}: ${error.response.statusText}`);
        } else if (error.request) {
            // The request was made but no response was received
            throw new Error('No response received from authentication server');
        } else {
            // Something happened in setting up the request that triggered an Error
            throw new Error(`Authentication request error: ${error.message}`);
        }
    }
};

// Make authenticated request to TBO Hotel API
const makeHotelRequest = async (endpoint, params = {}, method = 'post') => {
    try {
        const token = await getAuthToken();
        const url = `${CONFIG.baseUrl}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Token': token
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
    return makeHotelRequest('/TBOHotelCodeList', requestParams, 'post', false);
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

        // Make the API request
        const response = await makeHotelRequest('/Search', requestParams, 'post', false);
        
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
        const response = await makeHotelRequest(
            '/SharedServices/StaticData.svc/GetCityList',
            {
                CountryCode: countryCode,
                ClientId: CONFIG.clientId,
                UserName: CONFIG.username,
                Password: CONFIG.password,
                EndUserIp: CONFIG.endUserIp
            },
            'post'
        );
        
        // The API returns the city list in the response.GetCityListResult.CityList property
        if (response && response.GetCityListResult && response.GetCityListResult.CityList) {
            return { CityList: response.GetCityListResult.CityList };
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