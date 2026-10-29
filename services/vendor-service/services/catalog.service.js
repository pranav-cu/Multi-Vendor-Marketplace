import mongoose from "mongoose";
import { Product, Vendor } from "../utils/db.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../utils/catalog.validation.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toPublicProduct = (product, vendor) => ({
    productId: product._id.toString(),
    title: product.title,
    description: product.description,
    price: product.price,
    stockQuantity: product.stockQuantity,
    images: product.images || [],
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    vendorId: product.vendorId,
    storeName: vendor?.storeName || ""
});

const getCatalogProducts = async ({ page = 1, pageSize = DEFAULT_PAGE_SIZE, search = "" }) => {
    const approvedVendors = await Vendor.find({ status: "approved" })
        .select("userId storeName")
        .lean();
    const vendorIds = approvedVendors.map((vendor) => vendor.userId);

    if (vendorIds.length === 0) {
        return { items: [], page, pageSize, totalItems: 0, totalPages: 0 };
    }

    const filter = { vendorId: { $in: vendorIds } };
    if (search) {
        const searchPattern = new RegExp(escapeRegex(search), "i");
        filter.$or = [{ title: searchPattern }, { description: searchPattern }];
    }

    const [products, totalItems] = await Promise.all([
        Product.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .lean(),
        Product.countDocuments(filter)
    ]);

    const vendorsById = new Map(approvedVendors.map((vendor) => [vendor.userId, vendor]));

    return {
        items: products.map((product) => toPublicProduct(product, vendorsById.get(product.vendorId))),
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize)
    };
};

const getCatalogProduct = async (productId) => {
    if (!mongoose.isValidObjectId(productId)) {
        const error = new Error("Invalid product ID");
        error.statusCode = 400;
        throw error;
    }

    const product = await Product.findById(productId).lean();
    if (!product) {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
    }

    const vendor = await Vendor.findOne({
        userId: product.vendorId,
        status: "approved"
    }).select("userId storeName").lean();

    if (!vendor) {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
    }

    return toPublicProduct(product, vendor);
};

export {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    getCatalogProducts,
    getCatalogProduct
};
export default { getCatalogProducts, getCatalogProduct };
