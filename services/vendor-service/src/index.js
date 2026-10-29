import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";

dotenv.config();

import routes from "../routes/index.js";

const app = express();

const configuredOrigin = process.env.CORS_ORIGIN;
const originSetting = !configuredOrigin || configuredOrigin === "*" || configuredOrigin === "true"
    ? true
    : (configuredOrigin.includes(",") ? configuredOrigin.split(",").map(o => o.trim()) : configuredOrigin);

const corsOptions = {
    origin: originSetting,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

app.use(express.json());

// Serve uploaded KYC documents and product images statically
app.use("/uploads", express.static(path.resolve("uploads")));

app.get("/health", (req, res) => {
    res.json({ message: "ok", service: "vendor-service" });
});

// Mount application routes
app.use(routes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Vendor service started on port ${PORT}`);
});
