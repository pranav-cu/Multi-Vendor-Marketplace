import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import createOTP from "../src/controller/createOtp.js";
import verifyOtp from "../src/controller/verifyOtp.js";
import checkResends from "../src/middlewares/checkResends.js";
import checkAttempts from "../src/middlewares/checkAttempts.js";
import listOtp from "../src/controller/listOtp.js";
import resendOtp from "../src/controller/resendOtp.js";

dotenv.config();
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

app.get("/", (req, res) => {
  res.send("Welcome to the OTP API!");
});

// Generate a new OTP
app.post("/otp/new", createOTP);

// Verify an existing OTP
app.post("/otp/verify", checkAttempts, verifyOtp);

// Resend an existing OTP
app.post("/otp/resend", checkResends, resendOtp);

// List all OTPs (for testing purposes)
if (process.env.ENVIRONMENT === "development") {
  app.get("/otp/list", listOtp);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
