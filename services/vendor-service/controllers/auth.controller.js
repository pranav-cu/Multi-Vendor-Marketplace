import {
    requestOtp,
    resendOtp,
    verifyOtpAndLogin,
    verifyCustomerOtp,
    loginWithPassword,
    setPassword
} from "../services/auth.service.js";
import { Vendor } from "../utils/db.js";
import { serializeVendorSelf } from "../utils/vendor.serialization.js";

export const requestOtpController = async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const result = await requestOtp(email);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error in requestOtpController:", error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Failed to request OTP"
        });
    }
};

export const resendOtpController = async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const result = await resendOtp(email);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error in resendOtpController:", error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Failed to resend OTP"
        });
    }
};

export const verifyOtpController = async (req, res) => {
    try {
        const { email, otp } = req.body || {};
        if (!email || !otp) {
            return res.status(400).json({ message: "Both email and otp are required" });
        }

        const result = await verifyOtpAndLogin(email, otp);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error in verifyOtpController:", error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Failed to verify OTP"
        });
    }
};

export const requestCustomerOtpController = requestOtpController;

export const verifyCustomerOtpController = async (req, res) => {
    try {
        const { email, otp, displayName } = req.body || {};
        if (!email || !otp) {
            return res.status(400).json({ message: "Both email and otp are required" });
        }
        if (displayName !== undefined && (typeof displayName !== "string" || displayName.trim().length > 120)) {
            return res.status(400).json({ message: "displayName must be a string with at most 120 characters" });
        }

        const result = await verifyCustomerOtp(email, otp, displayName);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error in verifyCustomerOtpController:", error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Failed to verify customer OTP"
        });
    }
};

export const loginWithPasswordController = async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ message: "Both email and password are required" });
        }

        const result = await loginWithPassword(email, password);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error in loginWithPasswordController:", error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Failed to log in"
        });
    }
};

export const setPasswordController = async (req, res) => {
    try {
        const { password } = req.body || {};
        const userId = req.user?.userId;

        if (!password) {
            return res.status(400).json({ message: "Password is required" });
        }

        const result = await setPassword(userId, password);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error in setPasswordController:", error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Failed to set password"
        });
    }
};

export const getMeController = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ userId: req.user.userId });
        return res.status(200).json({
            message: "User profile fetched successfully",
            user: req.user,
            vendor: serializeVendorSelf(vendor)
        });
    } catch (error) {
        console.error("Error in getMeController:", error);
        return res.status(500).json({
            message: "Internal server error fetching profile"
        });
    }
};

export default {
    requestOtpController,
    resendOtpController,
    verifyOtpController,
    requestCustomerOtpController,
    verifyCustomerOtpController,
    loginWithPasswordController,
    setPasswordController,
    getMeController
};
