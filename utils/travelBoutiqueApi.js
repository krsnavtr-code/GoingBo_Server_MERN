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
                TokenId: 'mock_token_' + Math.random().toString(36).substr(2, 9),
                Expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
                TokenType: 'Bearer',
                date: Date.now(),
                expires_in: 3600
            };
            saveToken(mockToken);
            return mockToken;
        }

        // TBO API requires JSON payload for authentication
        const authUrl = `${CONFIG.baseUrl}/SharedAPI/SharedData.svc/rest/Authenticate`;
        logMessage(`🔑 Authenticating with TBO API: ${authUrl}`);

        const authData = {
            ClientId: CONFIG.clientId,
            UserName: process.env.TRAVEL_BOUTIQUE_USERNAME,
            Password: process.env.TRAVEL_BOUTIQUE_PASSWORD,
            EndUserIp: '127.0.0.1' // Default IP for server-side calls
        };

        console.log('Auth request data:', JSON.stringify(authData, null, 2));

        const response = await axios({
            method: 'post',
            url: authUrl,
            data: authData,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 15000, // 15 seconds timeout for auth
            validateStatus: (status) => status >= 200 && status < 500
        });

        console.log('Auth response:', {
            status: response.status,
            data: response.data
        });

        if (response.data && response.data.TokenId) {
            const tokenData = {
                TokenId: response.data.TokenId,
                Expiry: response.data.Expiry,
                TokenType: 'Bearer',
                date: Date.now(),
                expires_in: 3600, // TBO tokens typically expire in 1 hour
                // For backward compatibility
                access_token: response.data.TokenId,
                token_type: 'Bearer'
            };
            
            saveToken(tokenData);
            return tokenData;
        } else if (response.data && response.data.Error) {
            throw new Error(response.data.Error.ErrorMessage || 'Authentication failed');
        }
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
            TokenId: token.TokenId || token.access_token,
            ClientId: CONFIG.clientId,
            EndUserIp: getClientIp(req)
        };

        // Log the request (without sensitive data)
        const loggableParams = { ...requestParams };
        if (loggableParams.TokenId) {
            loggableParams.TokenId = '***' + loggableParams.TokenId.slice(-4);
        }
        logMessage(`TBO API Request to ${url}: ${JSON.stringify(loggableParams, null, 2)}`);

        console.log('Making API request to:', url);
        console.log('Request params:', JSON.stringify({
            ...requestParams,
            TokenId: '***' + (requestParams.TokenId ? requestParams.TokenId.slice(-4) : '')
        }, null, 2));

        // Make the API request
        const response = await axios({
            method: 'post',
            url,
            data: requestParams,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token.TokenId || token.access_token}`
            },
            timeout: 45000, // 45 seconds timeout for TBO API
            validateStatus: () => true // Always resolve to handle all status codes
        });

        console.log('API Response:', {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data
        });

        // Log the response
        logMessage(`TBO API Response (${response.status}): ${JSON.stringify(response.data, null, 2)}`);

        // Check for HTTP errors
        if (response.status >= 400) {
            const error = new Error(response.data?.Response?.Error?.ErrorMessage || 
                                 response.data?.error?.message || 
                                 `HTTP Error: ${response.status} ${response.statusText}`);
            error.response = response;
            error.status = response.status;
            throw error;
        }

        // Check for TBO-specific error in successful response
        if (response.data && response.data.Response && response.data.Response.Error) {
            const error = new Error(response.data.Response.Error.ErrorMessage || 'TBO API error');
            error.response = response;
            error.status = response.status;
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
                    FlightCabinClass: searchParams.cabinClass || '1', // 1: Economy, 2: Premium Economy, etc.
                    PreferredDepartureTime: searchParams.departureDate,
                    PreferredArrivalTime: ''
                }
            ],
            Sources: ['TBO'],
            PreferredAirlines: [],
            Currency: 'INR',
            IsDomestic: true, // Set based on origin/destination if needed
            IncludeAllFlightOptions: true
        };

        // Add return segment for round trips
        if (searchParams.journeyType === '2' && searchParams.returnDate) {
            tboSearchParams.Segments.push({
                Origin: searchParams.destination,
                Destination: searchParams.origin,
                FlightCabinClass: searchParams.cabinClass || '1',
                PreferredDepartureTime: searchParams.returnDate,
                PreferredArrivalTime: ''
            });
        }

        console.log('Sending search request to TBO:', JSON.stringify(tboSearchParams, null, 2));
        
        // Use the correct TBO API endpoint for flight search
        const response = await makeRequest('/Search', tboSearchParams, req);
        
        // Process TBO API response
        if (!response || !response.Response || !response.Response.Results) {
            console.error('Invalid response format from TBO API:', response);
            throw new Error('Invalid response format from TBO API');
        }

        // Extract flight results
        const results = [];
        const segments = response.Response.Results[0]?.Segments || [];
        
        segments.forEach((segment, index) => {
            segment.Flights.forEach(flight => {
                // Format flight duration
                const durationInMinutes = flight.Duration || 0;
                const hours = Math.floor(durationInMinutes / 60);
                const minutes = durationInMinutes % 60;
                const duration = `${hours}h ${minutes}m`;
                
                results.push({
                    id: `${flight.Airline.FlightNumber}-${index}`,
                    airline: flight.Airline.AirlineName || 'Unknown Airline',
                    flightNumber: flight.Airline.FlightNumber || 'N/A',
                    origin: flight.Origin?.AirportCode || searchParams.origin,
                    destination: flight.Destination?.AirportCode || searchParams.destination,
                    departureTime: flight.Origin?.DepTime || searchParams.departureDate,
                    arrivalTime: flight.Destination?.ArrTime || '',
                    duration: duration,
                    price: flight.Fare?.PublishedFare || 0,
                    currency: flight.Fare?.Currency || 'INR',
                    availableSeats: flight.SeatsAvailable || 0,
                    sessionId: response.Response.TraceId || 'N/A',
                    resultIndex: index.toString(),
                    fareRules: flight.FareRules || {},
                    baggage: flight.Baggage || {},
                    cabinClass: flight.CabinClass || searchParams.cabinClass || '1',
                    // Additional flight details
                    stops: segment.NoOfStops || 0,
                    aircraftType: flight.AircraftType || 'N/A',
                    airlineCode: flight.Airline.AirlineCode || 'N/A',
                    // Add fare details if available
                    fare: {
                        baseFare: flight.Fare?.BaseFare || 0,
                        tax: flight.Fare?.Tax || 0,
                        totalFare: flight.Fare?.PublishedFare || 0,
                        serviceFee: flight.Fare?.ServiceFee || 0
                    },
                    // Add segment details
                    segment: {
                        departureTerminal: flight.Origin?.AirportTerminal || 'N/A',
                        arrivalTerminal: flight.Destination?.AirportTerminal || 'N/A',
                        operatingAirline: flight.OperatingCarrier?.AirlineName || flight.Airline.AirlineName
                    }
                });
            });
        });

        return {
            success: true,
            data: results,
            traceId: response.Response.TraceId || 'N/A',
            searchParams: searchParams
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