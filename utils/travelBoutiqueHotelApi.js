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

// Get authentication token from TBO API
const getAuthToken = async () => {
    try {
        const authUrl = 'https://api.tbotechnology.in/SharedAPI/SharedData.svc/rest/Authenticate';
        const requestBody = {
            "ClientId": "ApiIntegrationNew",
            "UserName": "DELG738",
            "Password": "Htl@DEL#38/G",
            "EndUserIp": "82.112.236.83"
        };

        console.log('Authentication request:', {
            url: authUrl,
            requestBody: { 
                ...requestBody, 
                Password: '***', // Don't log actual password
            }
        });

        const response = await axios.post(
            authUrl,
            requestBody,
            { 
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
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

        // First, get the authentication token
        const token = await getAuthToken();
        if (!token) {
            throw new Error('Failed to authenticate with TBO API');
        }

        const requestData = {
            CountryCode: countryCode,
            TokenId: token,
            EndUserIp: CONFIG.endUserIp
        };

        console.log('CityList Request:', JSON.stringify({
            ...requestData,
            TokenId: '***' // Don't log the actual token
        }, null, 2));

        const response = await axios.post(
            `${CONFIG.baseUrl}/TBOHolidays_HotelAPI/CityList`,
            requestData,
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 15000
            }
        );

        console.log('CityList API Response:', JSON.stringify(response.data, null, 2));

        // Check for authentication errors
        if (response.data && response.data.Status && response.data.Status.Code === 401) {
            // Clear the auth token and retry once
            authState.tokenId = null;
            return await getCitiesByCountry(countryCode);
        }

        // Handle successful response
        if (response.data && response.data.ResponseStatus && response.data.ResponseStatus.Status === 'Success') {
            return {
                success: true,
                data: response.data.CityList || [],
                status: response.status
            };
        }

        // Handle error response
        if (response.data && response.data.ResponseStatus) {
            return {
                success: false,
                error: {
                    code: response.data.ResponseStatus.ErrorCode || 'API_ERROR',
                    message: response.data.ResponseStatus.Description || 'Failed to fetch cities',
                    response: response.data
                }
            };
        }

        // If we get here, the response format is unexpected
        console.error('Unexpected CityList API response format:', response.data);

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

export {
    getCitiesByCountry,
}