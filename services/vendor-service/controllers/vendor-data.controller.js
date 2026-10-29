import { getVendor, updateVendorProfile } from "../services/vendor-data.service.js";
import { serializeVendorPublic, serializeVendorSelf } from "../utils/vendor.serialization.js";

const vendorDataController = async (req, res) => {
    try {
        const userId = req.params?.userId || req.query?.userId || req.user?.userId;
        const uuid = req.query?.uuid;

        if (!userId && !uuid) {
            return res.status(400).json({
                message: "userId parameter is required to fetch vendor data"
            });
        }

        const vendorData = await getVendor(uuid, userId);

        if (!vendorData) {
            return res.status(404).json({
                message: "Vendor not found"
            });
        }

        // Non-admin vendors are only permitted to access their own vendor record
        if (req.user && req.user.role !== "admin" && Number(vendorData.userId) !== Number(req.user.userId)) {
            return res.status(403).json({
                message: "Forbidden: You are only allowed to access your own vendor data"
            });
        }

        const isOwnerOrAdmin = req.user && (req.user.role === "admin" || Number(vendorData.userId) === Number(req.user.userId));
        const payload = isOwnerOrAdmin ? serializeVendorSelf(vendorData) : serializeVendorPublic(vendorData);

        return res.status(200).json({
            message: "Vendor data fetched successfully",
            data: payload
        });
    } catch (error) {
        console.error("Error in vendorDataController:", error);
        return res.status(500).json({
            message: "Internal server error while fetching vendor data"
        });
    }
};

const updateVendorController = async (req, res) => {
    try {
        const targetUserId = req.params?.userId || req.user?.userId;

        if (!targetUserId) {
            return res.status(400).json({ message: "userId is required" });
        }

        // Non-admin vendors can only update their own profile
        if (req.user && req.user.role !== "admin" && Number(targetUserId) !== Number(req.user.userId)) {
            return res.status(403).json({
                message: "Forbidden: You can only update your own vendor profile"
            });
        }

        const { storeName, slug, payoutAccountId, kycDocs } = req.body || {};

        const result = await updateVendorProfile(targetUserId, {
            storeName,
            slug,
            payoutAccountId,
            kycDocs
        });

        return res.status(result.statusCode || 200).json(result);
    } catch (error) {
        console.error("Error in updateVendorController:", error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Internal server error updating vendor profile"
        });
    }
};

const uploadKycController = async (req, res) => {
    try {
        if (!req.file && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ message: "No document file was uploaded" });
        }

        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required to upload KYC documents" });
        }

        const uploadedFiles = req.files
            ? req.files.map((f) => `/uploads/kyc/${f.filename}`)
            : [`/uploads/kyc/${req.file.filename}`];

        // Fetch current vendor and append the new KYC document(s)
        const vendor = await getVendor(null, userId);
        if (!vendor) {
            return res.status(404).json({ message: "Vendor profile not found" });
        }

        const updatedKycDocs = Array.from(new Set([...(vendor.kycDocs || []), ...uploadedFiles]));
        const result = await updateVendorProfile(userId, { kycDocs: updatedKycDocs });

        return res.status(200).json({
            message: "KYC document uploaded successfully",
            files: uploadedFiles,
            data: result.data
        });
    } catch (error) {
        console.error("Error in uploadKycController:", error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Failed to upload KYC document"
        });
    }
};

export { vendorDataController, updateVendorController, uploadKycController };
export default { vendorDataController, updateVendorController, uploadKycController };
