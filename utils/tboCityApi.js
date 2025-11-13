import axios from "axios";
import fs from "fs";
import path from "path";

// =============================
// CONFIGURATION - City API specific
// =============================
const CITY_CONFIG = {
    baseUrl: "http://api.tbotechnology.in/TBOHolidays_HotelAPI",
    username: "DELG738", // Use appropriate credentials for city API
    password: "Htl@DEL#38/G",
    clientId: "tboprod",
    endUserIp: "82.112.236.83",
    logDir: path.join(process.cwd(), "logs/TBO/cities"),
    tokenFile: path.join(process.cwd(), "logs/TBO/cities/token.json"),
    timeout: 20000
};

// =============================
// UTILITIES
// =============================
if (!fs.existsSync(CITY_CONFIG.logDir)) {
    fs.mkdirSync(CITY_CONFIG.logDir, { recursive: true });
}

function log(message, data = null) {
    const file = path.join(CITY_CONFIG.logDir, `cities_${new Date().toISOString().split("T")[0]}.log`);
    const entry = `[${new Date().toISOString()}] ${message} ${data ? JSON.stringify(data, null, 2) : ""}\n`;
    fs.appendFileSync(file, entry);
    console.log(message, data || "");
}

// =============================
// TOKEN HANDLING - Specific to City API
// =============================
function loadCityToken() {
    if (fs.existsSync(CITY_CONFIG.tokenFile)) {
        try {
            const token = JSON.parse(fs.readFileSync(CITY_CONFIG.tokenFile, "utf8"));
            // Check if token is still valid (e.g., not expired)
            const tokenAge = Date.now() - new Date(token.timestamp).getTime();
            const maxTokenAge = 23 * 60 * 60 * 1000; // 23 hours in milliseconds
            
            if (tokenAge < maxTokenAge) {
                log("✅ Using cached city API token");
                return token.TokenId;
            }
        } catch (error) {
            log("❌ Error loading city token:", error.message);
        }
    }
    return null;
}

async function getCityApiToken() {
    const cachedToken = loadCityToken();
    if (cachedToken) return cachedToken;

    try {
        log("🔑 Requesting new city API token...");
        
        const authUrl = `http://api.tbotechnology.in/TBOHolidays_Authentication/Authenticate`;
        const authBody = {
            ClientId: CITY_CONFIG.clientId,
            UserName: CITY_CONFIG.username,
            Password: CITY_CONFIG.password,
            EndUserIp: CITY_CONFIG.endUserIp
        };

        const response = await axios.post(authUrl, authBody, {
            headers: { "Content-Type": "application/json" },
            timeout: CITY_CONFIG.timeout
        });

        if (response.data?.TokenId) {
            const tokenData = {
                TokenId: response.data.TokenId,
                timestamp: new Date().toISOString()
            };
            
            // Save the token for future use
            fs.writeFileSync(CITY_CONFIG.tokenFile, JSON.stringify(tokenData, null, 2));
            log("✅ Successfully obtained new city API token");
            return response.data.TokenId;
        }

        throw new Error("Failed to obtain city API token");
    } catch (error) {
        log("❌ City API authentication failed:", error.message);
        throw error;
    }
}

// ===========================================================
// CITY API FUNCTIONS
// ===========================================================

/**
 * Get cities by country code
 * @param {string} countryCode - ISO country code (e.g., 'IN')
 * @returns {Promise<Object>} - Object containing city list and status
 */
export async function getCitiesByCountry(countryCode = "IN") {
    try {
        const token = await getCityApiToken();
        const url = `${CITY_CONFIG.baseUrl}/CityList`;
        
        const requestBody = {
            CountryCode: countryCode,
            EndUserIp: CITY_CONFIG.endUserIp,
            TokenId: token
        };

        log(`🌍 Fetching cities for country ${countryCode}`, { url });
        
        const response = await axios.post(url, requestBody, {
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: CITY_CONFIG.timeout
        });

        log(`🌆 Cities API Response Status: ${response.status}`);

        // Check if the response indicates success
        if (response.data?.Status?.Code === 200) {
            const cityList = response.data.CityList || [];
            log(`✅ Found ${cityList.length} cities for ${countryCode}`);
            
            return {
                ResponseStatus: { 
                    Status: 'Success',
                    Code: response.data.Status.Code,
                    Description: response.data.Status.Description
                },
                CityList: cityList
            };
        }

        // Handle error response
        const errorMsg = response.data?.Status?.Description || 'Unknown error';
        log(`❌ City API Error: ${errorMsg}`);
        
        // If token is invalid, clear it and retry once
        if (response.data?.Status?.Code === 401) {
            log("🔄 Invalid token, clearing cache and retrying...");
            if (fs.existsSync(CITY_CONFIG.tokenFile)) {
                fs.unlinkSync(CITY_CONFIG.tokenFile);
            }
            return getCitiesByCountry(countryCode);
        }
        
        return {
            ResponseStatus: { 
                Status: 'Error',
                Error: { 
                    ErrorMessage: errorMsg,
                    Code: response.data?.Status?.Code
                }
            },
            CityList: []
        };
        
    } catch (error) {
        log('❌ Error in getCitiesByCountry:', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            stack: error.stack
        });
        
        return {
            ResponseStatus: { 
                Status: 'Error',
                Error: { 
                    ErrorMessage: error.response?.data?.message || 
                                error.message || 
                                'Failed to fetch cities from TBO API' 
                }
            },
            CityList: []
        };
    }
}

export default {
    getCitiesByCountry
};
