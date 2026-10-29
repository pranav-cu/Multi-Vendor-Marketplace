import { Router } from "express";
import {
    vendorDataController,
    updateVendorController,
    uploadKycController
} from "../controllers/vendor-data.controller.js";
import {
    getVendorOrdersController,
    updateVendorOrderStatusController
} from "../controllers/order.controller.js";
import { authenticate, authorizeRoles, authorizeVendorOwnerOrAdmin } from "../middlewares/auth.js";
import { uploadKyc } from "../middlewares/upload.js";

const router = Router();

// Only vendors or admins can access or mutate vendor store data
router.use(authenticate, authorizeRoles("vendor", "admin"));

// Current vendor profile shortcuts
router.get("/profile", vendorDataController);
router.put("/profile", updateVendorController);

// Vendor-specific distributed orders & fulfillment
router.get("/orders", getVendorOrdersController);
router.patch("/orders/:orderId/status", updateVendorOrderStatusController);

// Upload KYC document(s) for the authenticated vendor
router.post("/upload-kyc", uploadKyc.any(), uploadKycController);

// Target specific userId: admin can access all, vendors access their own
router.get("/:userId", authorizeVendorOwnerOrAdmin, vendorDataController);
router.put("/:userId", authorizeVendorOwnerOrAdmin, updateVendorController);

export { router as vendorDataRouter };
export default router;
