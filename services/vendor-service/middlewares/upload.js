import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.resolve("uploads/kyc");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
        cb(null, `${base}-${uniqueSuffix}${ext}`);
    }
});

export const uploadKyc = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|jpg|jpeg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === "application/pdf";
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error("Only PDF, JPG, JPEG, PNG, and WebP files are allowed for KYC"));
    }
});

const productUploadDir = path.resolve("uploads/products");
if (!fs.existsSync(productUploadDir)) {
    fs.mkdirSync(productUploadDir, { recursive: true });
}

const productStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, productUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname).toLowerCase();
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
        cb(null, `prod-${base}-${uniqueSuffix}${ext}`);
    }
});

export const uploadProductImages = multer({
    storage: productStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpg|jpeg|png|webp|gif|avif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype) || (file.mimetype && file.mimetype.startsWith("image/"));
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error("Only image files (JPG, JPEG, PNG, WebP, GIF, AVIF) are allowed for products"));
    }
});

export default { uploadKyc, uploadProductImages };

