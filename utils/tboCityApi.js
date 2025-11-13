import axios from "axios";
import fs from "fs";
import path from "path";

// =============================
// CONFIGURATION
// =============================
const CITY_CONFIG = {
    username: "DELG738",
    password: "Htl@DEL#38/G",
    clientId: "ApiIntegrationNew",
    endUserIp: "82.112.236.83",
    logDir: path.join(process.cwd(), "logs/TBO/cities"),
    tokenFile: path.join(process.cwd(), "logs/TBO/cities/token.json"),
    timeout: 20000,
    baseUrl: "https://api.tektravels.com/SharedServices/SharedData.svc/rest/"
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
// TOKEN HANDLING
// =============================
function loadCityToken() {
    if (fs.existsSync(CITY_CONFIG.tokenFile)) {
        try {
            const token = JSON.parse(fs.readFileSync(CITY_CONFIG.tokenFile, "utf8"));
            const tokenAge = Date.now() - new Date(token.timestamp).getTime();
            const maxAge = 23 * 60 * 60 * 1000; // 23 hours
            if (tokenAge < maxAge) {
                log("✅ Using cached city token");
                return token.TokenId;
            }
        } catch (e) {
            log("❌ Error reading cached token:", e.message);
        }
    }
    return null;
}

async function getCityApiToken() {
    const cached = loadCityToken();
    if (cached) return cached;

    const authUrl = `${CITY_CONFIG.baseUrl}Authenticate`;
    const body = {
        ClientId: CITY_CONFIG.clientId,
        UserName: CITY_CONFIG.username,
        Password: CITY_CONFIG.password,
        EndUserIp: CITY_CONFIG.endUserIp
    };

    try {
        log("🔑 Authenticating for city API...");
        const res = await axios.post(authUrl, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CITY_CONFIG.timeout
        });

        if (res.data?.TokenId) {
            fs.writeFileSync(
                CITY_CONFIG.tokenFile,
                JSON.stringify({ TokenId: res.data.TokenId, timestamp: new Date().toISOString() }, null, 2)
            );
            log("✅ City API token obtained");
            return res.data.TokenId;
        }

        throw new Error("Invalid authentication response");
    } catch (err) {
        log("❌ Authentication failed:", err.message);
        throw err;
    }
}

// =============================
// GET CITIES
// =============================
export async function getCitiesByCountry(countryCode = "IN") {
    try {
        const token = await getCityApiToken();

        const url = `${CITY_CONFIG.baseUrl}GetDestinationCityList`;
        const body = {
            CountryCode: countryCode,
            EndUserIp: CITY_CONFIG.endUserIp,
            TokenId: token
        };

        log(`🌍 Fetching city list for ${countryCode}`, { url });

        const res = await axios.post(url, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CITY_CONFIG.timeout
        });

        if (res.data?.CityList) {
            log(`✅ Found ${res.data.CityList.length} cities`);
            return {
                ResponseStatus: { Status: "Success" },
                CityList: res.data.CityList
            };
        }

        log("❌ Invalid city list response", res.data);
        return {
            ResponseStatus: { Status: "Error", Error: { ErrorMessage: "Invalid response" } },
            CityList: []
        };
    } catch (err) {
        log("❌ Error in getCitiesByCountry", err.message);
        return {
            ResponseStatus: { Status: "Error", Error: { ErrorMessage: err.message } },
            CityList: []
        };
    }
}

export default { getCitiesByCountry };
