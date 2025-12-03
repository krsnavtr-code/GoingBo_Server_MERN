import axios from "axios";
import fs from "fs";
import path from "path";

// =============================
// CONFIGURATION
// =============================
const AUTH_CONFIG = {
    username: "DELG738",
    password: "Htl@DEL#38/G",
    clientId: "tboprod",
    endUserIp: "82.112.236.83",
    // baseSharedUrl: "https://api.travelboutiqueonline.com/SharedAPI/SharedData.svc/rest/",
    baseSharedUrl: "http://Sharedapi.tektravels.com/SharedData.svc/rest/",
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
            const tokenTime = new Date(token.timestamp).getTime();
            const currentTime = Date.now();
            const tokenAgeInMinutes = (currentTime - tokenTime) / (1000 * 60);

            // Token is valid for 14 minutes
            if (tokenAgeInMinutes < 14) {
                log("✅ Using cached TBO token");
                return token;
            } else {
                log("ℹ️ Token expired, will generate new one");
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

        const response = await axios.post(
            `${AUTH_CONFIG.baseSharedUrl}Authenticate`,
            {
                ClientId: AUTH_CONFIG.clientId,
                UserName: AUTH_CONFIG.username,
                Password: AUTH_CONFIG.password,
                EndUserIp: AUTH_CONFIG.endUserIp
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: AUTH_CONFIG.timeout
            }
        );

        console.log('Auth response:', JSON.stringify(response.data, null, 2));

        if (response.data && response.data.TokenId) {
            const tokenData = {
                ...response.data,
                timestamp: new Date().toISOString()
            };
            saveToken(tokenData);
            console.log('✅ Authentication successful');
            return tokenData;
        }

        throw new Error('Invalid response from TBO API: ' + JSON.stringify(response.data));

    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        throw new Error(`TBO Authentication failed: ${error.message}`);
    }
}

export default {
    getAuthToken
};
