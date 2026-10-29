import mongoose from "mongoose";
import dotenv from "dotenv";
import crypto from "crypto";
import { hashPassword } from "./password.js";

dotenv.config();

const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true, required: true },
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    role: { type: String, enum: ["admin", "vendor", "customer"], default: "vendor" }
}, {
    timestamps: true,
    toJSON: {
        transform: (doc, ret) => {
            delete ret.password;
            return ret;
        }
    }
});

const vendorSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    email: { type: String, sparse: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    storeName: String,
    slug: { type: String, unique: true },
    kycDocs: [String],
    status: { type: String, default: "pending" },
    commissionPct: { type: Number, default: 0 },
    payoutAccountId: String,
    uuid: { type: String, unique: true, default: () => crypto.randomUUID(), sparse: true },
}, {
    timestamps: true,
    toJSON: {
        transform: (doc, ret) => {
            delete ret.password;
            return ret;
        }
    }
});

const productSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    stockQuantity: { type: Number, required: true, min: 0, validate: Number.isInteger },
    images: { type: [String], default: [] },
    vendorId: { type: Number, required: true, index: true }
}, {
    timestamps: true
});

const customerSchema = new mongoose.Schema({
    userId: { type: Number, unique: true, required: true, index: true },
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    displayName: { type: String, trim: true, maxlength: 120 }
}, {
    timestamps: true
});

const savedAddressSchema = new mongoose.Schema({
    addressId: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    userId: { type: Number, required: true, index: true },
    recipientName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    addressLine1: { type: String, required: true, trim: true, maxlength: 200 },
    addressLine2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    postalCode: { type: String, required: true, trim: true, maxlength: 20 },
    country: { type: String, required: true, trim: true, maxlength: 100 },
    label: { type: String, trim: true, maxlength: 40 },
    isDefault: { type: Boolean, default: false, required: true }
}, {
    timestamps: true,
    _id: false
});
savedAddressSchema.index(
    { userId: 1, isDefault: 1 },
    { unique: true, partialFilterExpression: { isDefault: true } }
);

const cartItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger }
}, { _id: false });

const cartSchema = new mongoose.Schema({
    userId: { type: Number, unique: true, required: true, index: true },
    items: { type: [cartItemSchema], default: [] }
}, {
    timestamps: true
});

const orderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    vendorId: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    storeName: { type: String, required: true, trim: true },
    unitPriceMinor: { type: Number, required: true, min: 0, validate: Number.isInteger },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    lineTotalMinor: { type: Number, required: true, min: 0, validate: Number.isInteger }
}, { _id: false });

const orderVendorGroupSchema = new mongoose.Schema({
    vendorId: { type: Number, required: true },
    storeName: { type: String, required: true, trim: true },
    itemProductIds: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
        required: true
    },
    subtotalMinor: { type: Number, required: true, min: 0, validate: Number.isInteger }
}, { _id: false });

const deliveryAddressSchema = new mongoose.Schema({
    recipientName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    addressLine1: { type: String, required: true, trim: true, maxlength: 200 },
    addressLine2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    postalCode: { type: String, required: true, trim: true, maxlength: 20 },
    country: { type: String, required: true, trim: true, maxlength: 100 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    orderId: { type: String, unique: true, required: true, index: true },
    customerUserId: { type: Number, required: true, index: true },
    items: { type: [orderItemSchema], required: true, minlength: 1 },
    vendorGroups: { type: [orderVendorGroupSchema], required: true, minlength: 1 },
    subtotalMinor: { type: Number, required: true, min: 0, validate: Number.isInteger },
    totalMinor: { type: Number, required: true, min: 0, validate: Number.isInteger },
    currency: { type: String, required: true, enum: ["USD"], default: "USD" },
    status: {
        type: String,
        enum: ["pending", "processing", "completed", "cancelled"],
        default: "pending",
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded"],
        default: "pending",
        required: true
    },
    inventoryRestored: { type: Boolean, default: false, required: true },
    deliveryAddress: { type: deliveryAddressSchema, required: true }
}, {
    timestamps: true
});

// Auto-hash password on save if modified and not already hashed
userSchema.pre("save", async function () {
    if (this.isModified("password") && this.password) {
        if (!this.password.startsWith("$2a$") && !this.password.startsWith("$2b$")) {
            this.password = await hashPassword(this.password);
        }
    }
});

vendorSchema.pre("save", async function () {
    if (this.isModified("password") && this.password) {
        if (!this.password.startsWith("$2a$") && !this.password.startsWith("$2b$")) {
            this.password = await hashPassword(this.password);
        }
    }
});

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/vendor-service")
    .then(() => console.log("database connection successful for vendor services"))
    .catch((err) => console.error("Database connection error:", err));

const User = mongoose.model("User", userSchema);
const Vendor = mongoose.model("Vendor", vendorSchema);
const Product = mongoose.model("Product", productSchema);
const Customer = mongoose.model("Customer", customerSchema);
const SavedAddress = mongoose.model("SavedAddress", savedAddressSchema);
const Cart = mongoose.model("Cart", cartSchema);
const Order = mongoose.model("Order", orderSchema);

export { User, Vendor, Product, Customer, SavedAddress, Cart, Order };
export default Vendor;