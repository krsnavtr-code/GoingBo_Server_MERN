import axios from "axios";
import fs from "fs";
import path from "path";

const CITY_CONFIG = {
    baseUrl: "http://api.tbotechnology.in/TBOHolidays_HotelAPI/",
    logDir: path.join(process.cwd(), "logs/TBO/cities"),
    timeout: 20000,
    username: "DELG738",
    password: "Htl@DEL#38/G"
};

if (!fs.existsSync(CITY_CONFIG.logDir)) {
    fs.mkdirSync(CITY_CONFIG.logDir, { recursive: true });
}

function log(message, data = null) {
    const file = path.join(
        CITY_CONFIG.logDir,
        `cities_${new Date().toISOString().split("T")[0]}.log`
    );
    const entry = `[${new Date().toISOString()}] ${message} ${data ? JSON.stringify(data, null, 2) : ""
        }\n`;

    fs.appendFileSync(file, entry);
    console.log(message, data || "");
}

export async function searchHotelsByCity(cityName, params = {}) {
    try {
        const url = "https://api.tBOHolidays.com/HotelAPI/TBOHotelCodeList";

        log(`🔍 Searching hotels in ${cityName}`, { url, params });

        const auth = Buffer.from('travelcategory:Tra@59334536').toString('base64');

        const response = await axios.post(url, {
            ...params,
            CityName: cityName
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            timeout: CITY_CONFIG.timeout
        });

        if (response.data?.Hotels?.length) {
            log(`✅ Found ${response.data.Hotels.length} hotels in ${cityName}`);
            return {
                success: true,
                hotels: response.data.Hotels
            };
        }

        log("⚠️ No hotels found", response.data);
        return {
            success: false,
            message: "No hotels found",
            hotels: []
        };

    } catch (err) {
        log("❌ Error in searchHotelsByCity", {
            message: err.message,
            response: err.response?.data
        });
        return {
            success: false,
            message: err.message,
            hotels: []
        };
    }
}

export async function getCitiesByCountry(countryCode = 'IN') {
    try {
        const url = `${CITY_CONFIG.baseUrl}CityList`;
        
        log(`🌍 Fetching city list for ${countryCode}`, { url });

        const response = await axios.post(
            url,
            { CountryCode: countryCode },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + Buffer.from('travelcategory:Tra@59334536').toString('base64')
                },
                timeout: CITY_CONFIG.timeout
            }
        );

        if (response.data?.CityList) {
            log(`✅ Found ${response.data.CityList.length} cities`);
            return response.data;
        }

        log("❌ Invalid city list response", response.data);
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

export default { getCitiesByCountry, searchHotelsByCity };
