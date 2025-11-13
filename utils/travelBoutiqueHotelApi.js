import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get list of all available countries
 * @returns {Promise<Object>} Object containing status and list of countries
 */
const getCountries = async () => {
    try {
        const response = await axios.get(
            `${CONFIG.baseUrl}/TBOHolidays_HotelAPI/CountryList`,
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        if (response.data && response.data.CountryList) {
            return {
                success: true,
                data: response.data.CountryList,
                status: response.status
            };
        }

        return {
            success: false,
            error: {
                code: 'INVALID_RESPONSE',
                message: 'Invalid response format from CountryList API'
            }
        };
    } catch (error) {
        console.error('Error in getCountries:', error);
        return {
            success: false,
            error: {
                code: error.response?.status || 'REQUEST_FAILED',
                message: error.message || 'Failed to fetch countries'
            }
        };
    }
};

/**
 * Get list of cities for a specific country
 * @param {string} countryCode - ISO country code (e.g., 'IN' for India)
 * @returns {Promise<Object>} Object containing status and list of cities
 */
const getCitiesByCountry = async (countryCode) => {
    try {
        if (!countryCode) {
            console.error('Country code is required for city search');
            return {
                success: false,
                error: {
                    code: 'MISSING_PARAMETER',
                    message: 'Country code is required'
                }
            };
        }

        console.log(`Fetching cities for country code: ${countryCode}`);
        
        const requestData = {
            CountryCode: countryCode,
            TokenId: '',  // Empty as per TBO documentation for static data
            EndUserIp: CONFIG.endUserIp
        };

        console.log('CityList Request:', JSON.stringify(requestData, null, 2));

        const response = await axios.post(
            `${CONFIG.baseUrl}/TBOHolidays_HotelAPI/CityList`,
            requestData,
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        console.log('CityList API Response:', JSON.stringify(response.data, null, 2));

        // Handle different response formats
        if (response.data) {
            // Check if we have a valid response with data
            if (response.data.Response && response.data.Response.CityList) {
                return {
                    success: true,
                    data: response.data.Response.CityList,
                    status: response.status
                };
            }
            // Try alternative response format
            else if (response.data.CityList) {
                return {
                    success: true,
                    data: response.data.CityList,
                    status: response.status
                };
            }
            
            // If we have data but couldn't find city list, log the full response
            console.error('Unexpected CityList API response format:', response.data);
        }

        return {
            success: false,
            error: {
                code: 'INVALID_RESPONSE',
                message: 'Invalid response format from CityList API',
                response: response.data
            }
        };
    } catch (error) {
        console.error('Error in getCitiesByCountry:', error);
        return {
            success: false,
            error: {
                code: error.response?.status || 'REQUEST_FAILED',
                message: error.message || 'Failed to fetch cities'
            }
        };
    }
};

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
// Store authentication state
let authState = {
    tokenId: null,
    tokenAgencyId: null,
    tokenMemberId: null
};

const CONFIG = {
    // TBO API credentials
    username: 'DELG738',
    password: 'Htl@DEL#38/G',
    clientId: 'ApiIntegrationNew',
    
    // API endpoints
    baseUrl: 'https://api.tbotechnology.in',
    sharedApiUrl: 'http://Sharedapi.tektravels.com/SharedData.svc/rest',
    
    // Static data API credentials (for CountryList, CityList, etc.)
    staticApiUsername: 'DELG738',
    staticApiPassword: 'Htl@DEL#38/G',
    
    // Logging
    logFile: path.join(LOG_DIR, `hotel_${new Date().toISOString().split('T')[0]}.log`),
    
    // Client information
    endUserIp: '82.112.236.83',
    
    // Timeouts (in ms)
    defaultTimeout: 15000,
    authTimeout: 10000
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
        const authUrl = `http://Sharedapi.tektravels.com/SharedData.svc/rest/Authenticate`;
        const requestBody = {
            ClientId: CONFIG.clientId,
            UserName: CONFIG.username,
            Password: CONFIG.password,
            EndUserIp: CONFIG.endUserIp
        };

        console.log('Authentication request:', {
            url: authUrl,
            requestBody: { 
                ...requestBody, 
                Password: '***', // Don't log actual password
            }
        });

        // Create Basic Auth token for static data API
        const authToken = Buffer.from(`${CONFIG.staticApiUsername}:${CONFIG.staticApiPassword}`).toString('base64');

        const response = await axios.post(
            authUrl,
            requestBody,
            { 
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Basic ${authToken}`
                },
                timeout: 10000
            }
        );
        
        console.log('Authentication response:', {
            status: response.status,
            statusText: response.statusText,
            data: response.data
        });

        if (response.data && response.data.Status === 1 && response.data.TokenId) {
            // Store authentication details
            authState = {
                tokenId: response.data.TokenId,
                tokenAgencyId: response.data.Member?.AgencyId,
                tokenMemberId: response.data.Member?.MemberId
            };
            return response.data.TokenId;
        }
        
        // If we get here, authentication failed
        const errorMessage = response.data?.Error?.ErrorMessage || 'Authentication failed';
        console.error('Authentication failed:', errorMessage);
        throw new Error(errorMessage);

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


/**
 * Get list of hotels for a specific city
 * @param {number} cityCode - TBO City code
 * @returns {Promise<Object>} Object containing status and hotel list
 */
export const getTBOHotelCodeList = async (cityCode) => {
    try {
        if (!cityCode) {
            return {
                success: false,
                error: {
                    code: 'MISSING_PARAMETER',
                    message: 'City code is required'
                }
            };
        }

        const response = await axios.post(
            `${CONFIG.baseUrl}/TBOHolidays_HotelAPI/TBOHotelCodeList`,
            { CityCode: parseInt(cityCode) },
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // Give more time for hotel list requests
            }
        );

        if (response.data && response.data.Hotels) {
            return {
                success: true,
                data: response.data.Hotels,
                status: response.status
            };
        }

        return {
            success: false,
            error: {
                code: 'INVALID_RESPONSE',
                message: 'Invalid response format from TBOHotelCodeList API'
            }
        };
    } catch (error) {
        console.error('Error in getTBOHotelCodeList:', error);
        return {
            success: false,
            error: {
                code: error.response?.status || 'REQUEST_FAILED',
                message: error.message || 'Failed to fetch hotel list'
            }
        };
    }
};

/**
 * Get detailed information about a specific hotel
 * @param {number} hotelCode - TBO Hotel code
 * @param {string} [language='EN'] - Language code (e.g., 'EN', 'AR', 'FR')
 * @param {boolean} [includeRoomDetails=true] - Whether to include room details
 * @returns {Promise<Object>} Hotel details
 */
export const getHotelDetails = async (hotelCode, language = 'EN', includeRoomDetails = true) => {
    try {
        if (!hotelCode) {
            return {
                success: false,
                error: {
                    code: 'MISSING_PARAMETER',
                    message: 'Hotel code is required'
                }
            };
        }

        const response = await axios.post(
            `${CONFIG.baseUrl}/TBOHolidays_HotelAPI/Hoteldetails`,
            {
                'Hotel Code': parseInt(hotelCode),
                'Language': language.toUpperCase(),
                'IsRoomDetailRequired': includeRoomDetails ? 'true' : 'false'
            },
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // Give more time for detailed hotel info
            }
        );

        if (response.data && response.data.HotelDetails) {
            return {
                success: true,
                data: response.data.HotelDetails,
                status: response.status
            };
        }

        return {
            success: false,
            error: {
                code: 'INVALID_RESPONSE',
                message: 'Invalid response format from HotelDetails API'
            }
        };
    } catch (error) {
        console.error('Error in getHotelDetails:', error);
        return {
            success: false,
            error: {
                code: error.response?.status || 'REQUEST_FAILED',
                message: error.message || 'Failed to fetch hotel details'
            }
        };
    }
};

/**
 * Search for hotels based on the given parameters
 * @param {Object} params - Search parameters
 * @param {string} params.CheckIn - Check-in date (YYYY-MM-DD)
 * @param {string} params.CheckOut - Check-out date (YYYY-MM-DD)
 * @param {string} params.CityId - City ID
 * @param {string} params.CountryCode - Country code
 * @param {string} params.GuestNationality - Guest nationality code
 * @param {number} params.ResponseTime - Response time in seconds
 * @param {boolean} params.IsDetailedResponse - Whether to include detailed response
 * @param {Array} params.HotelCodes - List of hotel codes
 * @param {Object} params.Filters - Filter options
 * @param {boolean} params.Filters.Refundable - Whether to include refundable hotels
 * @param {number} params.Filters.NoOfRooms - Number of rooms
 * @param {number} params.Filters.MealType - Meal type
 * @param {number} params.Filters.OrderBy - Order by
 * @param {number} params.Filters.StarRating - Star rating
 * @returns {Promise<Object>} Search results
 */
export const searchHotels = async (params) => {
    try {
        const defaultParams = {
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
        const response = await axios.post(
            `${CONFIG.baseUrl}/TBOHolidays_HotelAPI/Search`,
            requestParams,
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // Give more time for hotel search
            }
        );

        // Check for error in response
        if (response.data && response.data.Status && response.data.Status.Code !== 200) {
            throw new Error(response.data.Status.Description || 'Failed to search hotels');
        }

        return {
            success: true,
            data: response.data,
            status: response.status
        };
    } catch (error) {
        console.error('Error in searchHotels:', error);
        return {
            success: false,
            error: {
                code: error.response?.status || 'REQUEST_FAILED',
                message: error.message || 'Failed to search hotels'
            }
        };
    }
};

/**
 * Fetch hotels based on the given parameters
 * @param {Object} params - Fetch parameters
 * @param {string} params.CheckIn - Check-in date (YYYY-MM-DD)
 * @param {string} params.CheckOut - Check-out date (YYYY-MM-DD)
 * @param {string} params.CityId - City ID
 * @param {string} params.CountryCode - Country code
 * @param {string} params.GuestNationality - Guest nationality code
 * @param {number} params.ResponseTime - Response time in seconds
 * @param {boolean} params.IsDetailedResponse - Whether to include detailed response
 * @param {Array} params.HotelCodes - List of hotel codes
 * @param {Object} params.Filters - Filter options
 * @param {boolean} params.Filters.Refundable - Whether to include refundable hotels
 * @param {number} params.Filters.NoOfRooms - Number of rooms
 * @param {number} params.Filters.MealType - Meal type
 * @param {number} params.Filters.OrderBy - Order by
 * @param {number} params.Filters.StarRating - Star rating
 * @returns {Promise<Object>} Fetch results
 */
export const fetchHotels = async (params) => {
    try {
        const defaultParams = {
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
        console.log('Sending hotel fetch request with params:', JSON.stringify(requestParams, null, 2));

        // Make the API request
        const response = await axios.post(
            `${CONFIG.baseUrl}/TBOHolidays_HotelAPI/Fetch`,
            requestParams,
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // Give more time for hotel fetch
            }
        );

        // Check for error in response
        if (response.data && response.data.Status && response.data.Status.Code !== 200) {
            throw new Error(response.data.Status.Description || 'Failed to fetch hotels');
        }

        return {
            success: true,
            data: response.data,
            status: response.status
        };
    } catch (error) {
        console.error('Error in fetchHotels:', error);
        return {
            success: false,
            error: {
                code: error.response?.status || 'REQUEST_FAILED',
                message: error.message || 'Failed to fetch hotels'
            }
        };
    }
};

/**
 * Pre-book a hotel room
 * @param {Object} params - Pre-booking parameters
 * @returns {Promise<Object>} Pre-booking details
 */
export const preBookHotel = async (params) => {
    try {
        if (!params.TokenId) {
            params.TokenId = process.env.TBO_AUTH_TOKEN || '';
        }

        // Make the API request
        const response = await axios.post(
            `${CONFIG.baseUrl}/TBOHolidays_HotelAPI/PreBook`,
            params,
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // Give more time for pre-booking
            }
        );

        // Check for error in response
        if (response.data && response.data.Status && response.data.Status.Code !== 200) {
            throw new Error(response.data.Status.Description || 'Failed to pre-book hotel');
        }

        return {
            success: true,
            data: response.data,
            status: response.status
        };
    } catch (error) {
        console.error('Error in preBookHotel:', error);
        return {
            success: false,
            error: {
                code: error.response?.status || 'REQUEST_FAILED',
                message: error.message || 'Failed to pre-book hotel'
            }
        };
    }
};

/**
 * Book a hotel room
 * @param {Object} params - Booking parameters
 * @returns {Promise<Object>} Booking confirmation
 */
export const bookHotel = async (params) => {
    try {
        // Make the API request
        const response = await axios.post(
            `${CONFIG.baseUrl}/TBOHolidays_HotelAPI/Book`,
            params,
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // Give more time for booking
            }
        );

        // Check for error in response
        if (response.data && response.data.Status && response.data.Status.Code !== 200) {
            throw new Error(response.data.Status.Description || 'Failed to book hotel');
        }

        return {
            success: true,
            data: response.data,
            status: response.status
        };
    } catch (error) {
        console.error('Error in bookHotel:', error);
        return {
            success: false,
            error: {
                code: error.response?.status || 'REQUEST_FAILED',
                message: error.message || 'Failed to book hotel'
            }
        };
    }
};

/**
 * Get booking details
 * @param {string} bookingId - Booking ID
 * @returns {Promise<Object>} Booking details
 */
export const getBookingDetails = async (bookingId) => {
    try {
        // Make the API request
        const response = await axios.post(
            `${CONFIG.baseUrl}/TBOHolidays_HotelAPI/GetBookingDetail`,
            { BookingId: bookingId },
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // Give more time for booking details
            }
        );

        // Check for error in response
        if (response.data && response.data.Status && response.data.Status.Code !== 200) {
            throw new Error(response.data.Status.Description || 'Failed to get booking details');
        }

        return {
            success: true,
            data: response.data,
            status: response.status
        };
    } catch (error) {
        console.error('Error in getBookingDetails:', error);
        return {
            success: false,
            error: {
                code: error.response?.status || 'REQUEST_FAILED',
                message: error.message || 'Failed to get booking details'
            }
        };
    }
};

/**
 * Get room types
 * @returns {Promise<Object>} List of room types
 */
export const getRoomTypes = async () => {
    try {
        // Make the API request
        const response = await axios.get(
            `${CONFIG.baseUrl}/TBOHolidays_HotelAPI/RoomType`,
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        // Check for error in response
        if (response.data && response.data.Status && response.data.Status.Code !== 200) {
            throw new Error(response.data.Status.Description || 'Failed to get room types');
        }

        return {
            success: true,
            data: response.data,
            status: response.status
        };
    } catch (error) {
        console.error('Error in getRoomTypes:', error);
        return {
            success: false,
            error: {
                code: error.response?.status || 'REQUEST_FAILED',
                message: error.message || 'Failed to get room types'
            }
        };
    }
};

/**
 * Logout from TBO API and invalidate the current session
 * @returns {Promise<Object>} Logout response
 */
export const logout = async () => {
    try {
        if (!authState.tokenId) {
            console.log('No active session to logout');
            return { Status: 1, Error: { ErrorCode: 0, ErrorMessage: 'No active session' } };
        }

        // Make the API request
        const response = await axios.post(
            `${CONFIG.sharedApiUrl}/Logout`,
            {
                ClientId: CONFIG.clientId,
                TokenAgencyId: authState.tokenAgencyId,
                TokenMemberId: authState.tokenMemberId,
                EndUserIp: CONFIG.endUserIp,
                TokenId: authState.tokenId
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000
            }
        );

        // Clear auth state regardless of the response
        const previousState = { ...authState };
        authState = { tokenId: null, tokenAgencyId: null, tokenMemberId: null };

        console.log('Logged out successfully');
        return response.data || { Status: 1, Error: { ErrorCode: 0, ErrorMessage: 'Logged out successfully' } };
    } catch (error) {
        console.error('Error during logout:', error.message);
        // Still clear the auth state even if logout fails
        authState = { tokenId: null, tokenAgencyId: null, tokenMemberId: null };

        if (error.response) {
            return {
                Status: 2,
                Error: {
                    ErrorCode: error.response.status,
                    ErrorMessage: error.response.statusText || 'Logout failed'
                }
            };
        }

        return {
            Status: 2,
            Error: {
                ErrorCode: -1,
                ErrorMessage: error.message || 'Unknown error during logout'
            }
        };
    }
};

/**
 * Get agency balance information
 * @returns {Promise<Object>} Agency balance details
 */
export const getAgencyBalance = async () => {
    try {
        if (!authState.tokenId || !authState.tokenAgencyId || !authState.tokenMemberId) {
            throw new Error('Not authenticated. Please authenticate first.');
        }

        // Make the API request
        const response = await axios.post(
            `${CONFIG.sharedApiUrl}/GetAgencyBalance`,
            {
                ClientId: CONFIG.clientId,
                TokenAgencyId: authState.tokenAgencyId,
                TokenMemberId: authState.tokenMemberId,
                EndUserIp: CONFIG.endUserIp,
                TokenId: authState.tokenId
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000
            }
        );

        // Log the response for debugging
        console.log('Agency balance response:', {
            status: response.status,
            data: response.data
        });

        if (response.data && response.data.Status === 1) {
            return {
                success: true,
                data: {
                    agencyType: response.data.AgencyType,
                    cashBalance: response.data.CashBalance,
                    creditBalance: response.data.CreditBalance,
                    status: response.data.Status,
                    error: response.data.Error || null
                }
            };
        }

        return {
            success: false,
            error: response.data?.Error || { ErrorCode: -1, ErrorMessage: 'Failed to get agency balance' }
        };
    } catch (error) {
        console.error('Error getting agency balance:', error.message);

        if (error.response) {
            return {
                success: false,
                error: {
                    ErrorCode: error.response.status,
                    ErrorMessage: error.response.statusText || 'Failed to get agency balance'
                }
            };
        }

        return {
            success: false,
            error: {
                ErrorCode: -1,
                ErrorMessage: error.message || 'Unknown error while getting agency balance'
            }
        };
    }
};


export {
    getCitiesByCountry,
}