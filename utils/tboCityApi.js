import axios from "axios";
import fs from "fs";
import path from "path";

const CITY_CONFIG = {
    baseUrl: "http://api.tbotechnology.in/TBOHolidays_HotelAPI/",
    logDir: path.join(process.cwd(), "logs/TBO/cities"),
    timeout: 20000
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

export async function getCitiesByCountry(countryCode = "IN") {
    const url = `http://api.tbotechnology.in/TBOHolidays_HotelAPI/CityList`;

    try {
        log(`🌍 Fetching city list for ${countryCode}`, { url });

        const res = await axios.post(
            url,
            { CountryCode: countryCode },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Basic " + Buffer.from("travelcategory:Tra@59334536").toString("base64")
                },
                timeout: CITY_CONFIG.timeout
            }
        );

        if (res.data?.CityList?.length) {
            log(`✅ Found ${res.data.CityList.length} cities`);
            return {
                ResponseStatus: { Status: "Success" },
                CityList: res.data.CityList
            };
        }

        log("⚠️ No city list returned", res.data);
        return {
            ResponseStatus: { Status: "Error", Error: { ErrorMessage: "Empty response" } },
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
