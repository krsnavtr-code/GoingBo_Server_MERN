import axios from 'axios';
import { getAuthToken } from './tboAuth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
    // Base URLs
    FLIGHT_URL_1: 'https://api.travelboutiqueonline.com/AirAPI_V10/AirService.svc/rest/',
    FLIGHT_URL_2: 'https://api.travelboutiqueonline.com/AirAPI_V10/AirService.svc/rest/',
    
    // Logging
    LOG_DIR: path.join(__dirname, '../../logs/TBO/flights'),
    
    // Timeout in milliseconds
    TIMEOUT: 30000
};

// Ensure log directory exists
if (!fs.existsSync(CONFIG.LOG_DIR)) {
    fs.mkdirSync(CONFIG.LOG_DIR, { recursive: true });
}

// Initialize logger if not exists
let logger = console;
try {
    logger = (await import('../utils/logger.js')).default;
} catch (e) {
    console.warn('Using console logger as logger.js is not available');
}

/**
 * Log message to file
 * @param {string} message - The message to log
 * @param {string} [logFilename] - Custom log filename (default: current date)
 */
function logMessage(message, logFilename = null) {
    try {
        const filename = logFilename || `flight_${new Date().toISOString().split('T')[0]}.log`;
        const logPath = path.join(CONFIG.LOG_DIR, filename);
        const timestamp = new Date().toISOString();
        
        fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
    } catch (error) {
        console.error('Error writing to log file:', error);
    }
}

/**
 * Create common parameters for API requests
 * @param {Object} params - Additional parameters to include
 * @returns {Promise<Object>} Parameters with authentication
 */
async function createParams(params = {}) {
    try {
        const token = await getAuthToken();
        return {
            ...params,
            TokenId: token.TokenId,
            EndUserIp: '82.112.236.83', // Default IP, can be overridden by params
            ClientId: process.env.TRAVEL_BOUTIQUE_CLIENT_ID || 'ApiIntegrationNew',
            UserName: process.env.TRAVEL_BOUTIQUE_USERNAME || 'DELG738',
            Password: process.env.TRAVEL_BOUTIQUE_PASSWORD || 'Htl@DEL#38/G',
        };
    } catch (error) {
        logger.error('Failed to create request parameters:', error);
        throw new Error('Failed to authenticate with TBO API');
    }
}

/**
 * Make API request to TBO Flight service
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request data
 * @param {boolean} [useSecondaryUrl=false] - Whether to use the secondary URL
 * @returns {Promise<Object>} API response
 */
async function makeRequest(endpoint, data, useSecondaryUrl = false) {
    const baseUrl = useSecondaryUrl ? CONFIG.FLIGHT_URL_2 : CONFIG.FLIGHT_URL_1;
    const url = `${baseUrl}${endpoint}`;
    
    try {
        // Log request
        const logId = `log_${Date.now()}.txt`;
        logger.info(`TBO API Request [${endpoint}]:`, { url, data });
        logMessage(`Request to ${url}: ${JSON.stringify(data, null, 2)}`, logId);
        
        // Make the request
        const response = await axios.post(url, data, {
            timeout: CONFIG.TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });
        
        // Log successful response
        logger.info(`TBO API Response [${endpoint}]:`, { 
            status: response.status,
            data: response.data 
        });
        logMessage(`Response from ${url}: ${JSON.stringify(response.data, null, 2)}`, logId);
        
        return response.data;
    } catch (error) {
        const errorMessage = `TBO API Error [${endpoint}]: ${error.message}`;
        logger.error(errorMessage, {
            url,
            error: error.response?.data || error.message,
            status: error.response?.status,
            requestData: data,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
        
        logMessage(`Error from ${url}: ${errorMessage}\n${error.stack}`, 'error.log');
        
        // Enhance the error with more context
        const enhancedError = new Error(error.response?.data?.Error?.ErrorMessage || errorMessage);
        enhancedError.code = error.response?.status || 'API_ERROR';
        enhancedError.details = error.response?.data || {};
        throw enhancedError;
    }
}

/**
 * Create flight segment for search
 * @param {string} origin - Origin airport code
 * @param {string} destination - Destination airport code
 * @param {string} cabinClass - Cabin class
 * @param {string} date - Departure date (YYYY-MM-DD)
 * @returns {Object} Flight segment
 */
function createFlightSegment(origin, destination, cabinClass, date) {
    return {
        Origin: origin.toUpperCase(),
        Destination: destination.toUpperCase(),
        FlightCabinClass: cabinClass || '2', // Default to Economy
        PreferredDepartureTime: `${date}T00:00:00`
    };
}

/**
 * Search for flights
 * @param {Object} params - Search parameters
 * @param {string} params.origin - Origin airport code (e.g., 'DEL')
 * @param {string} params.destination - Destination airport code (e.g., 'BOM')
 * @param {string} [params.travelclass='2'] - Cabin class (1: All, 2: Economy, 3: Premium Economy, etc.)
 * @param {string} params.departure_date - Departure date (YYYY-MM-DD)
 * @param {string} [params.return_date] - Return date for round trips (YYYY-MM-DD)
 * @param {number} [params.adults=1] - Number of adults (1-9)
 * @param {number} [params.children=0] - Number of children (0-9)
 * @param {number} [params.infants=0] - Number of infants (0-9)
 * @param {number} [params.journey_type=1] - 1 for one-way, 2 for round-trip
 * @returns {Promise<Object>} Flight search results
 */
async function searchFlights(params) {
    try {
        // Input validation
        if (!params.origin || !params.destination || !params.departure_date) {
            throw new Error('Missing required parameters: origin, destination, and departure_date are required');
        }

        // Parse and validate passenger counts
        const adultCount = Math.min(Math.max(parseInt(params.adults) || 1, 1), 9);
        const childCount = Math.min(Math.max(parseInt(params.children) || 0, 0), 9);
        const infantCount = Math.min(Math.max(parseInt(params.infants) || 0, 0), 9);
        const journeyType = parseInt(params.journey_type) === 2 ? 2 : 1;

        if (infantCount > adultCount) {
            throw new Error('Number of infants cannot exceed number of adults');
        }

        // Create segments array
        const segments = [
            createFlightSegment(
                params.origin,
                params.destination,
                params.travelclass,
                params.departure_date
            )
        ];

        // Add return segment for round trips
        if (journeyType === 2 && params.return_date) {
            segments.push(
                createFlightSegment(
                    params.destination,
                    params.origin,
                    params.travelclass,
                    params.return_date
                )
            );
        }

        // Prepare request payload
        const requestData = await createParams({
            AdultCount: adultCount,
            ChildCount: childCount,
            InfantCount: infantCount,
            JourneyType: journeyType,
            Segments: segments,
            Sources: null,
            DirectFlight: false,
            OneStopFlight: false,
            PreferredAirlines: null,
            PreferredCurrency: 'INR',
            ResultCount: 100
        });

        // Log the request
        logger.info('Searching flights with params:', {
            params: {
                ...params,
                adultCount,
                childCount,
                infantCount,
                journeyType
            },
            requestData
        });

        // Make the API call
        const response = await makeRequest('Search', requestData);
        
        // Process the response
        if (response && response.Response && response.Response.Results) {
            const results = Array.isArray(response.Response.Results) 
                ? response.Response.Results 
                : [response.Response.Results];

            return {
                success: true,
                data: {
                    results,
                    traceId: response.Response.TraceId,
                    resultIndex: results[0]?.ResultIndex,
                    isDomestic: response.Response.IsDomestic,
                    isLCC: response.Response.IsLCC,
                    isRefundable: response.Response.IsRefundable
                }
            };
        }

        throw new Error(response?.Response?.Error?.ErrorMessage || 'No results found');
    } catch (error) {
        logger.error('Flight search failed:', {
            error: error.message,
            stack: error.stack,
            params
        });
        
        // Enhance error with more context
        const enhancedError = new Error(`Flight search failed: ${error.message}`);
        enhancedError.code = error.code || 'FLIGHT_SEARCH_ERROR';
        enhancedError.details = error.details || error.response?.data;
        throw enhancedError;
        return {
            success: false,
            message: response.Response.Error.ErrorMessage,
            code: 'API_ERROR'
        };
    }
}

/**
 * Get fare rules for a flight
 * @param {string} resultIndex - Result index from search
 * @param {string} traceId - Trace ID from search
 * @returns {Promise<Object>} Fare rules
 */
async function getFareRules(resultIndex, traceId) {
    const params = await createParams({
        ResultIndex: resultIndex,
        TraceId: traceId
    });
    
    const response = await makeRequest('FareRule', params);
    return response.Response?.FareRules || null;
}

/**
 * Get fare quote for a flight
 * @param {string} resultIndex - Result index from search
 * @param {string} traceId - Trace ID from search
 * @returns {Promise<Object>} Fare quote
 */
async function getFareQuote(resultIndex, traceId) {
    const params = await createParams({
        ResultIndex: resultIndex,
        TraceId: traceId
    });
    
    const response = await makeRequest('FareQuote', params);
    return response.Response?.Results || null;
}

/**
 * Get SSR (Special Service Requests) for a flight
 * @param {string} resultIndex - Result index from search
 * @param {string} traceId - Trace ID from search
 * @returns {Promise<Object>} SSR details
 */
async function getSSRDetails(resultIndex, traceId) {
    const params = await createParams({
        ResultIndex: resultIndex,
        TraceId: traceId
    });
    
    const response = await makeRequest('SSR', params);
    return response.Response || null;
}

/**
 * Book a flight
 * @param {Object} bookingData - Booking data
 * @returns {Promise<Object>} Booking response
 */
async function bookFlight(bookingData) {
    const params = await createParams(bookingData);
    const response = await makeRequest('Book', params, true); // Use secondary URL for booking
    return response.Response || null;
}

/**
 * Confirm flight ticket
 * @param {Object} params - Confirmation parameters
 * @param {string} [params.trace] - Trace ID
 * @param {string} [params.PNR] - PNR number
 * @param {string} [params.BookingId] - Booking ID
 * @param {string} [params.ResultIndex] - Result index
 * @param {Array} [params.Passengers] - Passenger details
 * @returns {Promise<Object>} Confirmation response
 */
async function confirmTicket(params) {
    let requestData;
    
    if (params.PNR) {
        requestData = await createParams({
            TraceId: params.trace,
            PNR: params.PNR,
            BookingId: params.BookingId
        });
    } else {
        requestData = await createParams({
            TraceId: params.trace,
            ResultIndex: params.ResultIndex,
            Passengers: params.Passengers
        });
    }
    
    const response = await makeRequest('Ticket', requestData, true); // Use secondary URL for ticket confirmation
    return response.Response || null;
}

/**
 * Get booking details
 * @param {Object} params - Booking details parameters
 * @param {string} params.BookingId - Booking ID
 * @returns {Promise<Object>} Booking details
 */
async function getBookingDetails(params) {
    const requestData = await createParams(params);
    const response = await makeRequest('GetBookingDetails', requestData, true);
    return response.Response || null;
}

/**
 * Get cancellation charges
 * @param {Object} params - Cancellation parameters
 * @returns {Promise<Object>} Cancellation charges
 */
async function getCancellationCharges(params) {
    const requestData = await createParams(params);
    const response = await makeRequest('GetCancellationCharges', requestData, true);
    return response.Response || null;
}

/**
 * Cancel booking
 * @param {Object} params - Cancellation parameters
 * @returns {Promise<Object>} Cancellation response
 */
async function cancelBooking(params) {
    const requestData = await createParams(params);
    const response = await makeRequest('SendChangeRequest', requestData, true);
    return response.Response || null;
}

/**
 * Get cancellation status
 * @param {Object} params - Status parameters
 * @returns {Promise<Object>} Cancellation status
 */
async function getCancellationStatus(params) {
    const requestData = await createParams(params);
    const response = await makeRequest('GetChangeRequestStatus', requestData, true);
    return response.Response || null;
}

export {
    searchFlights,
    getFareRules,
    getFareQuote,
    getSSRDetails,
    bookFlight,
    confirmTicket,
    getBookingDetails,
    getCancellationCharges,
    cancelBooking,
    getCancellationStatus,
    logMessage
};
