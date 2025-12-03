// vps-proxy.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load .env
dotenv.config();

const app = express();
const PORT = process.env.PROXY_PORT || 3000;

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(cors());
app.use(morgan('dev'));

// ------------------------------
// TBO BASE URL
// ------------------------------
const TBO_BASE_URL = "https://tboapi.travelboutiqueonline.com/AirAPI_V10/AirService.svc/rest";

// ------------------------------
// Simple Token Authentication
// ------------------------------
const authenticate = (req, res, next) => {
    if (!process.env.PROXY_AUTH_TOKEN) {
        return next(); // token protection disabled
    }

    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ error: "Unauthorized: Token required" });
    }

    const givenToken = token.replace("Bearer ", "").trim();
    if (givenToken !== process.env.PROXY_AUTH_TOKEN) {
        return res.status(403).json({ error: "Forbidden: Invalid token" });
    }

    next();
};

// ------------------------------
// TBO Proxy Route
// ------------------------------
app.all("/api/*", authenticate, async (req, res) => {
    try {
        // Target URL ka accurate transformation
        const tboEndpoint = req.path.replace("/api", "");
        const url = `${TBO_BASE_URL}${tboEndpoint}`;

        console.log("➡ Forwarding to TBO:", url);

        const response = await axios({
            method: req.method,
            url,
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            data: req.body,
            params: req.query,
            timeout: 30000
        });

        return res.status(200).json(response.data);

    } catch (error) {
        console.error("❌ Proxy Error:", error.message);

        return res.status(error.response?.status || 500).json({
            message: "Proxy error",
            error: error.response?.data || error.message,
        });
    }
});

// ------------------------------
// Health Check
// ------------------------------
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// ------------------------------
// Start Server
// ------------------------------
app.listen(PORT, () => {
    console.log(`🚀 TBO Proxy Server running on port ${PORT}`);
});
