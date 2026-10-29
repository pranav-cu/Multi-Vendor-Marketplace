import { Product, Vendor } from "../utils/db.js";
import mongoose from "mongoose";

const createProduct = async (userId, productData) => {
    const vendor = await Vendor.findOne({ userId: Number(userId) });

    if (!vendor) {
        const error = new Error("Vendor profile not found");
        error.statusCode = 404;
        throw error;
    }

    if (vendor.status !== "approved") {
        const error = new Error("Only approved vendors can create products");
        error.statusCode = 403;
        throw error;
    }

    const product = await Product.create({
        title: productData.title,
        description: productData.description,
        price: productData.price,
        stockQuantity: productData.stockQuantity,
        images: productData.images || [],
        vendorId: vendor.userId
    });

    return product;
};

const requireApprovedVendor = async (userId) => {
    const vendor = await Vendor.findOne({ userId: Number(userId) }).select("status");
    if (!vendor) {
        const error = new Error("Vendor profile not found");
        error.statusCode = 404;
        throw error;
    }
    if (vendor.status !== "approved") {
        const error = new Error("Only approved vendors can manage products");
        error.statusCode = 403;
        throw error;
    }
};

const getMyProducts = async (userId) => {
    const vendor = await Vendor.findOne({ userId: Number(userId) })
        .select("userId email storeName")
        .lean();

    if (!vendor) {
        const error = new Error("Vendor profile not found");
        error.statusCode = 404;
        throw error;
    }

    const products = await Product.find({ vendorId: vendor.userId })
        .sort({ createdAt: -1, _id: -1 })
        .lean();

    return products.map((product) => ({
        productId: product._id,
        title: product.title,
        description: product.description,
        price: product.price,
        stockQuantity: product.stockQuantity,
        images: product.images || [],
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        vendorId: product.vendorId,
        vendorEmail: vendor.email,
        storeName: vendor.storeName
    }));
};

const updateProduct = async (productId, userId, productData) => {
    if (!mongoose.isValidObjectId(productId)) {
        const error = new Error("Invalid product ID");
        error.statusCode = 400;
        throw error;
    }
    await requireApprovedVendor(userId);

    const product = await Product.findOneAndUpdate(
        {
            _id: productId,
            vendorId: Number(userId)
        },
        { $set: productData },
        {
            new: true,
            runValidators: true
        }
    );

    if (!product) {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
    }

    return product;
};

const deleteProduct = async (productId, userId) => {
    if (!mongoose.isValidObjectId(productId)) {
        const error = new Error("Invalid product ID");
        error.statusCode = 400;
        throw error;
    }
    await requireApprovedVendor(userId);

    const product = await Product.findOneAndDelete({
        _id: productId,
        vendorId: Number(userId)
    });

    if (!product) {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
    }

    return product;
};

export { createProduct, getMyProducts, updateProduct, deleteProduct };
export default { createProduct, getMyProducts, updateProduct, deleteProduct };
