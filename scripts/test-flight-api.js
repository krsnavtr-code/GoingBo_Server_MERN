// test-tbo-api.js
import axios from 'axios';
import dotenv from 'dotenv';
import { authenticate } from '../utils/travelBoutiqueApi.js';

dotenv.config();

// Mock request object with IP address
const mockRequest = {
  headers: {
    'x-forwarded-for': '127.0.0.1',
    'x-real-ip': '127.0.0.1'
  },
  connection: {
    remoteAddress: '127.0.0.1'
  }
};

const BASE_URL = 'http://localhost:5000/api/v1/flights';
const SEARCH_ENDPOINT = `${BASE_URL}/search`;
const FARE_RULES_ENDPOINT = `${BASE_URL}/fare-rules`;
const FARE_QUOTE_ENDPOINT = `${BASE_URL}/fare-quote`;
const BOOK_FLIGHT_ENDPOINT = `${BASE_URL}/book`;

// Test authentication
async function testAuthentication() {
  try {
    console.log('🔑 Testing authentication...');
    
    // Log the credentials being used (safely)
    console.log('Using TBO API endpoint:', process.env.TRAVEL_BOUTIQUE_API_URL);
    console.log('Client ID:', process.env.TRAVEL_BOUTIQUE_CLIENT_ID);
    console.log('Username:', process.env.TRAVEL_BOUTIQUE_USERNAME);
    console.log('Password:', process.env.TRAVEL_BOUTIQUE_PASSWORD ? '*** (set)' : 'Not set');
    
    // Make a direct test request to the TBO API
    console.log('\nSending authentication request to TBO API...');
    const authUrl = `${process.env.TRAVEL_BOUTIQUE_API_URL}/SharedAPI/SharedData.svc/rest/Authenticate`;
    console.log('Auth URL:', authUrl);
    
    const authParams = {
      ClientId: process.env.TRAVEL_BOUTIQUE_CLIENT_ID,
      UserName: process.env.TRAVEL_BOUTIQUE_USERNAME,
      Password: process.env.TRAVEL_BOUTIQUE_PASSWORD,
      EndUserIp: '127.0.0.1'
    };
    
    console.log('Auth Params:', JSON.stringify(authParams, null, 2));
    
    const response = await axios.post(authUrl, authParams, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('\n✅ Authentication Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.TokenId) {
      console.log('\n🔑 Authentication successful!');
      console.log('Token ID:', response.data.TokenId);
      console.log('Token Expires:', new Date(response.data.Expiry).toLocaleString());
      return response.data;
    }
    
    throw new Error('Authentication failed - No token received');
  } catch (error) {
    console.error('\n❌ Authentication failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received from server');
      console.error('Request config:', {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      });
    } else {
      console.error('Error:', error.message);
    }
    throw new Error('Authentication failed: ' + (error.response?.data?.message || error.message));
  }
}

// Test search flights
async function testSearchFlights() {
    try {
        // First authenticate
        await testAuthentication();
        
        const searchParams = {
            origin: 'DEL',
            destination: 'BOM',
            departureDate: '2024-01-15',
            // journeyType is not in the validation, but we'll keep it in case it's used elsewhere
            adults: 1,
            children: 0,
            infants: 0,
            cabinClass: 'Economy',
            nonStop: false
        };

        console.log('Testing flight search with params:', JSON.stringify(searchParams, null, 2));
        console.log('Sending request to:', SEARCH_ENDPOINT);
        
        const response = await axios.post(SEARCH_ENDPOINT, searchParams, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 10000 // 10 seconds timeout
        });
        
        console.log('✅ Search successful! Status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.error('❌ Search failed!');
        if (error.response) {
            // The request was made and the server responded with a status code
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
            console.error('Data:', error.response.data);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received. Request config:', {
                url: error.config?.url,
                method: error.config?.method,
                headers: error.config?.headers,
                data: error.config?.data
            });
        } else {
            // Something happened in setting up the request
            console.error('Error:', error.message);
        }
        throw error;
    }
}

// Test fare rules
async function testFareRules(resultIndex, traceId) {
  try {
    console.log('\nTesting fare rules...');
    const fareRules = await getFareRules(resultIndex, traceId, mockRequest);
    console.log('✅ Fare rules retrieved successfully!');
    console.log('Fare Rules:', JSON.stringify(fareRules, null, 2));
    return fareRules;
  } catch (error) {
    console.error('❌ Failed to get fare rules:', error.message);
    throw error;
  }
}

// Run the test
async function runTests() {
    try {
        const searchResults = await testSearchFlights();

        // If search is successful, test fare rules with the first result
        if (searchResults && searchResults.data && searchResults.data.Results && searchResults.data.Results.length > 0) {
            const firstResult = searchResults.data.Results[0];
            await testFareRules(firstResult.ResultIndex, searchResults.data.TraceId);
        }
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

runTests();