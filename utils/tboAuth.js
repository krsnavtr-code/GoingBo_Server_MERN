import axios from "axios";
import fs from "fs";
import path from "path";

// =============================
// CONFIGURATION
// =============================
const AUTH_CONFIG = {
    username: process.env.TBO_USERNAME || "DELG738",
    password: process.env.TBO_PASSWORD || "Htl@DEL#38/G",
    clientId: "tboprod",
    endUserIp: process.env.TBO_END_USER_IP || "82.112.236.83",
    // baseSharedUrl: "http://Sharedapi.tektravels.com/SharedData.svc/rest/",  // new
    baseSharedUrl: "https://api.travelboutiqueonline.com/SharedAPI/SharedData.svc/rest/",   // old
    logDir: path.join(process.cwd(), "logs/TBO/auth"),
    tokenFile: path.join(process.cwd(), "logs/TBO/auth/token.json"),
    timeout: 20000
};

// =============================
// UTILITIES
// =============================
if (!fs.existsSync(AUTH_CONFIG.logDir)) {
    fs.mkdirSync(AUTH_CONFIG.logDir, { recursive: true });
}

function log(message, data = null) {
    const file = path.join(AUTH_CONFIG.logDir, `auth_${new Date().toISOString().split("T")[0]}.log`);
    const entry = `[${new Date().toISOString()}] ${message} ${data ? JSON.stringify(data, null, 2) : ""}\n`;
    fs.appendFileSync(file, entry);
    console.log(message, data || "");
}

// =============================
// TOKEN HANDLING
// =============================
function loadToken() {
    if (fs.existsSync(AUTH_CONFIG.tokenFile)) {
        try {
            const token = JSON.parse(fs.readFileSync(AUTH_CONFIG.tokenFile, "utf8"));
            const tokenDate = new Date(token.timestamp);
            const currentDate = new Date();

            // Check if token is from today (valid for 24 hours from 00:00 to 23:59)
            const isSameDay = tokenDate.getDate() === currentDate.getDate() &&
                tokenDate.getMonth() === currentDate.getMonth() &&
                tokenDate.getFullYear() === currentDate.getFullYear();

            if (isSameDay) {
                log("✅ Using cached TBO token");
                return token;
            } else {
                log("ℹ️ Token expired (new day), will generate new one");
            }
        } catch (error) {
            log("❌ Error loading token:", error.message);
        }
    }
    return null;
}

function saveToken(token) {
    try {
        const tokenData = {
            ...token,
            timestamp: new Date().toISOString()
        };
        // Ensure the directory exists
        if (!fs.existsSync(AUTH_CONFIG.logDir)) {
            fs.mkdirSync(AUTH_CONFIG.logDir, { recursive: true });
        }
        fs.writeFileSync(AUTH_CONFIG.tokenFile, JSON.stringify(tokenData, null, 2));
        console.log('🔑 Token saved successfully');
    } catch (error) {
        console.error('❌ Error saving token:', error.message);
        throw error;
    }
}

// =============================
// AUTHENTICATION
// =============================
export async function getAuthToken(forceRefresh = false) {
    try {
        // If not forcing refresh, try to load from cache first
        if (!forceRefresh) {
            const cached = loadToken();
            if (cached) return cached;
        }

        console.log('🔑 Getting new TBO authentication token...');

        const requestData = {
            ClientId: AUTH_CONFIG.clientId,
            UserName: AUTH_CONFIG.username,
            Password: AUTH_CONFIG.password,
            EndUserIp: AUTH_CONFIG.endUserIp
        };

        log("Sending auth request:", requestData);

        const response = await axios.post(
            `${AUTH_CONFIG.baseSharedUrl}Authenticate`,
            requestData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: AUTH_CONFIG.timeout
            }
        );

        log("Auth response received:", response.data);

        console.log('Auth response:', JSON.stringify(response.data, null, 2));

        if (response.data) {
            if (response.data.Status === 1 && response.data.TokenId) {
                const tokenData = {
                    ...response.data,
                    timestamp: new Date().toISOString()
                };
                saveToken(tokenData);
                console.log('✅ Authentication successful');
                return tokenData;
            } else if (response.data.Error) {
                const errorMsg = `TBO Authentication Error ${response.data.Error.ErrorCode}: ${response.data.Error.ErrorMessage}`;
                console.error('❌', errorMsg);
                throw new Error(errorMsg);
            }
        }

        throw new Error('Invalid response format from TBO API: ' + JSON.stringify(response.data));

    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        throw new Error(`TBO Authentication failed: ${error.message}`);
    }
}

// Export as default object
export default {
    getAuthToken,
    loadToken,
    saveToken
};
