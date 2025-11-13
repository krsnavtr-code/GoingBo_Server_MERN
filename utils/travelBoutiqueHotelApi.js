import axios from "axios";
import fs from "fs";
import path from "path";

// =============================
// CONFIGURATION
// =============================
const CONFIG = {
    username: "DELG738",
    password: "Htl@DEL#38/G",
    clientId: "tboprod",
    endUserIp: "82.112.236.83",
    baseSharedUrl: "https://api.travelboutiqueonline.com/SharedAPI/SharedData.svc/rest/",
    baseHotelUrl: "https://api.tektravels.com/HotelAPI_V7/",
    logDir: path.join(process.cwd(), "logs/TBO/hotels"),
    tokenFile: path.join(process.cwd(), "logs/TBO/hotels/token.json"),
    timeout: 20000
};

// =============================
// UTILITIES
// =============================
if (!fs.existsSync(CONFIG.logDir)) fs.mkdirSync(CONFIG.logDir, { recursive: true });

function log(message, data = null) {
    const file = path.join(CONFIG.logDir, `hotel_${new Date().toISOString().split("T")[0]}.log`);
    const entry = `[${new Date().toISOString()}] ${message} ${data ? JSON.stringify(data, null, 2) : ""}\n`;
    fs.appendFileSync(file, entry);
    console.log(message, data || "");
}

// =============================
// TOKEN HANDLING
// =============================
function loadToken() {
    if (fs.existsSync(CONFIG.tokenFile)) {
        const token = JSON.parse(fs.readFileSync(CONFIG.tokenFile, "utf8"));
        const today = new Date().toDateString();
        const tokenDate = new Date(token.date).toDateString();
        if (tokenDate === today) {
            log("✅ Using cached TBO token");
            return token;
        }
    }
    return null;
}

function saveToken(token) {
    fs.writeFileSync(CONFIG.tokenFile, JSON.stringify({ ...token, date: new Date() }, null, 2));
}

// =============================
// AUTHENTICATION
// =============================
export async function getAuthToken() {
    const cached = loadToken();
    if (cached) return cached;

    const body = {
        ClientId: CONFIG.clientId,
        UserName: CONFIG.username,
        Password: CONFIG.password,
        EndUserIp: CONFIG.endUserIp
    };

    try {
        log("🔐 Authenticating...");
        const res = await axios.post(`${CONFIG.baseSharedUrl}Authenticate`, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });

        if (res.data?.TokenId) {
            saveToken(res.data);
            log("✅ Token fetched successfully");
            return res.data;
        }

        throw new Error(res.data?.Error?.ErrorMessage || "Authentication failed");
    } catch (err) {
        log("❌ Auth Error", err.message);
        throw err;
    }
}

// =============================
// CITIES
// =============================
export async function getCitiesByCountry(countryCode = "IN") {
    const token = await getAuthToken();
    const body = { CountryCode: countryCode, EndUserIp: CONFIG.endUserIp, TokenId: token.TokenId };

    try {
        const res = await axios.post(`${CONFIG.baseHotelUrl}CityList`, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });
        if (res.data?.ResponseStatus?.Status === "Success") return res.data.CityList;
        log("⚠️ CityList failed", res.data);
        return [];
    } catch (err) {
        log("❌ CityList error", err.message);
        return [];
    }
}

// =============================
// HOTEL SEARCH
// =============================
export async function searchHotels(searchParams) {
    const token = await getAuthToken();
    const body = { ...searchParams, EndUserIp: CONFIG.endUserIp, TokenId: token.TokenId };

    try {
        const res = await axios.post(`${CONFIG.baseHotelUrl}Search`, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });
        return res.data;
    } catch (err) {
        log("❌ Search error", err.message);
        throw err;
    }
}

// =============================
// HOTEL DETAILS
// =============================
export async function getHotelDetails(params) {
    const token = await getAuthToken();
    const body = { ...params, EndUserIp: CONFIG.endUserIp, TokenId: token.TokenId };

    try {
        const res = await axios.post(`${CONFIG.baseHotelUrl}HotelDetails`, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });
        return res.data;
    } catch (err) {
        log("❌ Hotel details error", err.message);
        throw err;
    }
}

// =============================
// PRE-BOOK
// =============================
export async function preBookHotel(params) {
    const token = await getAuthToken();
    const body = { ...params, EndUserIp: CONFIG.endUserIp, TokenId: token.TokenId };

    try {
        const res = await axios.post(`${CONFIG.baseHotelUrl}PreBook`, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });
        return res.data;
    } catch (err) {
        log("❌ PreBook error", err.message);
        throw err;
    }
}

// =============================
// BOOK
// =============================
export async function bookHotel(params) {
    const token = await getAuthToken();
    const body = { ...params, EndUserIp: CONFIG.endUserIp, TokenId: token.TokenId };

    try {
        const res = await axios.post(`${CONFIG.baseHotelUrl}Book`, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });
        return res.data;
    } catch (err) {
        log("❌ Booking error", err.message);
        throw err;
    }
}

// =============================
// BOOKING DETAILS
// =============================
export async function getBookingDetails(bookingId) {
    const token = await getAuthToken();
    const body = { BookingId: bookingId, EndUserIp: CONFIG.endUserIp, TokenId: token.TokenId };

    try {
        const res = await axios.post(`${CONFIG.baseHotelUrl}GetBookingDetail`, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });
        return res.data;
    } catch (err) {
        log("❌ Booking details error", err.message);
        throw err;
    }
}

// =============================
// HOTEL CODE LIST
// =============================
export async function getTBOHotelCodeList({ countryCode = "IN" }) {
    const token = await getAuthToken();
    const body = { CountryCode: countryCode, EndUserIp: CONFIG.endUserIp, TokenId: token.TokenId };

    try {
        const res = await axios.post(`${CONFIG.baseHotelUrl}HotelCodeList`, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });
        return res.data?.Hotels || [];
    } catch (err) {
        log("❌ HotelCodeList error", err.message);
        throw err;
    }
}
