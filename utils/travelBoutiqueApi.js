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
    clientId: process.env.TRAVEL_BOUTIQUE_CLIENT_ID,
    clientSecret: process.env.TRAVEL_BOUTIQUE_CLIENT_SECRET,
    baseUrl: process.env.TRAVEL_BOUTIQUE_API_URL,
    flightApiUrl: process.env.TRAVEL_BOUTIQUE_FLIGHT_API_URL,
    bookingApiUrl: process.env.TRAVEL_BOUTIQUE_BOOKING_API_URL,
    tokenFile: path.join(TOKEN_DIR, 'tbo_token.json'),
    logFile: path.join(LOG_DIR, `log_${new Date().toISOString().split('T')[0]}.txt`)
};

// Enable mock mode in development
const USE_MOCK = process.env.NODE_ENV === 'development' && process.env.USE_MOCK !== 'false';

// Token management
let token = null;

/**
 * Get the client's IP address
 */
const getClientIp = (req) => {
    return req?.ip || '127.0.0.1';
};

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
 * Authenticate with TBO API using OAuth2 client credentials
 */
export const authenticate = async () => {
    try {
        if (USE_MOCK) {
            console.log('🔐 Using mock authentication');
            const mockToken = {
                access_token: 'mock_access_token_' + Math.random().toString(36).substr(2, 9),
                expires_in: 3600,
                token_type: 'Bearer',
                date: Date.now()
            };
            saveToken(mockToken);
            return mockToken;
        }

        // TBO API requires form-urlencoded for authentication
        const params = new URLSearchParams();
        params.append('client_id', CONFIG.clientId);
        params.append('client_secret', CONFIG.clientSecret);
        params.append('grant_type', 'client_credentials');

        const authUrl = `${CONFIG.baseUrl}/auth/token`;
        logMessage(`🔑 Authenticating with TBO API: ${authUrl}`);

        const response = await axios({
            method: 'post',
            url: authUrl,
            data: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            timeout: 15000, // 15 seconds timeout for auth
            validateStatus: (status) => status >= 200 && status < 300
        });

        logMessage(`✅ TBO Authentication successful`);

        if (response.data && response.data.access_token) {
            const tokenData = {
                access_token: response.data.access_token,
                expires_in: response.data.expires_in || 3600, // Default to 1 hour if not provided
                token_type: response.data.token_type || 'Bearer',
                date: Date.now(),
                // Store additional TBO-specific data if needed
                tbo_token: response.data.access_token,
                tbo_token_type: response.data.token_type || 'Bearer'
            };
            
            saveToken(tokenData);
            return tokenData;
        }

        throw new Error('Authentication failed - Invalid response format from TBO API');
    } catch (error) {
        const errorMsg = `Authentication Error: ${error.message}\n${error.response?.data ? JSON.stringify(error.response.data) : ''}`;
        logMessage(errorMsg);
        console.error('❌', errorMsg);
        throw new Error('Authentication failed: ' + (error.response?.data?.message || error.message));
    }
};

/**
 * Make authenticated request to TBO API
 */
const makeRequest = async (endpoint, params, req, useBookingApi = false) => {
    try {
        if (USE_MOCK) {
            console.log(`🔧 Mock API Call: ${endpoint}`);
            return { status: 'success', data: { mock: true } };
        }

        // Ensure we have a valid token
        if (!token || !isTokenValid()) {
            token = await authenticate();
        }

        // Determine the base URL based on the endpoint
        const baseUrl = useBookingApi ? CONFIG.bookingApiUrl : CONFIG.flightApiUrl;
        const url = `${baseUrl}${endpoint}`;

        // Prepare request parameters
        const requestParams = {
            ...params,
            TokenId: token.access_token,
            ClientId: CONFIG.clientId,
            EndUserIp: getClientIp(req)
        };

        // Log the request (without sensitive data)
        const loggableParams = { ...requestParams };
        if (loggableParams.TokenId) {
            loggableParams.TokenId = '***' + loggableParams.TokenId.slice(-4);
        }
        logMessage(`TBO API Request to ${url}: ${JSON.stringify(loggableParams, null, 2)}`);

        // Make the API request
        const response = await axios({
            method: 'post',
            url,
            data: requestParams,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token.access_token}`
            },
            timeout: 45000, // 45 seconds timeout for TBO API
            validateStatus: (status) => status >= 200 && status < 500
        });

        // Log the response
        logMessage(`TBO API Response (${response.status}): ${JSON.stringify(response.data, null, 2)}`);

        // Check for API errors
        if (response.status >= 400) {
            const error = new Error(response.data?.Response?.Error?.ErrorMessage || 'API request failed');
            error.response = response;
            throw error;
        }

        // Check for TBO-specific error in successful response
        if (response.data && response.data.Response && response.data.Response.Error) {
            const error = new Error(response.data.Response.Error.ErrorMessage || 'TBO API error');
            error.response = response;
            throw error;
        }

        return response.data;
    } catch (error) {
        const errorMsg = `API Error (${endpoint}): ${error.message}\n${error.response?.data ? JSON.stringify(error.response.data) : ''}`;
        logMessage(errorMsg);
        console.error('❌', errorMsg);

        // If unauthorized, try to refresh token once
        if (error.response?.status === 401) {
            token = null;
            return makeRequest(endpoint, params, req, useBookingApi);
        }

        throw new Error(`API request failed: ${error.message}`);
    }
};

/**
 * Flight API Methods
 */

/**
 * Search for flights
 */
export const searchFlights = async (searchParams, req) => {
    if (USE_MOCK) {
        console.log('🔍 Using mock flight search');
        // Return mock flight data for testing
        return {
            success: true,
            data: [
                {
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
                    resultIndex: '1'
                }
            ]
        };
    }

    try {
        // Format search parameters according to TBO API requirements
        const tboSearchParams = {
            EndUserIp: getClientIp(req),
            TokenId: '', // Will be set in makeRequest
            AdultCount: parseInt(searchParams.adults) || 1,
            ChildCount: parseInt(searchParams.children) || 0,
            InfantCount: parseInt(searchParams.infants) || 0,
            DirectFlight: searchParams.nonStop || false,
            OneStopFlight: false,
            JourneyType: searchParams.journeyType || '1', // 1 for OneWay, 2 for Return
            Segments: [
                {
                    Origin: searchParams.origin,
                    Destination: searchParams.destination,
                    FlightCabinClass: searchParams.cabinClass || 'Economy',
                    PreferredDepartureTime: searchParams.departureDate,
                    PreferredArrivalTime: ''
                }
            ],
            Sources: ['TBO']
        };

        // Add return segment for round trips
        if (searchParams.journeyType === '2' && searchParams.returnDate) {
            tboSearchParams.Segments.push({
                Origin: searchParams.destination,
                Destination: searchParams.origin,
                FlightCabinClass: searchParams.cabinClass || 'Economy',
                PreferredDepartureTime: searchParams.returnDate,
                PreferredArrivalTime: ''
            });
        }

        console.log('Sending search request to TBO:', JSON.stringify(tboSearchParams, null, 2));
        
        const response = await makeRequest('/Search', tboSearchParams, req);
        
        // Process TBO API response
        if (!response || !response.Response || !response.Response.Results) {
            throw new Error('Invalid response format from TBO API');
        }

        // Extract flight results
        const results = [];
        const segments = response.Response.Results[0]?.Segments || [];
        
        segments.forEach((segment, index) => {
            segment.Flights.forEach(flight => {
                results.push({
                    id: `${flight.Airline.FlightNumber}-${index}`,
                    airline: flight.Airline.AirlineName,
                    flightNumber: flight.Airline.FlightNumber,
                    origin: flight.Origin.AirportCode,
                    destination: flight.Destination.AirportCode,
                    departureTime: flight.Origin.DepTime,
                    arrivalTime: flight.Destination.ArrTime,
                    duration: flight.Duration,
                    price: flight.Fare.PublishedFare,
                    currency: flight.Fare.Currency,
                    availableSeats: flight.SeatsAvailable,
                    sessionId: response.Response.TraceId,
                    resultIndex: index.toString(),
                    fareRules: flight.FareRules,
                    baggage: flight.Baggage,
                    cabinClass: flight.CabinClass
                });
            });
        });

        return {
            success: true,
            data: results,
            traceId: response.Response.TraceId
        };
        
    } catch (error) {
        console.error('Flight search error:', error);
        
        // Extract error message from TBO response if available
        let errorMessage = 'Failed to search for flights';
        if (error.response?.data?.Response?.Error) {
            errorMessage = error.response.data.Response.Error.ErrorMessage || errorMessage;
        } else if (error.response?.data?.error) {
            errorMessage = error.response.data.error.message || errorMessage;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        return {
            success: false,
            error: {
                code: error.response?.data?.Response?.Error?.ErrorCode || 'SEARCH_ERROR',
                message: errorMessage
            }
        };
    }
};

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