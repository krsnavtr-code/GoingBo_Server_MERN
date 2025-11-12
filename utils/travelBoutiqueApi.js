import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create necessary directories
const TOKEN_DIR = path.join(__dirname, '../data/tokens/TBO');
const LOG_DIR = path.join(__dirname, '../logs/TBO/flights');

[TOKEN_DIR, LOG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Load environment variables
dotenv.config();

// TBO API Configuration
const CONFIG = {
    // Authentication
    clientId: process.env.TRAVEL_BOUTIQUE_CLIENT_ID || 'ApiIntegrationNew',
    username: process.env.TRAVEL_BOUTIQUE_USERNAME || 'DELG738',
    password: process.env.TRAVEL_BOUTIQUE_PASSWORD || 'Htl@DEL#38/G',
    
    // API Endpoints
    baseUrl: process.env.TRAVEL_BOUTIQUE_API_URL || 'https://api.tektravels.com/SharedAPI/SharedData.svc/rest',
    flightBaseUrl: process.env.TRAVEL_BOUTIQUE_FLIGHT_API_URL || 'https://api.tektravels.com/SharedAPI/SharedData.svc/rest',
    bookingBaseUrl: process.env.TRAVEL_BOUTIQUE_BOOKING_API_URL || 'https://api.tektravels.com/Booking/Service.svc/rest',
    
    // Endpoints
    authUrl: '/authenticate',
    flightSearchUrl: '/Search',
    
    // File paths
    tokenFile: path.join(TOKEN_DIR, 'tbo_token.json'),
    logFile: path.join(LOG_DIR, `api_logs_${new Date().toISOString().split('T')[0]}.json`),
    
    // Network
    vpsIp: '82.112.236.83',
    timeout: 30000, // 30 seconds
    
    // Debug
    debug: process.env.NODE_ENV === 'development'
};

// Enable mock mode if explicitly set in environment
const USE_MOCK = process.env.USE_MOCK === 'true';

// Generate a unique trace ID
const generateTraceId = () => {
    return 't' + Date.now() + Math.random().toString(36).substr(2, 9);
};

// Track active trace IDs and their expiration
const activeTraces = new Map();

// Log API calls in JSON format
const logApiCall = async (type, data) => {
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type,
            traceId: data.traceId,
            endpoint: data.endpoint,
            request: data.request,
            response: data.response,
            error: data.error,
            durationMs: data.durationMs
        };

        // Ensure log directory exists
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }

        // Append to log file
        const logData = fs.existsSync(CONFIG.logFile) 
            ? JSON.parse(await fs.promises.readFile(CONFIG.logFile, 'utf8'))
            : [];
        
        logData.push(logEntry);
        await fs.promises.writeFile(CONFIG.logFile, JSON.stringify(logData, null, 2));
        
        return logEntry;
    } catch (error) {
        console.error('Error writing to API log:', error);
    }
};

// Token management
let token = null;

/**
 * Log messages to file
 */
const logMessage = (message, logFile = CONFIG.logFile) => {
    try {
        fs.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
    } catch (error) {
        console.error('Error writing to log file:', error);
    }
};

/**
 * Save token to file
 */
const saveToken = (tokenData) => {
    try {
        tokenData.date = Date.now();
        fs.writeFileSync(CONFIG.tokenFile, JSON.stringify(tokenData));
        token = tokenData;
        logMessage(`Token saved: ${JSON.stringify(tokenData)}`);
    } catch (error) {
        console.error('Error saving token:', error);
        logMessage(`Error saving token: ${error.message}`);
    }
};

/**
 * Restore token from file if valid
 */
const restoreToken = () => {
    try {
        if (fs.existsSync(CONFIG.tokenFile)) {
            const tokenData = JSON.parse(fs.readFileSync(CONFIG.tokenFile, 'utf8'));
            if (isTokenValid(tokenData)) {
                token = tokenData;
                logMessage('Token restored from file');
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error restoring token:', error);
        logMessage(`Error restoring token: ${error.message}`);
        return false;
    }
};

/**
 * Check if token is still valid
 */
const isTokenValid = (tokenToCheck = token) => {
    if (!tokenToCheck || !tokenToCheck.date) return false;
    const tokenAge = Date.now() - tokenToCheck.date;
    // Consider token expired if it's older than (expires_in - 60) seconds
    return tokenAge < ((tokenToCheck.expires_in - 60) * 1000);
};

/**
 * Authenticate with TBO API
 * @returns {Promise<Object>} Authentication token
 */
async function authenticate() {
    try {
        if (USE_MOCK) {
            console.log('🔐 Using mock authentication');
            const mockToken = {
                TokenId: 'mock_token_' + Math.random().toString(36).substr(2, 9),
                Expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
                TokenType: 'Bearer',
                date: Date.now(),
                expires_in: 3600
            };
            saveToken(mockToken);
            return mockToken;
        }

        // Ensure we have all required credentials
        const authData = new URLSearchParams();
        authData.append('ClientId', CONFIG.clientId);
        authData.append('UserName', CONFIG.username);
        authData.append('Password', CONFIG.password);
        authData.append('EndUserIp', CONFIG.vpsIp);
        authData.append('LoginType', '1'); // 1 for API user

        if (CONFIG.debug) {
            console.log('🔑 Auth Request:', {
                url: CONFIG.authUrl,
                data: {
                    ClientId: CONFIG.clientId,
                    UserName: CONFIG.username,
                    Password: '***',
                    EndUserIp: CONFIG.vpsIp,
                    LoginType: '1'
                }
            });
        }

        // Construct the full authentication URL
        const authUrl = `${CONFIG.baseUrl}${CONFIG.authUrl}`;
        
        if (CONFIG.debug) {
            console.log('🔑 Full Auth URL:', authUrl);
        }

        // Make the authentication request
        const response = await axios({
            method: 'post',
            url: authUrl,
            data: authData.toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate, br',
                'User-Agent': 'GoingBo/1.0'
            },
            timeout: CONFIG.timeout,
            // Handle different response formats
            transformResponse: [function (data) {
                try {
                    return JSON.parse(data);
                } catch (e) {
                    return { raw: data };
                }
            }]
        });

        if (CONFIG.debug) {
            console.log('🔑 Auth Response:', {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: response.data
            });
        }

        // Handle different response formats
        let tokenData;
        const responseData = response.data;

        // Check for successful response with token
        if (responseData && responseData.TokenId) {
            tokenData = responseData;
        } 
        // Check for error in response
        else if (responseData && responseData.error) {
            throw new Error(responseData.error);
        }
        // Check for string response (common for some TBO endpoints)
        else if (typeof responseData === 'string') {
            if (responseData.includes('Invalid')) {
                throw new Error(responseData);
            }
            // Try to parse as JSON if it's a string
            try {
                const parsed = JSON.parse(responseData);
                if (parsed.TokenId) {
                    tokenData = parsed;
                } else {
                    throw new Error('Invalid token in response');
                }
            } catch (e) {
                throw new Error(`Invalid response: ${responseData}`);
            }
        } else {
            throw new Error('Invalid response format from TBO API');
        }

        // Calculate token expiration (default to 23 hours to be safe)
        const expiresIn = tokenData.ExpiresIn || (23 * 60 * 60);
        
        // Save token to file
        const tokenToSave = {
            ...tokenData,
            expires_at: Date.now() + (expiresIn * 1000) // Convert to milliseconds
        };

        // Ensure token directory exists
        await fs.promises.mkdir(path.dirname(CONFIG.tokenFile), { recursive: true });
        await fs.promises.writeFile(CONFIG.tokenFile, JSON.stringify(tokenToSave, null, 2));
        
        console.log('✅ Authentication successful');
        return tokenToSave;

    } catch (error) {
        const errorDetails = error.response?.data 
            ? typeof error.response.data === 'object' 
                ? JSON.stringify(error.response.data, null, 2)
                : error.response.data
            : error.message;
            
        const errorMsg = `❌ Authentication Error: ${error.message}\n${errorDetails}`;
        console.error(errorMsg);
        
        // Log to file
        await logApiCall('AUTH_ERROR', {
            error: {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                stack: error.stack
            }
        });
        
        throw new Error('Authentication failed: ' + (error.response?.data?.message || error.message));
    }
};

/**
 * Make authenticated request to TBO API
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Request parameters
 * @param {Object} req - Express request object
 * @param {boolean} useBookingApi - Whether to use booking API
 * @returns {Promise<Object>} API response
 */
async function makeRequest(endpoint, params = {}, req = {}, useBookingApi = false) {
    const startTime = Date.now();
    const traceId = generateTraceId();
    let response;
    
    try {
        if (USE_MOCK) {
            console.log(`🔧 Mock API Call: ${endpoint}`);
            return { 
                Response: {
                    Status: 1,
                    Results: [{
                        IsError: false,
                        TraceId: `mock-${Date.now()}`,
                        ...(params || {})
                    }]
                }
            };
        }

        // Ensure we have a valid token
        if (!token || !isTokenValid()) {
            console.log('🔑 No valid token found, authenticating...');
            token = await authenticate();
        }
        
        // Ensure we have a token
        if (!token || !token.TokenId) {
            throw new Error('No authentication token available');
        }

        // Determine the base URL to use
        const baseUrl = useBookingApi ? CONFIG.bookingBaseUrl : CONFIG.flightBaseUrl;
        const apiUrl = `${baseUrl}${endpoint}`;
        
        if (CONFIG.debug) {
            console.log(`🌐 [${traceId}] API URL:`, apiUrl);
        }

        // Prepare request parameters
        const requestParams = {
            ...params,
            TokenId: token.TokenId,
            ClientId: CONFIG.clientId,
            EndUserIp: CONFIG.vpsIp,
            TraceId: traceId,
            // Add any additional required parameters
            LoginType: '1',
            IsAgent: 'true'
        };

        // Log the request (without sensitive data)
        const loggableParams = { ...requestParams };
        if (loggableParams.TokenId) loggableParams.TokenId = '***' + loggableParams.TokenId.slice(-4);
        if (loggableParams.Password) loggableParams.Password = '***';

        // Log the API call
        if (CONFIG.debug) {
            console.log(`🌐 [${traceId}] Making ${endpoint} request to:`, apiUrl);
            console.log('📤 Request params:', JSON.stringify(loggableParams, null, 2));
        }
        
        await logApiCall('REQUEST', {
            traceId,
            endpoint,
            url: apiUrl,
            method: 'POST',
            request: loggableParams,
            timestamp: new Date().toISOString()
        });

        // Make the API request
        try {
            response = await axios({
                method: 'post',
                url: apiUrl,
                data: requestParams,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Authorization': `Bearer ${token.TokenId}`,
                    'Trace-Id': traceId,
                    'Client-Id': CONFIG.clientId,
                    'User-Agent': 'GoingBo/1.0',
                    'X-Forwarded-For': CONFIG.vpsIp,
                    'X-API-Key': CONFIG.clientId,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                responseType: 'json',
                decompress: true,
                timeout: CONFIG.timeout,
                validateStatus: () => true, // Always resolve to handle all status codes
                transformResponse: [function (data) {
                    try {
                        return typeof data === 'string' ? JSON.parse(data) : data;
                    } catch (e) {
                        return { raw: data };
                    }
                }]
            });
        } catch (error) {
            // Handle network errors
            if (error.code === 'ECONNABORTED') {
                throw new Error(`Request timeout after ${CONFIG.timeout}ms`);
            } else if (error.code === 'ENOTFOUND') {
                throw new Error(`Could not connect to TBO API: ${error.hostname}`);
            }
            throw error;
        }

        const durationMs = Date.now() - startTime;
        const responseData = response.data || {};
        
        // Log the response
        if (CONFIG.debug) {
            console.log(`✅ [${traceId}] ${endpoint} completed in ${durationMs}ms`);
            console.log(`📥 Response (${response.status}):`, 
                JSON.stringify(responseData, null, 2).substring(0, 1000) + 
                (JSON.stringify(responseData).length > 1000 ? '...' : ''));
        }

        // Log to file
        await logApiCall('RESPONSE', {
            traceId,
            endpoint,
            status: response.status,
            statusText: response.statusText,
            response: responseData,
            durationMs,
            timestamp: new Date().toISOString()
        });

        // Check for HTTP errors
        if (response.status >= 400) {
            const errorMsg = responseData?.Response?.Error?.ErrorMessage || 
                           responseData?.error?.message || 
                           responseData?.Message ||
                           `HTTP Error: ${response.status} ${response.statusText}`;
            
            const error = new Error(errorMsg);
            error.response = response;
            error.status = response.status;
            error.code = responseData?.Response?.Error?.ErrorCode || 
                        responseData?.error?.code ||
                        'API_ERROR';
            throw error;
        }

        // Check for TBO-specific error in successful response
        if (responseData && responseData.Response) {
            // Check for error in response
            if (responseData.Response.Error) {
                const error = new Error(
                    responseData.Response.Error.ErrorMessage || 
                    responseData.Response.Error.Message || 
                    'TBO API error'
                );
                error.response = response;
                error.status = response.status;
                error.code = responseData.Response.Error.ErrorCode || 'TBO_API_ERROR';
                throw error;
            }
            
            // Check for IsError flag in response
            if (responseData.Response.IsError === true) {
                const error = new Error(
                    responseData.Response.ErrorMessage || 
                    responseData.Response.Message || 
                    'TBO API returned an error'
                );
                error.response = response;
                error.status = response.status;
                error.code = responseData.Response.ErrorCode || 'TBO_API_ERROR';
                throw error;
            }
            
            // Check for status in response
            if (responseData.Response.Status !== 1 && responseData.Response.Status !== '1') {
                const error = new Error(
                    responseData.Response.ErrorMessage || 
                    responseData.Response.Message || 
                    `TBO API returned status: ${responseData.Response.Status}`
                );
                error.response = response;
                error.status = response.status;
                error.code = responseData.Response.ErrorCode || 'TBO_API_STATUS_ERROR';
                throw error;
            }
        }

        return responseData;
    } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorResponse = error.response?.data || {};
        const errorMessage = error.message || 'Unknown error';
        const errorCode = error.code || error.status || 'UNKNOWN_ERROR';
        
        // Format error details
        let errorDetails = {
            message: errorMessage,
            code: errorCode,
            endpoint,
            status: error.response?.status,
            response: errorResponse,
            stack: CONFIG.debug ? error.stack : undefined
        };
        
        // Log the error
        console.error(`❌ [${traceId}] ${endpoint} failed after ${durationMs}ms:`, 
            JSON.stringify(errorDetails, null, 2));
        
        // Log to file
        try {
            await logApiCall('ERROR', {
                traceId,
                endpoint,
                error: errorDetails,
                durationMs,
                timestamp: new Date().toISOString()
            });
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }

        // Handle token expiration (401 Unauthorized)
        if (error.response?.status === 401 || 
            errorCode === 'UNAUTHORIZED' || 
            errorMessage.toLowerCase().includes('token') ||
            (errorResponse.Response?.Error?.ErrorCode === '040' || // Token expired
             errorResponse.Response?.Error?.ErrorCode === '041')) { // Invalid token
            
            try {
                console.log(`🔄 [${traceId}] Token expired or invalid, attempting to refresh...`);
                
                // Clear the current token
                token = null;
                
                // Try to authenticate again
                token = await authenticate();
                
                console.log(`🔄 [${traceId}] Token refreshed, retrying request...`);
                
                // Update the token in the params
                const newParams = { ...params };
                if (newParams.TokenId) newParams.TokenId = token.TokenId;
                
                // Retry the request with the new token
                return makeRequest(endpoint, newParams, req, useBookingApi);
                
            } catch (refreshError) {
                const refreshErrorMsg = `Failed to refresh token: ${refreshError.message}`;
                console.error(`❌ [${traceId}] ${refreshErrorMsg}`);
                
                // If we can't refresh the token, clear it so we'll get a new one next time
                token = null;
                
                throw new Error(`Authentication failed: ${refreshError.message}`);
            }
        }
        
        // Handle rate limiting (429 Too Many Requests)
        if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'] || 5;
            console.log(`⏳ [${traceId}] Rate limited, retrying after ${retryAfter} seconds...`);
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            
            // Retry the request
            return makeRequest(endpoint, params, req, useBookingApi);
        }
        
        // For other errors, include more context in the error message
        const errorMsg = errorResponse?.Response?.Error?.ErrorMessage || 
                        errorResponse?.error?.message || 
                        errorMessage;
        
        const enhancedError = new Error(errorMsg);
        enhancedError.originalError = error;
        enhancedError.code = errorCode;
        enhancedError.status = error.response?.status;
        enhancedError.response = error.response;
        
        throw enhancedError;
    } finally {
        // Clean up expired trace IDs
        const now = Date.now();
        for (const [traceId, expiry] of activeTraces.entries()) {
            if (expiry < now) {
                activeTraces.delete(traceId);
            }
        }
    }
};

/**
 * Flight API Methods
 */

/**
 * Search for flights
 * @param {Object} searchParams - Search parameters
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} Search results
 */
/**
 * Search for flights
 * @param {Object} searchParams - Search parameters
 * @param {string} searchParams.origin - Origin airport code (e.g., 'DEL')
 * @param {string} searchParams.destination - Destination airport code (e.g., 'BOM')
 * @param {string} searchParams.departureDate - Departure date (YYYY-MM-DD)
 * @param {string} [searchParams.returnDate] - Return date for round trips (YYYY-MM-DD)
 * @param {number} [searchParams.adults=1] - Number of adult passengers
 * @param {number} [searchParams.children=0] - Number of child passengers
 * @param {number} [searchParams.infants=0] - Number of infant passengers
 * @param {string} [searchParams.cabinClass='Economy'] - Cabin class (Economy, Business, First)
 * @param {string} [searchParams.journeyType='1'] - Journey type ('1' for one-way, '2' for round-trip)
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} Search results
 */
export const searchFlights = async (searchParams = {}, req = {}) => {
    const traceId = generateTraceId();
    
    // Use mock data if enabled
    if (USE_MOCK) {
        console.log('🔍 Using mock flight search');
        return {
            success: true,
            data: [{
                id: 'FL123',
                airline: 'IndiGo',
                flightNumber: '6E-123',
                origin: searchParams.origin || 'DEL',
                destination: searchParams.destination || 'BOM',
                departureTime: '2024-12-15T08:00:00',
                arrivalTime: '2024-12-15T10:15:00',
                duration: '2h 15m',
                price: 4500,
                currency: 'INR',
                availableSeats: 5,
                sessionId: 'test-session-123',
                resultIndex: '1',
                fareRules: {
                    refundable: false,
                    changes: 'Not allowed',
                    baggage: '7kg cabin + 15kg check-in'
                }
            }],
            traceId
        };
    }

    try {
        // Validate required parameters
        if (!searchParams.origin || !searchParams.destination || !searchParams.departureDate) {
            throw new Error('Missing required search parameters: origin, destination, departureDate');
        }

        // Prepare search parameters for TBO API
        const tboSearchParams = {
            EndUserIp: CONFIG.vpsIp,
            TokenId: '', // Will be set in makeRequest
            AdultCount: parseInt(searchParams.adults) || 1,
            ChildCount: parseInt(searchParams.children) || 0,
            InfantCount: parseInt(searchParams.infants) || 0,
            DirectFlight: Boolean(searchParams.nonStop),
            OneStopFlight: false,
            JourneyType: searchParams.journeyType === 'roundtrip' ? '2' : '1',
            Segments: [
                {
                    Origin: String(searchParams.origin).toUpperCase(),
                    Destination: String(searchParams.destination).toUpperCase(),
                    FlightCabinClass: searchParams.cabinClass || 'Economy',
                    PreferredDepartureTime: formatDate(searchParams.departureDate),
                    PreferredArrivalTime: ''
                }
            ],
            Sources: ['TBO'],
            PreferredAirlines: searchParams.preferredAirlines || [],
            Currency: searchParams.currency || 'INR',
            IsDomestic: true,
            IncludeAllFlightOptions: true,
            IsRefundable: Boolean(searchParams.refundableOnly),
            NoOfSeats: (parseInt(searchParams.adults) || 1) + (parseInt(searchParams.children) || 0),
            TraceId: traceId
        };

        // Add return segment for round trips
        if (searchParams.journeyType === 'roundtrip' && searchParams.returnDate) {
            tboSearchParams.Segments.push({
                Origin: String(searchParams.destination).toUpperCase(),
                Destination: String(searchParams.origin).toUpperCase(),
                FlightCabinClass: searchParams.cabinClass || 'Economy',
                PreferredDepartureTime: formatDate(searchParams.returnDate),
                PreferredArrivalTime: ''
            });
        }

        if (CONFIG.debug) {
            console.log(`✈️ [${traceId}] Flight search request:`, JSON.stringify(tboSearchParams, null, 2));
        }
        
        // Make the API request
        const response = await makeRequest('/Search', tboSearchParams, req);
        
        // Process TBO API response
        if (!response || !response.Response) {
            throw new Error('Invalid response format from TBO API');
        }

        // Check for errors in response
        if (response.Response.Error) {
            throw new Error(response.Response.Error.ErrorMessage || 'Error in flight search');
        }

        if (!response.Response.Results || !Array.isArray(response.Response.Results)) {
            throw new Error('No flight results found in response');
        }

        // Extract and format flight results
        const results = [];
        const segments = response.Response.Results[0]?.Segments || [];
        const traceIdFromResponse = response.Response.TraceId || traceId;
        
        segments.forEach((segment, segmentIndex) => {
            if (!segment.Flights || !Array.isArray(segment.Flights)) return;
            
            segment.Flights.forEach((flight, flightIndex) => {
                const flightId = `${flight.Airline?.FlightNumber || 'FLT'}-${segmentIndex}-${flightIndex}`;
                const fare = flight.Fare || {};
                const airline = flight.Airline || {};
                const origin = flight.Origin || {};
                const destination = flight.Destination || {};
                
                results.push({
                    id: flightId,
                    airline: {
                        code: airline.AirlineCode,
                        name: airline.AirlineName,
                        number: airline.FlightNumber,
                        logo: airline.AirlineLogo
                    },
                    flightNumber: airline.FlightNumber,
                    origin: {
                        code: origin.AirportCode,
                        name: origin.AirportName,
                        city: origin.CityName,
                        terminal: origin.Terminal,
                        dateTime: origin.DepTime,
                        date: origin.DepTime ? new Date(origin.DepTime).toISOString().split('T')[0] : ''
                    },
                    destination: {
                        code: destination.AirportCode,
                        name: destination.AirportName,
                        city: destination.CityName,
                        terminal: destination.Terminal,
                        dateTime: destination.ArrTime,
                        date: destination.ArrTime ? new Date(destination.ArrTime).toISOString().split('T')[0] : ''
                    },
                    departureTime: origin.DepTime,
                    arrivalTime: destination.ArrTime,
                    duration: flight.Duration || '',
                    stops: parseInt(flight.NoOfStops) || 0,
                    cabinClass: flight.CabinClass || searchParams.cabinClass || 'Economy',
                    fare: {
                        baseFare: fare.BaseFare || 0,
                        tax: fare.Tax || 0,
                        otherCharges: fare.OtherCharges || 0,
                        discount: fare.Discount || 0,
                        publishedFare: fare.PublishedFare || 0,
                        currency: fare.Currency || 'INR',
                        isRefundable: fare.IsRefundable || false,
                        isLCC: fare.IsLCC || false
                    },
                    availableSeats: flight.SeatsAvailable || 0,
                    bookingClass: flight.BookingClass || '',
                    fareBasis: flight.FareBasis || '',
                    fareRules: flight.FareRules || {},
                    baggage: flight.Baggage || {},
                    amenities: flight.Amenities || {},
                    sessionId: traceIdFromResponse,
                    resultIndex: segmentIndex.toString(),
                    isETicketEligible: flight.IsETicketEligible || false,
                    isMealIncluded: flight.IsMealIncluded || false,
                    isVisaRequired: flight.IsVisaRequired || false
                });
            });
        });

        return {
            success: true,
            data: results,
            searchId: response.Response.SearchId,
            traceId: traceIdFromResponse,
            currency: tboSearchParams.Currency,
            isDomestic: tboSearchParams.IsDomestic,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`❌ [${traceId}] Flight search error:`, error);
        
        // Format error response
        const errorResponse = {
            success: false,
            error: {
                code: error.code || 'SEARCH_ERROR',
                message: error.message || 'Failed to search for flights',
                details: error.response?.data || {},
                status: error.status || 500
            },
            traceId,
            timestamp: new Date().toISOString()
        };
        
        // Log the error
        await logApiCall('FLIGHT_SEARCH_ERROR', {
            traceId,
            error: errorResponse.error,
            searchParams,
            timestamp: new Date().toISOString()
        });
        
        return errorResponse;
    }
};

/**
 * Format date for TBO API (YYYY-MM-DD)
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

/**
 * Get fare rules
 */
export const getFareRules = async (resultIndex, traceId, req) => {
    return makeRequest('/fare-rules', { resultIndex, traceId }, req);
};

/**
 * Get fare quote
 */
export const getFareQuote = async (resultIndex, traceId, req) => {
    return makeRequest('/fare-quote', { resultIndex, traceId }, req);
};

/**
 * Get SSR (Special Service Requests)
 */
export const getSSR = async (resultIndex, traceId, req) => {
    return makeRequest('/ssr', { resultIndex, traceId }, req);
};

/**
 * Book a flight
 */
export const bookFlight = async (bookingData, req) => {
    return makeRequest('/book', bookingData, req, true);
};

/**
 * Confirm booking
 */
export const confirmBooking = async (bookingData, req) => {
    if (USE_MOCK) {
        console.log('✅ Using mock booking confirmation');
        return {
            status: 'success',
            data: {
                bookingId: `MOCK-${Date.now()}`,
                status: 'CONFIRMED',
                pnr: `PNR${Math.floor(100000 + Math.random() * 900000)}`,
                ...bookingData
            }
        };
    }
    return makeRequest('/confirm-booking', bookingData, req, true);
};

/**
 * Get booking details
 */
export const getBookingDetails = async (bookingId, req) => {
    return makeRequest(`/bookings/${bookingId}`, {}, req, true);
};

/**
 * Release PNR (cancel booking)
 */
export const releasePNR = async (bookingId, req) => {
    return makeRequest(`/bookings/${bookingId}/release`, {}, req, true);
};

/**
 * Get cancellation charges
 */
export const getCancellationCharges = async (bookingId, req) => {
    return makeRequest(`/bookings/${bookingId}/cancellation-charges`, {}, req, true);
};

/**
 * Send change request
 */
export const sendChangeRequest = async (bookingId, changeData, req) => {
    return makeRequest(`/bookings/${bookingId}/change-request`, changeData, req, true);
};

/**
 * Get change request status
 */
export const getChangeRequestStatus = async (requestId, req) => {
    return makeRequest(`/change-requests/${requestId}`, {}, req, true);
};

/**
 * Get calendar fare
 */
export const getCalendarFare = async (params, req) => {
    return makeRequest('/calendar-fare', params, req);
};

// Initialize token if not in mock mode
if (!USE_MOCK) {
    restoreToken();
}