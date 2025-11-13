import axios from "axios";
import fs from "fs";
import path from "path";
import { getAuthToken } from "./tboAuth.js";

// =============================
// CONFIGURATION
// =============================
const CONFIG = {
    baseHotelUrl: "https://api.tektravels.com/HotelAPI_V7/",
    logDir: path.join(process.cwd(), "logs/TBO/hotels"),
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

// =============================
// CITIES
// =============================
export async function getCitiesByCountry(countryCode = "IN") {
    const token = await getAuthToken();
    const body = { CountryCode: countryCode, EndUserIp: CONFIG.endUserIp, TokenId: token.TokenId };

    try {
        const res = await axios.post(`${CONFIG.baseHotelUrl}GetDestinationCityList`, body, {
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
