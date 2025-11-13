import axios from "axios";
import fs from "fs";
import path from "path";
import { getAuthToken } from "./tboAuth.js";

// =============================
// CONFIGURATION
// =============================
const CONFIG = {
    baseHotelUrl: "https://affiliate.travelboutiqueonline.com/HotelAPI/",
    baseBookingUrl: "https://hotelbooking.travelboutiqueonline.com/HotelAPI_V10/HotelService.svc/rest/",
    baseTboUrl: "https://apiwr.tboholidays.com/HotelAPI/",
    logDir: path.join(process.cwd(), "logs/TBO/hotels"),
    endUserIp: "82.112.236.83",
    timeout: 20000
};

// =============================
// UTILITIES
// =============================
if (!fs.existsSync(CONFIG.logDir)) {
    fs.mkdirSync(CONFIG.logDir, { recursive: true });
}

function log(message, data = null) {
    const file = path.join(CONFIG.logDir, `hotel_${new Date().toISOString().split("T")[0]}.log`);
    const entry = `[${new Date().toISOString()}] ${message} ${data ? JSON.stringify(data, null, 2) : ""}\n`;
    fs.appendFileSync(file, entry);
    console.log(message, data || "");
}

// ===========================================================
// 🌍 GET CITIES BY COUNTRY (Updated)
// ===========================================================
export async function getCitiesByCountry(countryCode = "IN") {
    try {
        const token = await getAuthToken();
        const body = {
            CountryCode: countryCode,
            EndUserIp: CONFIG.endUserIp,
            TokenId: token.TokenId
        };

        // ✅ Updated endpoint (old one was 404)
        const url = `${CONFIG.baseTboUrl}CityList`;
        log("🌍 Fetching cities for country:", { url, body });

        const res = await axios.post(url, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });

        log("🌆 Raw city API response:", res.data);

        if (res.data?.ResponseStatus?.Status === "Success" && res.data.CityList) {
            log(`✅ Found ${res.data.CityList.length} cities`);
            return res.data.CityList;
        }

        log("⚠️ City list request failed or empty");
        if (res.data?.ResponseStatus) {
            log("Error details:", res.data.ResponseStatus);
        }
        return [];
    } catch (err) {
        log("❌ CityList error:", {
            message: err.message,
            response: err.response?.data,
            stack: err.stack
        });
        return [];
    }
}



// ===========================================================
// 1️⃣ FETCH HOTELS LIST (TBOHotelCodeList)
// ===========================================================
export async function fetchHotels(params = {}) {
    try {
        const token = await getAuthToken();
        const body = {
            CityCode: params.CityCode,
            IsDetailedResponse: params.IsDetailedResponse || false,
            EndUserIp: CONFIG.endUserIp,
            TokenId: token.TokenId
        };

        const url = `${CONFIG.baseTboUrl}TBOHotelCodeList`;
        log("📘 Fetching hotels list", { url, body });

        const res = await axios.post(url, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });

        log("✅ Hotel list response", res.data);
        return res.data;
    } catch (err) {
        log("❌ Error fetching hotels", {
            message: err.message,
            response: err.response?.data
        });
        throw err;
    }
}

// ===========================================================
// 2️⃣ FETCH HOTEL DETAILS (Hoteldetails)
// ===========================================================
export async function fetchHotelDetails(params = {}) {
    try {
        const token = await getAuthToken();
        const body = {
            HotelCodes: params.HotelCodes, // comma-separated string
            EndUserIp: CONFIG.endUserIp,
            TokenId: token.TokenId
        };

        const url = `${CONFIG.baseTboUrl}Hoteldetails`;
        log("🏨 Fetching hotel details", { url, body });

        const res = await axios.post(url, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });

        log("✅ Hotel details response", res.data);
        return res.data;
    } catch (err) {
        log("❌ Error fetching hotel details", {
            message: err.message,
            response: err.response?.data
        });
        throw err;
    }
}

// ===========================================================
// 3️⃣ SEARCH HOTELS (Search)
// ===========================================================
export async function search_hotels(searchParams = {}) {
    try {
        const token = await getAuthToken();
        const body = {
            ...searchParams,
            ResponseTime: searchParams.ResponseTime || 23.0,
            IsDetailedResponse: searchParams.IsDetailedResponse || false,
            EndUserIp: CONFIG.endUserIp,
            TokenId: token.TokenId
        };

        const url = `${CONFIG.baseHotelUrl}Search`;
        log("🔍 Searching hotels", { url, body });

        const res = await axios.post(url, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });

        log("✅ Search response", res.data);
        return res.data;
    } catch (err) {
        log("❌ Hotel search error", {
            message: err.message,
            response: err.response?.data
        });
        throw err;
    }
}

// ===========================================================
// 4️⃣ PRE-BOOK HOTEL (PreBook)
// ===========================================================
export async function fetchPreBook(params = {}) {
    try {
        const token = await getAuthToken();
        const body = { ...params, EndUserIp: CONFIG.endUserIp, TokenId: token.TokenId };

        const url = `${CONFIG.baseHotelUrl}PreBook`;
        log("🧾 Pre-book request", { url, body });

        const res = await axios.post(url, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });

        log("✅ Pre-book response", res.data);
        return res.data;
    } catch (err) {
        log("❌ Pre-book error", {
            message: err.message,
            response: err.response?.data
        });
        throw err;
    }
}

// ===========================================================
// 5️⃣ CONFIRM BOOKING (Book)
// ===========================================================
export async function confirm_ticket(params = {}) {
    try {
        const token = await getAuthToken();
        const body = { ...params, EndUserIp: CONFIG.endUserIp, TokenId: token.TokenId };

        const url = `${CONFIG.baseBookingUrl}Book`;
        log("🧾 Confirming booking", { url, body });

        const res = await axios.post(url, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });

        log("✅ Booking confirmation response", res.data);
        return res.data;
    } catch (err) {
        log("❌ Booking confirmation error", {
            message: err.message,
            response: err.response?.data
        });
        throw err;
    }
}

// ===========================================================
// 6️⃣ GET BOOKING DETAILS (GetBookingDetail)
// ===========================================================
export async function web_book_booking(bookingId) {
    try {
        const token = await getAuthToken();
        const body = {
            BookingId: bookingId,
            EndUserIp: CONFIG.endUserIp,
            TokenId: token.TokenId
        };

        const url = `${CONFIG.baseBookingUrl}GetBookingDetail`;
        log("📜 Fetching booking details", { url, body });

        const res = await axios.post(url, body, {
            headers: { "Content-Type": "application/json" },
            timeout: CONFIG.timeout
        });

        log("✅ Booking details response", res.data);
        return res.data;
    } catch (err) {
        log("❌ Booking details error", {
            message: err.message,
            response: err.response?.data
        });
        throw err;
    }
}
