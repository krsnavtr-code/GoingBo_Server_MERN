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
                access_token: 'mock_access_token',
                expires_in: 3600,
                token_type: 'Bearer',
                date: Date.now()
            };
            saveToken(mockToken);
            return mockToken;
        }

        const params = new URLSearchParams();
        params.append('client_id', CONFIG.clientId);
        params.append('client_secret', CONFIG.clientSecret);
        params.append('grant_type', 'client_credentials');

        logMessage(`Authentication Request: ${CONFIG.baseUrl}/auth/token`);

        const response = await axios.post(
            `${CONFIG.baseUrl}/auth/token`,
            params,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                timeout: 10000
            }
        );

        logMessage(`Authentication Response: ${JSON.stringify(response.data)}`);

        if (response.data && response.data.access_token) {
            const tokenData = {
                access_token: response.data.access_token,
                expires_in: response.data.expires_in || 3600, // Default to 1 hour if not provided
                token_type: response.data.token_type || 'Bearer',
                date: Date.now()
            };
            saveToken(tokenData);
            return tokenData;
        }

        throw new Error('Authentication failed - No access token received');
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
            // We'll handle mock responses in individual methods
            return { status: 'success', data: { mock: true } };
        }

        // Restore or get new token
        if (!token || !isTokenValid()) {
            token = await authenticate();
        }

        const baseUrl = useBookingApi ? CONFIG.bookingApiUrl : CONFIG.flightApiUrl;
        const url = `${baseUrl}${endpoint}`;

        // Add common parameters
        const requestParams = {
            ...params,
            ClientId: CONFIG.clientId,
            EndUserIp: getClientIp(req)
        };

        logMessage(`API Request: ${url} - ${JSON.stringify(requestParams)}`);

        const response = await axios.post(url, requestParams, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${token.token_type} ${token.access_token}`,
                'Accept': 'application/json'
            },
            timeout: 30000 // 30 seconds timeout
        });

        logMessage(`API Response (${response.status}): ${JSON.stringify(response.data)}`);
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
        // Return mock flight data
        return {
            status: 'success',
            data: {
                results: [
                    // Mock flight data here
                ]
            }
        };
    }

    return makeRequest('/search', searchParams, req);
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