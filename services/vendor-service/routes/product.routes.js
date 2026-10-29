import { Router } from "express";
import {
    getMyProductsController,
    createProductController,
    updateProductController,
    deleteProductController,
    uploadProductImagesController
} from "../controllers/product.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";
import { uploadProductImages } from "../middlewares/upload.js";

const router = Router();

router.use(authenticate, authorizeRoles("vendor"));

router.get("/my", getMyProductsController);
router.post("/upload-images", uploadProductImages.array("images", 10), uploadProductImagesController);
router.patch("/:productId", updateProductController);
router.delete("/:productId", deleteProductController);
router.post("/", createProductController);

export { router as productRouter };
export default router;
