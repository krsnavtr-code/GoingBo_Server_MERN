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
    baseSharedUrl: "https://api.travelboutiqueonline.com/SharedAPI/SharedData.svc/rest/",
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
            const today = new Date().toDateString();
            const tokenDate = new Date(token.date).toDateString();
            if (tokenDate === today) {
                log("✅ Using cached TBO token");
                return token;
            }
        } catch (error) {
            log("❌ Error loading token:", error.message);
        }
    }
    return null;
}

function saveToken(token) {
    try {
        fs.writeFileSync(AUTH_CONFIG.tokenFile, JSON.stringify({ ...token, date: new Date() }, null, 2));
    } catch (error) {
        log("❌ Error saving token:", error.message);
    }
}

// =============================
// AUTHENTICATION
// =============================
export async function getAuthToken() {
    const cached = loadToken();
    if (cached) return cached;

    const body = {
        ClientId: AUTH_CONFIG.clientId,
        UserName: AUTH_CONFIG.username,
        Password: AUTH_CONFIG.password,
        EndUserIp: AUTH_CONFIG.endUserIp
    };

    try {
        log("🔐 Authenticating...");
        const res = await axios.post(`${AUTH_CONFIG.baseSharedUrl}Authenticate`, body, {
            headers: { "Content-Type": "application/json" },
            timeout: AUTH_CONFIG.timeout
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

export default {
    getAuthToken
};
