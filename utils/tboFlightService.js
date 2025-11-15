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
    FLIGHT_URL_1: 'https://tboapi.travelboutiqueonline.com/AirAPI_V10/AirService.svc/rest/',
    FLIGHT_URL_2: 'https://booking.travelboutiqueonline.com/AirAPI_V10/AirService.svc/rest/',
    
    // Logging
    LOG_DIR: path.join(__dirname, '../../logs/TBO/flights'),
    
    // Timeout in milliseconds
    TIMEOUT: 30000,

    // Default values
    DEFAULT_CABIN_CLASS: '2', // 2: Economy, 3: Premium Economy, 4: Business, etc.
    DEFAULT_CURRENCY: 'INR',
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000 // 1 second
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
 * @param {string} [level='info'] - Log level (info, error, warn, debug)
 */
function logMessage(message, logFilename = null, level = 'info') {
    try {
        const filename = logFilename || `flight_${new Date().toISOString().split('T')[0]}.log`;
        const logPath = path.join(CONFIG.LOG_DIR, filename);
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
        
        // Log to file
        fs.appendFileSync(logPath, logEntry);

        // Log to console based on level
        switch (level.toLowerCase()) {
            case 'error':
                logger.error(message);
                break;
            case 'warn':
                logger.warn(message);
                break;
            case 'debug':
                logger.debug(message);
                break;
            default:
                logger.info(message);
        }
    } catch (error) {
        console.error('Error writing to log file:', error);
    }
}

/**
 * Create common parameters for API requests with retry mechanism
 * @param {Object} params - Additional parameters to include
 * @param {number} [attempt=1] - Current retry attempt
 * @returns {Promise<Object>} Parameters with authentication
 */
async function createParams(params = {}, attempt = 1) {
    try {
        const token = await getAuthToken();
        if (!token || !token.TokenId) {
            throw new Error('Invalid or missing authentication token');
        }

        return {
            ...params,
            TokenId: token.TokenId,
            EndUserIp: params.EndUserIp || '82.112.236.83', // Default IP or from request
            ClientId: 'tboprod', // Default client ID
            PreferredCurrency: params.PreferredCurrency || CONFIG.DEFAULT_CURRENCY
        };
    } catch (error) {
        if (attempt <= CONFIG.MAX_RETRIES) {
            logMessage(`Retry ${attempt}/${CONFIG.MAX_RETRIES} - Failed to create params: ${error.message}`, null, 'warn');
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
            return createParams(params, attempt + 1);
        }

        const errorMsg = `Failed to create request parameters after ${CONFIG.MAX_RETRIES} attempts: ${error.message}`;
        logMessage(errorMsg, null, 'error');
        throw new Error(errorMsg);
    }
}


/**
 * Make API request to TBO Flight service with retry mechanism
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request data
 * @param {boolean} [useSecondaryUrl=false] - Whether to use the secondary URL
 * @param {number} [attempt=1] - Current retry attempt
 * @returns {Promise<Object>} API response
 */
async function makeRequest(endpoint, data, useSecondaryUrl = false, attempt = 1) {
    const baseUrl = useSecondaryUrl ? CONFIG.FLIGHT_URL_2 : CONFIG.FLIGHT_URL_1;
    const url = `${baseUrl}${endpoint}`;
    const logId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}.log`;
    
    try {
        // Log request
        const logContext = {
            endpoint,
            url,
            attempt,
            timestamp: new Date().toISOString()
        };

        logMessage(`[${endpoint}] Request (Attempt ${attempt}): ${JSON.stringify(data, null, 2)}`, logId, 'debug');
        logger.debug('TBO API Request:', { ...logContext, data: JSON.stringify(data).substring(0, 500) + '...' });
        
        // Make the request
        const response = await axios.post(url, data, {
            timeout: CONFIG.TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Request-ID': logId
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });
        
        // Log successful response
        logMessage(`[${endpoint}] Response: ${JSON.stringify(response.data, null, 2)}`, logId, 'debug');

        // Check for API-level errors
        if (response.data && response.data.Response && response.data.Response.Error) {
            const apiError = response.data.Response.Error;
            if (apiError.ErrorCode !== 0 && apiError.ErrorCode !== '0') {
                throw new Error(`TBO API Error [${apiError.ErrorCode}]: ${apiError.ErrorMessage}`);
            }
        }
        
        return response.data;
    } catch (error) {
        // Check if we should retry
        const isNetworkError = !error.response;
        const isServerError = error.response && error.response.status >= 500;
        const isRateLimit = error.response && error.response.status === 429;
        
        if ((isNetworkError || isServerError || isRateLimit) && attempt < CONFIG.MAX_RETRIES) {
            const retryDelay = isRateLimit
                ? 5000 // Longer delay for rate limits
                : CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1); // Exponential backoff

            logMessage(
                `Retry ${attempt}/${CONFIG.MAX_RETRIES} for ${endpoint} after ${retryDelay}ms: ${error.message}`,
                logId,
                'warn'
            );

            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return makeRequest(endpoint, data, useSecondaryUrl, attempt + 1);
        }

        // Log final error
        const errorDetails = {
            message: error.message,
            code: error.code || (error.response ? error.response.status : 'NETWORK_ERROR'),
            endpoint,
            attempt,
            response: error.response ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            } : null
        };

        logMessage(
            `API Error [${endpoint}]: ${JSON.stringify(errorDetails, null, 2)}\n${error.stack}`,
            'error.log',
            'error'
        );
        
        // Enhance the error with more context
        const enhancedError = new Error(
            error.response?.data?.Error?.ErrorMessage ||
            error.response?.data?.message ||
            error.message || 'Unknown API error'
        );

        enhancedError.code = error.response?.status || error.code || 'API_ERROR';
        enhancedError.details = error.response?.data || {};
        enhancedError.isRetryable = isNetworkError || isServerError || isRateLimit;

        throw enhancedError;
    }
}

/**
 * Create flight segment for search with validation
 * @param {string} origin - Origin airport code (3-letter IATA code)
 * @param {string} destination - Destination airport code (3-letter IATA code)
 * @param {string|number} [cabinClass] - Cabin class (1-6, defaults to 2 for Economy)
 * @param {string} date - Departure date (YYYY-MM-DD)
 * @returns {Object} Flight segment
 * @throws {Error} If validation fails
 */
function createFlightSegment(origin, destination, cabinClass = CONFIG.DEFAULT_CABIN_CLASS, date) {
    // Validate airport codes
    if (!origin || !destination || typeof origin !== 'string' || typeof destination !== 'string') {
        throw new Error('Origin and destination are required and must be strings');
    }

    if (origin.length !== 3 || destination.length !== 3) {
        throw new Error('Origin and destination must be 3-letter IATA airport codes');
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
    if (!date || !dateRegex.test(date)) {
        throw new Error('Invalid date format. Please use YYYY-MM-DD');
    }

    // Normalize cabin class
    const normalizedCabinClass = String(cabinClass || CONFIG.DEFAULT_CABIN_CLASS);
    const validCabinClasses = ['1', '2', '3', '4', '5', '6'];
    if (!validCabinClasses.includes(normalizedCabinClass)) {
        throw new Error(`Invalid cabin class: ${cabinClass}. Must be one of: ${validCabinClasses.join(', ')}`);
    }

    // Create and return the segment
    const segment = {
        Origin: origin.trim().toUpperCase(),
        Destination: destination.trim().toUpperCase(),
        FlightCabinClass: normalizedCabinClass,
        PreferredDepartureTime: `${date}T00:00:00`,
        PreferredArrivalTime: `${date}T00:00:00`,
        // Additional segment metadata
        SegmentId: `seg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        CreatedAt: new Date().toISOString()
    };

    return segment;
}


/**
 * Search for flights with comprehensive validation and filtering
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
 * @param {Array<string>} [params.preferredAirlines] - Preferred airline codes (e.g., ['AI', 'UK'])
 * @param {boolean} [params.directOnly=false] - Return only direct flights
 * @param {boolean} [params.oneStopOnly=false] - Return flights with maximum one stop
 * @param {string} [params.currency='INR'] - Preferred currency
 * @param {number} [params.maxResults=100] - Maximum number of results to return (1-100)
 * @returns {Promise<Object>} Flight search results
 */
async function searchFlights(params) {
    const startTime = Date.now();
    const searchId = `search_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

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
        const maxResults = Math.min(Math.max(parseInt(params.maxResults) || 100, 1), 100);

        // Validate passenger configuration
        if (infantCount > adultCount) {
            throw new Error('Number of infants cannot exceed number of adults');
        }

        if (adultCount + childCount + infantCount > 9) {
            throw new Error('Total number of passengers cannot exceed 9');
        }

        // Validate dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const departureDate = new Date(params.departure_date);
        if (isNaN(departureDate.getTime()) || departureDate < today) {
            throw new Error('Invalid or past departure date');
        }

        let returnDate = null;
        if (journeyType === 2) {
            if (!params.return_date) {
                throw new Error('Return date is required for round-trip flights');
            }

            returnDate = new Date(params.return_date);
            if (isNaN(returnDate.getTime()) || returnDate < departureDate) {
                throw new Error('Return date must be after departure date');
            }

            // Check if return is within 1 year
            const oneYearFromNow = new Date();
            oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
            if (returnDate > oneYearFromNow) {
                throw new Error('Return date cannot be more than 1 year in the future');
            }
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
        if (journeyType === 2 && returnDate) {
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
            DirectFlight: Boolean(params.directOnly),
            OneStopFlight: Boolean(params.oneStopOnly),
            PreferredAirlines: Array.isArray(params.preferredAirlines) && params.preferredAirlines.length > 0
                ? params.preferredAirlines.join(',')
                : null,
            PreferredCurrency: params.currency || CONFIG.DEFAULT_CURRENCY,
            ResultCount: maxResults,
            IsRefundable: params.refundableOnly || false,
            IsLCC: params.lccOnly || false
        });

        // Log the search request
        logMessage(`[${searchId}] Starting flight search: ${params.origin} to ${params.destination} on ${params.departure_date}`, null, 'info');
        logger.debug('Flight search request:', {
            searchId, 
            params: {
                ...params,
                adultCount,
                childCount,
                infantCount,
                journeyType,
                maxResults
            },
            requestData: {
                ...requestData,
                TokenId: '***REDACTED***' // Don't log the actual token
            }
        });

        // Make the API call
        const response = await makeRequest('Search', requestData);
        const responseTime = Date.now() - startTime;
        
        // Process the response
        if (response && response.Response) {
            const results = Array.isArray(response.Response.Results) 
                ? response.Response.Results 
                : response.Response.Results ? [response.Response.Results] : [];

            // Log search completion
            logMessage(
                `[${searchId}] Search completed in ${responseTime}ms. Found ${results.length} results.`,
                null,
                'info'
            );

            // Prepare the response
            const result = {
                success: true,
                searchId,
                data: {
                    results: results.slice(0, maxResults),
                    traceId: response.Response.TraceId,
                    resultIndex: results[0]?.ResultIndex,
                    isDomestic: response.Response.IsDomestic,
                    isLCC: response.Response.IsLCC,
                    isRefundable: response.Response.IsRefundable,
                    currency: params.currency || CONFIG.DEFAULT_CURRENCY,
                    searchParams: {
                        origin: params.origin,
                        destination: params.destination,
                        departureDate: params.departure_date,
                        returnDate: params.return_date,
                        adults: adultCount,
                        children: childCount,
                        infants: infantCount,
                        cabinClass: params.travelclass || CONFIG.DEFAULT_CABIN_CLASS
                    },
                    metadata: {
                        responseTime: `${responseTime}ms`,
                        timestamp: new Date().toISOString()
                    }
                }
            };

            return result;
        }

        throw new Error(response?.Response?.Error?.ErrorMessage || 'No results found');
    } catch (error) {
        const errorTime = Date.now() - startTime;
        const errorDetails = {
            searchId,
            error: error.message,
            code: error.code || 'UNKNOWN_ERROR',
            params,
            responseTime: `${errorTime}ms`,
            timestamp: new Date().toISOString()
        };

        // Log the error
        logMessage(
            `[${searchId}] Search failed after ${errorTime}ms: ${error.message}`,
            'search_errors.log',
            'error'
        );

        logger.error('Flight search error:', errorDetails);
        
        // Enhance error with more context
        const enhancedError = new Error(`Flight search failed: ${error.message}`);
        enhancedError.code = error.code || 'FLIGHT_SEARCH_ERROR';
        enhancedError.details = error.details || error.response?.data;
        enhancedError.searchId = searchId;
        enhancedError.isRetryable = error.isRetryable !== false; // Default to retryable unless explicitly set to false

        throw enhancedError;
    }
}

/**
 * Get detailed fare rules for a specific flight result
 * @param {string} resultIndex - Result index from search
 * @param {string} traceId - Trace ID from search
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.includeFareBasis=false] - Whether to include fare basis codes
 * @returns {Promise<Object>} Fare rules and restrictions
 */
async function getFareRules(resultIndex, traceId, options = {}) {
    const startTime = Date.now();
    const requestId = `farerules_${Date.now()}`;

    try {
        // Input validation
        if (!resultIndex || !traceId) {
            throw new Error('ResultIndex and TraceId are required');
        }

        logMessage(
            `[${requestId}] Fetching fare rules for result ${resultIndex}`,
            null,
            'debug'
        );

        const params = await createParams({
            ResultIndex: resultIndex,
            TraceId: traceId,
            IncludeFareBasis: options.includeFareBasis || false
        });

        const response = await makeRequest('FareRule', params);
        const responseTime = Date.now() - startTime;

        if (!response || !response.Response) {
            throw new Error('Invalid response from fare rules API');
        }

        // Log successful response
        logMessage(
            `[${requestId}] Fare rules retrieved in ${responseTime}ms`,
            null,
            'debug'
        );

        // Process and format the response
        const fareRules = response.Response.FareRules || [];
        const formattedRules = {
            generalRules: [],
            penalties: [],
            restrictions: [],
            fareBasis: {},
            metadata: {
                resultIndex,
                traceId,
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString()
            }
        };

        // Process each rule set
        fareRules.forEach(rule => {
            if (rule.GeneralRules) {
                formattedRules.generalRules.push(...rule.GeneralRules);
            }
            if (rule.Penalty) {
                formattedRules.penalties.push(rule.Penalty);
            }
            if (rule.Restrictions) {
                formattedRules.restrictions.push(rule.Restrictions);
            }
            if (options.includeFareBasis && rule.FareBasis) {
                formattedRules.fareBasis = {
                    ...formattedRules.fareBasis,
                    ...rule.FareBasis
                };
            }
        });

        return {
            success: true,
            requestId,
            data: formattedRules
        };

    } catch (error) {
        const errorTime = Date.now() - startTime;
        const errorDetails = {
            requestId,
            resultIndex,
            traceId,
            error: error.message,
            code: error.code || 'FARE_RULES_ERROR',
            responseTime: `${errorTime}ms`,
            timestamp: new Date().toISOString()
        };

        logMessage(
            `[${requestId}] Failed to get fare rules after ${errorTime}ms: ${error.message}`,
            'fare_rules_errors.log',
            'error'
        );

        logger.error('Fare rules error:', errorDetails);

        const enhancedError = new Error(`Failed to get fare rules: ${error.message}`);
        enhancedError.code = error.code || 'FARE_RULES_ERROR';
        enhancedError.details = error.details || error.response?.data;
        enhancedError.requestId = requestId;
        enhancedError.isRetryable = error.isRetryable !== false;

        throw enhancedError;
    }
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
 * Get Special Service Requests (SSR) and ancillary services for a flight
 * @param {string} resultIndex - Result index from search
 * @param {string} traceId - Trace ID from search
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.includeMeals=true] - Whether to include meal options
 * @param {boolean} [options.includeSeats=true] - Whether to include seat selection options
 * @param {boolean} [options.includeBaggage=true] - Whether to include baggage options
 * @returns {Promise<Object>} SSR and ancillary service details
 */
async function getSSRDetails(resultIndex, traceId, options = {}) {
    const startTime = Date.now();
    const requestId = `ssr_${Date.now()}`;

    try {
        // Input validation
        if (!resultIndex || !traceId) {
            throw new Error('ResultIndex and TraceId are required');
        }

        logMessage(
            `[${requestId}] Fetching SSR details for result ${resultIndex}`,
            null,
            'debug'
        );

        const params = await createParams({
            ResultIndex: resultIndex,
            TraceId: traceId,
            // Additional parameters for SSR
            IncludeSSRDetails: true,
            IncludeMeal: options.includeMeals !== false,
            IncludeSeat: options.includeSeats !== false,
            IncludeBaggage: options.includeBaggage !== false
        });

        const response = await makeRequest('SSR', params);
        const responseTime = Date.now() - startTime;

        if (!response || !response.Response) {
            throw new Error('Invalid response from SSR API');
        }

        // Log successful response
        logMessage(
            `[${requestId}] SSR details retrieved in ${responseTime}ms`,
            null,
            'debug'
        );

        // Process and format the response
        const ssrData = response.Response;
        const formattedResponse = {
            ssr: [],
            meals: [],
            seats: [],
            baggage: [],
            otherServices: [],
            metadata: {
                resultIndex,
                traceId,
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString()
            }
        };

        // Process SSR data
        if (Array.isArray(ssrData.SSRDetails)) {
            ssrData.SSRDetails.forEach(ssr => {
                if (ssr.SSRType === 'MEAL' && options.includeMeals !== false) {
                    formattedResponse.meals.push({
                        code: ssr.SSRCode,
                        name: ssr.SSRName,
                        description: ssr.SSRDescription,
                        price: ssr.SSRFare,
                        currency: ssr.Currency,
                        isChargeable: ssr.IsChargeable,
                        type: ssr.SSRType
                    });
                } else if (ssr.SSRType === 'SEAT' && options.includeSeats !== false) {
                    formattedResponse.seats.push({
                        code: ssr.SSRCode,
                        name: ssr.SSRName,
                        description: ssr.SSRDescription,
                        price: ssr.SSRFare,
                        currency: ssr.Currency,
                        isChargeable: ssr.IsChargeable,
                        type: ssr.SSRType,
                        seatNumber: ssr.SeatNumber,
                        seatLocation: ssr.SeatLocation,
                        seatType: ssr.SeatType
                    });
                } else if (ssr.SSRType === 'BAGGAGE' && options.includeBaggage !== false) {
                    formattedResponse.baggage.push({
                        code: ssr.SSRCode,
                        name: ssr.SSRName,
                        description: ssr.SSRDescription,
                        weight: ssr.Weight,
                        weightUnit: ssr.WeightUnit,
                        price: ssr.SSRFare,
                        currency: ssr.Currency,
                        isChargeable: ssr.IsChargeable,
                        type: ssr.SSRType,
                        pieceCount: ssr.PieceCount
                    });
                } else {
                    formattedResponse.otherServices.push({
                        code: ssr.SSRCode,
                        name: ssr.SSRName,
                        description: ssr.SSRDescription,
                        price: ssr.SSRFare,
                        currency: ssr.Currency,
                        isChargeable: ssr.IsChargeable,
                        type: ssr.SSRType
                    });
                }
            });
        }

        return {
            success: true,
            requestId,
            data: formattedResponse
        };

    } catch (error) {
        const errorTime = Date.now() - startTime;
        const errorDetails = {
            requestId,
            resultIndex,
            traceId,
            error: error.message,
            code: error.code || 'SSR_DETAILS_ERROR',
            responseTime: `${errorTime}ms`,
            timestamp: new Date().toISOString()
        };

        logMessage(
            `[${requestId}] Failed to get SSR details after ${errorTime}ms: ${error.message}`,
            'ssr_errors.log',
            'error'
        );

        logger.error('SSR details error:', errorDetails);

        const enhancedError = new Error(`Failed to get SSR details: ${error.message}`);
        enhancedError.code = error.code || 'SSR_DETAILS_ERROR';
        enhancedError.details = error.details || error.response?.data;
        enhancedError.requestId = requestId;
        enhancedError.isRetryable = error.isRetryable !== false;

        throw enhancedError;
    }
}

/**
 * Book a flight with comprehensive validation and error handling
 * @param {Object} bookingData - Booking data
 * @param {string} bookingData.ResultIndex - Result index from search
 * @param {string} bookingData.TraceId - Trace ID from search
 * @param {Array<Object>} bookingData.Passengers - Array of passenger details
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.sendEmail=true] - Whether to send booking confirmation email
 * @param {string} [options.bookingSource='WEB'] - Source of the booking (WEB, MOBILE, AGENT, etc.)
 * @param {string} [options.bookingReference] - Optional custom booking reference
 * @returns {Promise<Object>} Booking confirmation details
 */
async function bookFlight(bookingData, options = {}) {
    const startTime = Date.now();
    const bookingId = options.bookingReference || `book_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    try {
        // Input validation
        if (!bookingData.ResultIndex || !bookingData.TraceId) {
            throw new Error('ResultIndex and TraceId are required for booking');
        }

        if (!Array.isArray(bookingData.Passengers) || bookingData.Passengers.length === 0) {
            throw new Error('At least one passenger is required for booking');
        }

        // Validate passenger data
        const validPassengers = [];
        const passengerTypes = new Set();

        for (const [index, passenger] of bookingData.Passengers.entries()) {
            if (!passenger.FirstName || !passenger.LastName) {
                throw new Error(`Passenger ${index + 1}: FirstName and LastName are required`);
            }

            if (!passenger.PassengerType) {
                throw new Error(`Passenger ${index + 1}: PassengerType is required (ADT, CHD, INF)`);
            }

            // Normalize passenger type
            const passengerType = passenger.PassengerType.toUpperCase();
            if (!['ADT', 'CHD', 'INF'].includes(passengerType)) {
                throw new Error(`Passenger ${index + 1}: Invalid PassengerType '${passengerType}'. Must be ADT, CHD, or INF`);
            }

            // Validate date of birth for INF/CHD
            if ((passengerType === 'INF' || passengerType === 'CHD') && !passenger.DateOfBirth) {
                throw new Error(`Passenger ${index + 1}: DateOfBirth is required for ${passengerType} passengers`);
            }

            // Validate passport for international flights
            if (bookingData.IsInternational) {
                if (!passenger.PassportNumber) {
                    throw new Error(`Passenger ${index + 1}: PassportNumber is required for international flights`);
                }
                if (!passenger.PassportExpiry) {
                    throw new Error(`Passenger ${index + 1}: PassportExpiry is required for international flights`);
                }
                if (!passenger.Nationality) {
                    throw new Error(`Passenger ${index + 1}: Nationality is required for international flights`);
                }
            }

            // Add to valid passengers
            validPassengers.push({
                ...passenger,
                PassengerType: passengerType,
                Title: passenger.Title || (passengerType === 'ADT' ? 'Mr' : 'Master'),
                Gender: passenger.Gender || (passengerType === 'ADT' ? 'M' : 'C'),
                DateOfBirth: passenger.DateOfBirth || '1990-01-01', // Default DOB if not provided
                PassportNumber: passenger.PassportNumber || 'N/A',
                PassportExpiry: passenger.PassportExpiry || '2030-12-31',
                Nationality: passenger.Nationality || 'IN',
                FrequentFlyerNumber: passenger.FrequentFlyerNumber || '',
                MealPreference: passenger.MealPreference || 'VGML', // Default to vegetarian meal
                SeatPreference: passenger.SeatPreference || 'AISLE', // Default to aisle seat
                SpecialServices: passenger.SpecialServices || []
            });

            passengerTypes.add(passengerType);
        }

        // Validate passenger type combinations
        if (passengerTypes.has('INF') && !passengerTypes.has('ADT')) {
            throw new Error('Infant passengers must be accompanied by at least one adult');
        }

        // Prepare the booking request
        const bookingRequest = await createParams({
            ResultIndex: bookingData.ResultIndex,
            TraceId: bookingData.TraceId,
            Passengers: validPassengers,
            BookingDetails: {
                BookingId: bookingId,
                BookingSource: options.bookingSource || 'WEB',
                BookingDate: new Date().toISOString(),
                SendEmail: options.sendEmail !== false,
                Email: bookingData.ContactEmail || bookingData.Passengers[0]?.Email,
                Phone: bookingData.ContactPhone || bookingData.Passengers[0]?.Phone,
                CountryCode: bookingData.CountryCode || '91',
                Address: bookingData.BillingAddress || {},
                PaymentDetails: bookingData.PaymentDetails || {}
            },
            // Additional booking options
            IsHoldBooking: options.holdBooking || false,
            IsInstantPayment: options.instantPayment || true,
            IsLCC: bookingData.IsLCC || false,
            IsDomestic: bookingData.IsDomestic || true,
            // Add any additional parameters from the original booking data
            ...(bookingData.AdditionalParams || {})
        });

        // Log the booking request (without sensitive data)
        logMessage(
            `[${bookingId}] Starting flight booking for ${validPassengers.length} passengers`,
            null,
            'info'
        );

        logger.debug('Flight booking request:', {
            bookingId,
            passengerCount: validPassengers.length,
            passengerTypes: Array.from(passengerTypes),
            isInternational: bookingData.IsInternational,
            isLCC: bookingData.IsLCC,
            requestData: {
                ...bookingRequest,
                TokenId: '***REDACTED***',
                Passengers: bookingRequest.Passengers.map(p => ({
                    ...p,
                    PassportNumber: p.PassportNumber ? '***REDACTED***' : undefined,
                    PassportExpiry: p.PassportExpiry ? '***REDACTED***' : undefined
                }))
            }
        });

        // Make the booking request
        const response = await makeRequest('Book', bookingRequest, true); // Use secondary URL for booking
        const responseTime = Date.now() - startTime;

        if (!response || !response.Response) {
            throw new Error('Invalid response from booking API');
        }

        // Process the booking response
        const bookingResponse = response.Response;

        // Log successful booking
        logMessage(
            `[${bookingId}] Booking completed in ${responseTime}ms. Status: ${bookingResponse.BookingStatus}`,
            null,
            'info'
        );

        // Prepare the response
        const result = {
            success: bookingResponse.BookingStatus === 'CONFIRMED',
            bookingId,
            data: {
                bookingReference: bookingResponse.BookingId || bookingId,
                pnr: bookingResponse.PNR,
                status: bookingResponse.BookingStatus,
                bookingDate: new Date().toISOString(),
                passengers: validPassengers.map(p => ({
                    title: p.Title,
                    firstName: p.FirstName,
                    lastName: p.LastName,
                    passengerType: p.PassengerType,
                    ticketNumber: null, // Will be available after ticketing
                    status: 'BOOKED'
                })),
                flights: bookingResponse.Segments || [],
                fareDetails: bookingResponse.FareDetails || {},
                paymentDetails: bookingResponse.PaymentDetails || {},
                cancellationPolicy: bookingResponse.CancellationPolicy || {},
                metadata: {
                    responseTime: `${responseTime}ms`,
                    timestamp: new Date().toISOString(),
                    isTicketed: bookingResponse.IsTicketed || false,
                    isVoidable: bookingResponse.IsVoidable || false,
                    isRefundable: bookingResponse.IsRefundable || false
                }
            }
        };

        return result;

    } catch (error) {
        const errorTime = Date.now() - startTime;
        const errorDetails = {
            bookingId,
            error: error.message,
            code: error.code || 'BOOKING_ERROR',
            responseTime: `${errorTime}ms`,
            timestamp: new Date().toISOString(),
            isRetryable: error.isRetryable !== false
        };

        // Log the error
        logMessage(
            `[${bookingId || 'unknown'}] Booking failed after ${errorTime}ms: ${error.message}`,
            'booking_errors.log',
            'error'
        );

        logger.error('Flight booking error:', errorDetails);

        // Enhance error with more context
        const enhancedError = new Error(`Flight booking failed: ${error.message}`);
        enhancedError.code = error.code || 'BOOKING_ERROR';
        enhancedError.details = error.details || error.response?.data;
        enhancedError.bookingId = bookingId;
        enhancedError.isRetryable = error.isRetryable !== false;

        throw enhancedError;
    }
}

/**
 * Confirm and ticket a flight booking
 * @param {Object} params - Confirmation parameters
 * @param {string} [params.traceId] - Trace ID from booking
 * @param {string} [params.bookingId] - Booking reference ID
 * @param {string} [params.PNR] - PNR number (if already issued)
 * @param {string} [params.ResultIndex] - Result index (required if no PNR)
 * @param {Array} [params.Passengers] - Passenger details (required if no PNR)
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.sendEmail=true] - Whether to send confirmation email
 * @param {string} [options.email] - Email address for confirmation
 * @param {string} [options.phone] - Phone number for confirmation
 * @returns {Promise<Object>} Ticketing confirmation details
 */
async function confirmTicket(params, options = {}) {
    const startTime = Date.now();
    const confirmationId = `confirm_${Date.now()}`;

    try {
        // Input validation
        if (!params.bookingId && !params.PNR) {
            throw new Error('Either bookingId or PNR is required');
        }

        if (!params.PNR && (!params.ResultIndex || !params.Passengers)) {
            throw new Error('ResultIndex and Passengers are required when PNR is not provided');
        }

        // Prepare the confirmation request
        let requestData;
        if (params.PNR) {
            // Confirmation by PNR (already ticketed)
            requestData = await createParams({
                TraceId: params.traceId,
                PNR: params.PNR,
                BookingId: params.bookingId,
                SendEmail: options.sendEmail !== false,
                Email: options.email,
                Phone: options.phone
            });
        } else {
            // Ticket issuance request
            requestData = await createParams({
                TraceId: params.traceId,
                ResultIndex: params.ResultIndex,
                Passengers: params.Passengers,
                BookingId: params.bookingId,
                SendEmail: options.sendEmail !== false,
                Email: options.email,
                Phone: options.phone,
                // Additional parameters for ticketing
                IsLCC: params.isLCC || false,
                IsDomestic: params.isDomestic !== false,
                PaymentDetails: params.paymentDetails || {}
            });
        }

        // Log the confirmation request
        logMessage(
            `[${confirmationId}] Starting ticket confirmation for ${params.PNR ? 'PNR' : 'booking'} ${params.PNR || params.bookingId}`,
            null,
            'info'
        );

        // Make the confirmation/ticketing request
        const response = await makeRequest('Ticket', requestData, true); // Use secondary URL for ticketing
        const responseTime = Date.now() - startTime;

        if (!response || !response.Response) {
            throw new Error('Invalid response from ticketing API');
        }

        const ticketingResponse = response.Response;

        // Log successful confirmation
        logMessage(
            `[${confirmationId}] Ticket confirmation completed in ${responseTime}ms. Status: ${ticketingResponse.Status}`,
            null,
            'info'
        );

        // Prepare the response
        const result = {
            success: ticketingResponse.Status === 'CONFIRMED' || ticketingResponse.Status === 'TICKETED',
            confirmationId,
            data: {
                bookingReference: ticketingResponse.BookingId || params.bookingId,
                pnr: ticketingResponse.PNR || params.PNR,
                status: ticketingResponse.Status,
                ticketNumber: ticketingResponse.TicketNumber,
                issueDate: new Date().toISOString(),
                passengers: (ticketingResponse.Passengers || params.Passengers || []).map(p => ({
                    title: p.Title,
                    firstName: p.FirstName,
                    lastName: p.LastName,
                    passengerType: p.PassengerType,
                    ticketNumber: p.TicketNumber,
                    fareBasis: p.FareBasis,
                    status: p.Status || 'TICKETED'
                })),
                flights: ticketingResponse.Segments || [],
                fareDetails: ticketingResponse.FareDetails || {},
                ticketTimeLimit: ticketingResponse.TicketTimeLimit,
                metadata: {
                    responseTime: `${responseTime}ms`,
                    timestamp: new Date().toISOString(),
                    isEligibleForVoid: ticketingResponse.IsEligibleForVoid || false,
                    isRefundable: ticketingResponse.IsRefundable || false
                }
            }
        };

        return result;

    } catch (error) {
        const errorTime = Date.now() - startTime;
        const errorDetails = {
            confirmationId,
            bookingId: params.bookingId,
            pnr: params.PNR,
            error: error.message,
            code: error.code || 'TICKETING_ERROR',
            responseTime: `${errorTime}ms`,
            timestamp: new Date().toISOString(),
            isRetryable: error.isRetryable !== false
        };

        // Log the error
        logMessage(
            `[${confirmationId || 'unknown'}] Ticket confirmation failed after ${errorTime}ms: ${error.message}`,
            'ticketing_errors.log',
            'error'
        );

        logger.error('Ticket confirmation error:', errorDetails);

        // Enhance error with more context
        const enhancedError = new Error(`Ticket confirmation failed: ${error.message}`);
        enhancedError.code = error.code || 'TICKETING_ERROR';
        enhancedError.details = error.details || error.response?.data;
        enhancedError.confirmationId = confirmationId;
        enhancedError.isRetryable = error.isRetryable !== false;

        throw enhancedError;
    }
}

/**
 * Get detailed information about a flight booking
 * @param {Object} params - Booking details parameters
 * @param {string} params.BookingId - Booking reference ID
 * @param {string} [params.PNR] - PNR number (if available)
 * @param {string} [params.Email] - Email address associated with the booking
 * @param {string} [params.Phone] - Phone number associated with the booking
 * @param {boolean} [options.includeHistory=false] - Whether to include booking history
 * @param {boolean} [options.includeFareRules=false] - Whether to include fare rules
 * @param {boolean} [options.includeSSR=false] - Whether to include SSR details
 * @returns {Promise<Object>} Complete booking details
 */
async function getBookingDetails(params, options = {}) {
    const startTime = Date.now();
    const requestId = `booking_${Date.now()}`;

    try {
        // Input validation
        if (!params.BookingId && !params.PNR) {
            throw new Error('Either BookingId or PNR is required');
        }

        // Log the request
        logMessage(
            `[${requestId}] Fetching booking details for ${params.BookingId || params.PNR}`,
            null,
            'debug'
        );

        // Prepare the request
        const requestData = await createParams({
            BookingId: params.BookingId,
            PNR: params.PNR,
            Email: params.Email,
            Phone: params.Phone,
            IncludeHistory: options.includeHistory || false,
            IncludeFareRules: options.includeFareRules || false,
            IncludeSSR: options.includeSSR || false
        });

        // Make the API call
        const response = await makeRequest('GetBookingDetails', requestData, true);
        const responseTime = Date.now() - startTime;

        if (!response || !response.Response) {
            throw new Error('Invalid response from booking details API');
        }

        const bookingDetails = response.Response;

        // Log successful response
        logMessage(
            `[${requestId}] Booking details retrieved in ${responseTime}ms`,
            null,
            'debug'
        );

        // Process and format the response
        const formattedResponse = {
            bookingReference: bookingDetails.BookingId,
            pnr: bookingDetails.PNR,
            status: bookingDetails.BookingStatus,
            bookingDate: bookingDetails.BookingDate,
            ticketingDeadline: bookingDetails.TicketingDeadline,
            isTicketed: bookingDetails.IsTicketed || false,
            isVoidable: bookingDetails.IsVoidable || false,
            isRefundable: bookingDetails.IsRefundable || false,
            isInternational: bookingDetails.IsInternational || false,

            // Passenger details
            passengers: (bookingDetails.Passengers || []).map(p => ({
                title: p.Title,
                firstName: p.FirstName,
                lastName: p.LastName,
                passengerType: p.PassengerType,
                dateOfBirth: p.DateOfBirth,
                passportNumber: p.PassportNumber ? '***REDACTED***' : undefined,
                passportExpiry: p.PassportExpiry,
                nationality: p.Nationality,
                ticketNumber: p.TicketNumber,
                fareBasis: p.FareBasis,
                status: p.Status,
                seat: p.SeatNumber,
                mealPreference: p.MealPreference,
                frequentFlyerNumber: p.FrequentFlyerNumber,
                ssr: p.SSR || []
            })),

            // Flight segments
            segments: (bookingDetails.Segments || []).map(s => ({
                airline: s.Airline,
                flightNumber: s.FlightNumber,
                origin: s.Origin,
                destination: s.Destination,
                departureTime: s.DepartureTime,
                arrivalTime: s.ArrivalTime,
                cabinClass: s.CabinClass,
                bookingClass: s.BookingClass,
                status: s.Status,
                aircraftType: s.AircraftType,
                terminal: s.Terminal,
                checkInCounter: s.CheckInCounter,
                baggageAllowance: s.BaggageAllowance,
                operatingCarrier: s.OperatingCarrier,
                operatingFlightNumber: s.OperatingFlightNumber
            })),

            // Pricing details
            fareDetails: bookingDetails.FareDetails ? {
                baseFare: bookingDetails.FareDetails.BaseFare,
                tax: bookingDetails.FareDetails.Tax,
                serviceFee: bookingDetails.FareDetails.ServiceFee,
                totalFare: bookingDetails.FareDetails.TotalFare,
                currency: bookingDetails.FareDetails.Currency,
                commission: bookingDetails.FareDetails.Commission,
                discount: bookingDetails.FareDetails.Discount,
                payableAmount: bookingDetails.FareDetails.PayableAmount
            } : null,

            // Payment details
            paymentDetails: bookingDetails.PaymentDetails ? {
                paymentId: bookingDetails.PaymentDetails.PaymentId,
                paymentStatus: bookingDetails.PaymentDetails.PaymentStatus,
                paymentMethod: bookingDetails.PaymentDetails.PaymentMethod,
                paymentDate: bookingDetails.PaymentDetails.PaymentDate,
                amountPaid: bookingDetails.PaymentDetails.AmountPaid,
                currency: bookingDetails.PaymentDetails.Currency,
                transactionId: bookingDetails.PaymentDetails.TransactionId
            } : null,

            // Contact information
            contactInfo: {
                email: bookingDetails.Email,
                phone: bookingDetails.Phone,
                address: bookingDetails.Address
            },

            // Additional metadata
            metadata: {
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString(),
                isGroupBooking: bookingDetails.IsGroupBooking || false,
                isCorporateBooking: bookingDetails.IsCorporateBooking || false,
                bookingSource: bookingDetails.BookingSource,
                agencyDetails: bookingDetails.AgencyDetails
            }
        };

        // Include additional data if requested
        if (options.includeFareRules && bookingDetails.FareRules) {
            formattedResponse.fareRules = bookingDetails.FareRules;
        }

        if (options.includeSSR && bookingDetails.SSRDetails) {
            formattedResponse.ssrDetails = bookingDetails.SSRDetails;
        }

        if (options.includeHistory && bookingDetails.BookingHistory) {
            formattedResponse.history = bookingDetails.BookingHistory;
        }

        return {
            success: true,
            requestId,
            data: formattedResponse
        };

    } catch (error) {
        const errorTime = Date.now() - startTime;
        const errorDetails = {
            requestId,
            bookingId: params.BookingId,
            pnr: params.PNR,
            error: error.message,
            code: error.code || 'BOOKING_DETAILS_ERROR',
            responseTime: `${errorTime}ms`,
            timestamp: new Date().toISOString(),
            isRetryable: error.isRetryable !== false
        };

        // Log the error
        logMessage(
            `[${requestId}] Failed to get booking details after ${errorTime}ms: ${error.message}`,
            'booking_details_errors.log',
            'error'
        );

        logger.error('Booking details error:', errorDetails);

        // Enhance error with more context
        const enhancedError = new Error(`Failed to get booking details: ${error.message}`);
        enhancedError.code = error.code || 'BOOKING_DETAILS_ERROR';
        enhancedError.details = error.details || error.response?.data;
        enhancedError.requestId = requestId;
        enhancedError.isRetryable = error.isRetryable !== false;

        throw enhancedError;
    }
}

/**
 * Get cancellation charges and policies for a booking
 * @param {Object} params - Cancellation parameters
 * @param {string} params.BookingId - Booking reference ID
 * @param {string} [params.PNR] - PNR number (if available)
 * @param {Array<Object>} [params.Passengers] - Array of passenger details for partial cancellation
 * @param {Array<Object>} [params.Segments] - Array of segment details for partial cancellation
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.includeRefundCalculation=true] - Whether to include detailed refund calculation
 * @param {boolean} [options.includePolicyDetails=true] - Whether to include cancellation policy details
 * @returns {Promise<Object>} Cancellation charges and policies
 */
async function getCancellationCharges(params, options = {}) {
    const startTime = Date.now();
    const requestId = `cancel_${Date.now()}`;

    try {
        // Input validation
        if (!params.BookingId && !params.PNR) {
            throw new Error('Either BookingId or PNR is required');
        }

        // Log the request
        logMessage(
            `[${requestId}] Fetching cancellation charges for ${params.BookingId || params.PNR}`,
            null,
            'info'
        );

        // Prepare the request
        const requestData = await createParams({
            BookingId: params.BookingId,
            PNR: params.PNR,
            Passengers: params.Passengers,
            Segments: params.Segments,
            IncludeRefundCalculation: options.includeRefundCalculation !== false,
            IncludePolicyDetails: options.includePolicyDetails !== false
        });

        // Make the API call
        const response = await makeRequest('GetCancellationCharges', requestData, true);
        const responseTime = Date.now() - startTime;

        if (!response || !response.Response) {
            throw new Error('Invalid response from cancellation charges API');
        }

        const cancellationData = response.Response;

        // Log successful response
        logMessage(
            `[${requestId}] Cancellation charges retrieved in ${responseTime}ms`,
            null,
            'info'
        );

        // Process and format the response
        const formattedResponse = {
            bookingReference: cancellationData.BookingId,
            pnr: cancellationData.PNR,
            isCancellable: cancellationData.IsCancellable || false,
            isPartiallyCancellable: cancellationData.IsPartiallyCancellable || false,
            cancellationDeadline: cancellationData.CancellationDeadline,
            lastCancellationTime: cancellationData.LastCancellationTime,

            // Charges and refunds
            charges: {
                cancellationFee: cancellationData.CancellationFee || 0,
                serviceFee: cancellationData.ServiceFee || 0,
                totalCharges: cancellationData.TotalCharges || 0,
                refundAmount: cancellationData.RefundAmount || 0,
                netRefund: cancellationData.NetRefund || 0,
                currency: cancellationData.Currency || 'INR',
                isRefundable: cancellationData.IsRefundable || false,
                isNonRefundable: cancellationData.IsNonRefundable || false
            },

            // Detailed breakdown
            breakdown: cancellationData.Breakdown ? {
                baseFare: cancellationData.Breakdown.BaseFare,
                tax: cancellationData.Breakdown.Tax,
                yqTax: cancellationData.Breakdown.YQTax,
                otherTaxes: cancellationData.Breakdown.OtherTaxes,
                totalFare: cancellationData.Breakdown.TotalFare,
                cancellationFee: cancellationData.Breakdown.CancellationFee,
                airlineFee: cancellationData.Breakdown.AirlineFee,
                serviceFee: cancellationData.Breakdown.ServiceFee,
                tds: cancellationData.Breakdown.TDS,
                tcs: cancellationData.Breakdown.TCS,
                otherCharges: cancellationData.Breakdown.OtherCharges,
                netRefund: cancellationData.Breakdown.NetRefund
            } : null,

            // Passenger-wise charges (for partial cancellation)
            passengerCharges: (cancellationData.PassengerCharges || []).map(p => ({
                passengerType: p.PassengerType,
                passengerName: p.PassengerName,
                baseFare: p.BaseFare,
                tax: p.Tax,
                yqTax: p.YQTax,
                cancellationFee: p.CancellationFee,
                refundAmount: p.RefundAmount,
                isRefundable: p.IsRefundable,
                penaltyAmount: p.PenaltyAmount,
                penaltyCurrency: p.PenaltyCurrency
            })),

            // Segment-wise charges (for partial cancellation)
            segmentCharges: (cancellationData.SegmentCharges || []).map(s => ({
                origin: s.Origin,
                destination: s.Destination,
                departureTime: s.DepartureTime,
                airline: s.Airline,
                flightNumber: s.FlightNumber,
                cabinClass: s.CabinClass,
                cancellationFee: s.CancellationFee,
                isRefundable: s.IsRefundable,
                penaltyAmount: s.PenaltyAmount,
                penaltyCurrency: s.PenaltyCurrency
            })),

            // Cancellation policy
            policy: cancellationData.CancellationPolicy ? {
                policyText: cancellationData.CancellationPolicy.PolicyText,
                policyDetails: cancellationData.CancellationPolicy.PolicyDetails,
                cancellationRules: cancellationData.CancellationPolicy.CancellationRules,
                refundRules: cancellationData.CancellationPolicy.RefundRules,
                lastCancellationTime: cancellationData.CancellationPolicy.LastCancellationTime,
                isTimeBased: cancellationData.CancellationPolicy.IsTimeBased,
                isAmountBased: cancellationData.CancellationPolicy.IsAmountBased,
                isPercentageBased: cancellationData.CancellationPolicy.IsPercentageBased
            } : null,

            // Additional metadata
            metadata: {
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString(),
                isLCC: cancellationData.IsLCC || false,
                isDomestic: cancellationData.IsDomestic !== false,
                isInternational: cancellationData.IsInternational || false
            }
        };

        return {
            success: true,
            requestId,
            data: formattedResponse
        };

    } catch (error) {
        const errorTime = Date.now() - startTime;
        const errorDetails = {
            requestId,
            bookingId: params.BookingId,
            pnr: params.PNR,
            error: error.message,
            code: error.code || 'CANCELLATION_CHARGES_ERROR',
            responseTime: `${errorTime}ms`,
            timestamp: new Date().toISOString(),
            isRetryable: error.isRetryable !== false
        };

        // Log the error
        logMessage(
            `[${requestId}] Failed to get cancellation charges after ${errorTime}ms: ${error.message}`,
            'cancellation_errors.log',
            'error'
        );

        logger.error('Cancellation charges error:', errorDetails);

        // Enhance error with more context
        const enhancedError = new Error(`Failed to get cancellation charges: ${error.message}`);
        enhancedError.code = error.code || 'CANCELLATION_CHARGES_ERROR';
        enhancedError.details = error.details || error.response?.data;
        enhancedError.requestId = requestId;
        enhancedError.isRetryable = error.isRetryable !== false;

        throw enhancedError;
    }
}

/**
 * Cancel a flight booking or specific segments/passengers
 * @param {Object} params - Cancellation parameters
 * @param {string} params.BookingId - Booking reference ID
 * @param {string} [params.PNR] - PNR number (if available)
 * @param {string} [params.CancellationType] - Type of cancellation (FULL, PARTIAL, SEGMENT, PASSENGER)
 * @param {Array<Object>} [params.Passengers] - Array of passenger details for partial cancellation
 * @param {Array<Object>} [params.Segments] - Array of segment details for partial cancellation
 * @param {string} [params.Reason] - Reason for cancellation
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.requestRefund=true] - Whether to request a refund
 * @param {string} [options.refundAccount] - Bank account details for refund
 * @param {boolean} [options.sendEmail=true] - Whether to send cancellation confirmation email
 * @returns {Promise<Object>} Cancellation confirmation
 */
async function cancelBooking(params, options = {}) {
    const startTime = Date.now();
    const cancellationId = `cancel_${Date.now()}`;

    try {
        // Input validation
        if (!params.BookingId && !params.PNR) {
            throw new Error('Either BookingId or PNR is required');
        }

        // Determine cancellation type if not provided
        let cancellationType = params.CancellationType;
        if (!cancellationType) {
            if (params.Passengers && params.Passengers.length > 0) {
                cancellationType = 'PASSENGER';
            } else if (params.Segments && params.Segments.length > 0) {
                cancellationType = 'SEGMENT';
            } else {
                cancellationType = 'FULL';
            }
        }

        // Log the request
        logMessage(
            `[${cancellationId}] Starting ${cancellationType.toLowerCase()} cancellation for ${params.BookingId || params.PNR}`,
            null,
            'info'
        );

        // Get cancellation charges first
        const charges = await getCancellationCharges({
            BookingId: params.BookingId,
            PNR: params.PNR,
            Passengers: params.Passengers,
            Segments: params.Segments
        });

        if (!charges.success || !charges.data) {
            throw new Error('Failed to get cancellation charges');
        }

        // Prepare the cancellation request
        const requestData = await createParams({
            BookingId: params.BookingId,
            PNR: params.PNR,
            CancellationType: cancellationType,
            Passengers: params.Passengers,
            Segments: params.Segments,
            Reason: params.Reason || 'Customer Request',
            RequestRefund: options.requestRefund !== false,
            RefundAccount: options.refundAccount,
            SendEmail: options.sendEmail !== false,
            Email: params.Email,
            Phone: params.Phone,
            // Include charges for verification
            ExpectedCharges: {
                CancellationFee: charges.data.charges.cancellationFee,
                ServiceFee: charges.data.charges.serviceFee,
                TotalCharges: charges.data.charges.totalCharges,
                RefundAmount: charges.data.charges.refundAmount,
                Currency: charges.data.charges.currency
            }
        });

        // Make the cancellation request
        const response = await makeRequest('SendChangeRequest', requestData, true);
        const responseTime = Date.now() - startTime;

        if (!response || !response.Response) {
            throw new Error('Invalid response from cancellation API');
        }

        const cancellationResponse = response.Response;

        // Log successful cancellation
        logMessage(
            `[${cancellationId}] Cancellation completed in ${responseTime}ms. Status: ${cancellationResponse.Status}`,
            null,
            'info'
        );

        // Prepare the response
        const result = {
            success: cancellationResponse.Status === 'SUCCESS',
            cancellationId,
            data: {
                bookingReference: cancellationResponse.BookingId || params.BookingId,
                pnr: cancellationResponse.PNR || params.PNR,
                status: cancellationResponse.Status,
                cancellationReference: cancellationResponse.CancellationId,
                cancellationDate: new Date().toISOString(),

                // Charges and refunds
                charges: {
                    cancellationFee: cancellationResponse.CancellationFee || 0,
                    serviceFee: cancellationResponse.ServiceFee || 0,
                    totalCharges: cancellationResponse.TotalCharges || 0,
                    refundAmount: cancellationResponse.RefundAmount || 0,
                    netRefund: cancellationResponse.NetRefund || 0,
                    currency: cancellationResponse.Currency || 'INR',
                    isRefundable: cancellationResponse.IsRefundable || false
                },

                // Refund details (if applicable)
                refund: cancellationResponse.RefundDetails ? {
                    status: cancellationResponse.RefundDetails.Status,
                    amount: cancellationResponse.RefundDetails.Amount,
                    currency: cancellationResponse.RefundDetails.Currency,
                    referenceNumber: cancellationResponse.RefundDetails.ReferenceNumber,
                    processedDate: cancellationResponse.RefundDetails.ProcessedDate,
                    estimatedProcessingTime: cancellationResponse.RefundDetails.EstimatedProcessingTime
                } : null,

                // Additional metadata
                metadata: {
                    responseTime: `${responseTime}ms`,
                    timestamp: new Date().toISOString(),
                    isFullCancellation: cancellationType === 'FULL',
                    isPartialCancellation: cancellationType !== 'FULL',
                    cancellationType: cancellationType
                }
            }
        };

        return result;

    } catch (error) {
        const errorTime = Date.now() - startTime;
        const errorDetails = {
            cancellationId,
            bookingId: params.BookingId,
            pnr: params.PNR,
            error: error.message,
            code: error.code || 'CANCELLATION_ERROR',
            responseTime: `${errorTime}ms`,
            timestamp: new Date().toISOString(),
            isRetryable: error.isRetryable !== false
        };

        // Log the error
        logMessage(
            `[${cancellationId || 'unknown'}] Cancellation failed after ${errorTime}ms: ${error.message}`,
            'cancellation_errors.log',
            'error'
        );

        logger.error('Cancellation error:', errorDetails);

        // Enhance error with more context
        const enhancedError = new Error(`Cancellation failed: ${error.message}`);
        enhancedError.code = error.code || 'CANCELLATION_ERROR';
        enhancedError.details = error.details || error.response?.data;
        enhancedError.cancellationId = cancellationId;
        enhancedError.isRetryable = error.isRetryable !== false;

        throw enhancedError;
    }
}

/**
 * Get the status of a cancellation request
 * @param {Object} params - Status parameters
 * @param {string} params.CancellationId - Cancellation reference ID
 * @param {string} [params.BookingId] - Original booking reference ID
 * @param {string} [params.PNR] - PNR number (if available)
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.includeDetails=true] - Whether to include detailed status information
 * @returns {Promise<Object>} Cancellation status details
 */
async function getCancellationStatus(params, options = {}) {
    const startTime = Date.now();
    const requestId = `status_${Date.now()}`;

    try {
        // Input validation
        if (!params.CancellationId && !params.BookingId && !params.PNR) {
            throw new Error('Either CancellationId, BookingId, or PNR is required');
        }

        // Log the request
        logMessage(
            `[${requestId}] Fetching status for cancellation ${params.CancellationId || params.BookingId || params.PNR}`,
            null,
            'debug'
        );

        // Prepare the request
        const requestData = await createParams({
            CancellationId: params.CancellationId,
            BookingId: params.BookingId,
            PNR: params.PNR,
            IncludeDetails: options.includeDetails !== false
        });

        // Make the API call
        const response = await makeRequest('GetChangeRequestStatus', requestData, true);
        const responseTime = Date.now() - startTime;

        if (!response || !response.Response) {
            throw new Error('Invalid response from cancellation status API');
        }

        const statusData = response.Response;

        // Log successful response
        logMessage(
            `[${requestId}] Cancellation status retrieved in ${responseTime}ms`,
            null,
            'debug'
        );

        // Process and format the response
        const formattedResponse = {
            cancellationId: statusData.CancellationId,
            bookingReference: statusData.BookingId,
            pnr: statusData.PNR,
            status: statusData.Status,
            statusCode: statusData.StatusCode,
            statusMessage: statusData.StatusMessage,
            requestDate: statusData.RequestDate,
            processedDate: statusData.ProcessedDate,

            // Cancellation details
            cancellationType: statusData.CancellationType,
            cancellationReason: statusData.CancellationReason,
            requestedBy: statusData.RequestedBy,

            // Refund details (if applicable)
            refund: statusData.RefundDetails ? {
                status: statusData.RefundDetails.Status,
                statusCode: statusData.RefundDetails.StatusCode,
                amount: statusData.RefundDetails.Amount,
                currency: statusData.RefundDetails.Currency,
                referenceNumber: statusData.RefundDetails.ReferenceNumber,
                processedDate: statusData.RefundDetails.ProcessedDate,
                estimatedProcessingTime: statusData.RefundDetails.EstimatedProcessingTime,
                method: statusData.RefundDetails.RefundMethod,
                accountDetails: statusData.RefundDetails.AccountDetails
            } : null,

            // Affected passengers (for partial cancellations)
            passengers: (statusData.Passengers || []).map(p => ({
                passengerId: p.PassengerId,
                title: p.Title,
                firstName: p.FirstName,
                lastName: p.LastName,
                passengerType: p.PassengerType,
                status: p.Status,
                cancellationFee: p.CancellationFee,
                refundAmount: p.RefundAmount,
                ticketNumber: p.TicketNumber
            })),

            // Affected segments (for partial cancellations)
            segments: (statusData.Segments || []).map(s => ({
                segmentId: s.SegmentId,
                origin: s.Origin,
                destination: s.Destination,
                departureTime: s.DepartureTime,
                arrivalTime: s.ArrivalTime,
                airline: s.Airline,
                flightNumber: s.FlightNumber,
                status: s.Status,
                cancellationFee: s.CancellationFee,
                isReinstated: s.IsReinstated || false
            })),

            // Additional metadata
            metadata: {
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString(),
                isComplete: statusData.IsComplete || false,
                isSuccess: statusData.IsSuccess || false,
                isFailure: statusData.IsFailure || false,
                isPending: statusData.IsPending || false,
                isRefundProcessed: statusData.IsRefundProcessed || false
            }
        };

        return {
            success: true,
            requestId,
            data: formattedResponse
        };

    } catch (error) {
        const errorTime = Date.now() - startTime;
        const errorDetails = {
            requestId,
            cancellationId: params.CancellationId,
            bookingId: params.BookingId,
            pnr: params.PNR,
            error: error.message,
            code: error.code || 'CANCELLATION_STATUS_ERROR',
            responseTime: `${errorTime}ms`,
            timestamp: new Date().toISOString(),
            isRetryable: error.isRetryable !== false
        };

        // Log the error
        logMessage(
            `[${requestId}] Failed to get cancellation status after ${errorTime}ms: ${error.message}`,
            'cancellation_status_errors.log',
            'error'
        );

        logger.error('Cancellation status error:', errorDetails);

        // Enhance error with more context
        const enhancedError = new Error(`Failed to get cancellation status: ${error.message}`);
        enhancedError.code = error.code || 'CANCELLATION_STATUS_ERROR';
        enhancedError.details = error.details || error.response?.data;
        enhancedError.requestId = requestId;
        enhancedError.isRetryable = error.isRetryable !== false;

        throw enhancedError;
    }
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
