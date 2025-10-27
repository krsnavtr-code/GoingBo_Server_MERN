import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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
    hotelApiUrl: 'https://affiliate.travelboutiqueonline.com/HotelAPI',
    bookingApiUrl: 'https://hotelbooking.travelboutiqueonline.com/HotelAPI_V10/HotelService.svc/rest',
    logFile: path.join(LOG_DIR, `hotel_${new Date().toISOString().split('T')[0]}.log`),
    auth: null
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
const makeHotelRequest = async (endpoint, params = {}, method = 'post', isBookingApi = false) => {
    try {
        const baseUrl = isBookingApi ? CONFIG.bookingApiUrl : CONFIG.hotelApiUrl;
        const url = `${baseUrl}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${getAuthToken()}`
        };

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
export const searchHotels = async (params) => {
    return makeHotelRequest('/Search', params);
};

export const getHotelDetails = async (params) => {
    return makeHotelRequest('/Hoteldetails', params);
};

export const preBookHotel = async (params) => {
    return makeHotelRequest('/PreBook', params);
};

export const bookHotel = async (params) => {
    return makeHotelRequest('/Book', params, 'post', true);
};

export const getBookingDetails = async (bookingId) => {
    return makeHotelRequest('/GetBookingDetail', { BookingId: bookingId }, 'post', true);
};

export const getHotelCodeList = async (params) => {
    return makeHotelRequest('/TBOHotelCodeList', params);
};

export default {
    searchHotels,
    getHotelDetails,
    preBookHotel,
    bookHotel,
    getBookingDetails,
    getHotelCodeList
};