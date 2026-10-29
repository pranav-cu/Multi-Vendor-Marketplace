import crypto from "crypto";
import mongoose from "mongoose";
import { Cart, Order, Product, Vendor } from "../utils/db.js";
import { fromMinorUnits, toMinorUnits, validateOrderId } from "../utils/order.validation.js";

const transactionUnavailableError = () => {
    const error = new Error("Checkout requires MongoDB transaction support; no order was created");
    error.statusCode = 503;
    return error;
};

const isTransactionUnavailable = (error) => (
    error?.code === 20 ||
    error?.code === 251 ||
    /transaction numbers are only allowed|replica set|transaction is not supported/i.test(error?.message || "")
);

const executeOrderCreation = async (customerUserId, deliveryAddress, session = null) => {
    const opts = session ? { session } : {};
    const cartQuery = Cart.findOne({ userId: Number(customerUserId) });
    if (session) cartQuery.session(session);
    const cart = await cartQuery;

    if (!cart || cart.items.length === 0) {
        const error = new Error("Cannot create an order from an empty cart");
        error.statusCode = 409;
        throw error;
    }

    const productIds = cart.items.map((item) => item.productId);
    const productsQuery = Product.find({ _id: { $in: productIds } });
    if (session) productsQuery.session(session);
    const products = await productsQuery.lean();

    const vendorsQuery = Vendor.find({
        userId: { $in: products.map((product) => product.vendorId) },
        status: "approved"
    }).select("userId storeName");
    if (session) vendorsQuery.session(session);
    const vendors = await vendorsQuery.lean();

    const productsById = new Map(products.map((product) => [product._id.toString(), product]));
    const vendorsById = new Map(vendors.map((vendor) => [vendor.userId, vendor]));
    const issues = [];
    const snapshots = [];

    for (const cartItem of cart.items) {
        const productId = cartItem.productId.toString();
        const product = productsById.get(productId);
        const vendor = product ? vendorsById.get(product.vendorId) : null;

        if (!product) {
            issues.push({ productId, reason: "Product is no longer available" });
            continue;
        }
        if (!vendor) {
            issues.push({ productId, reason: "Vendor is no longer approved" });
            continue;
        }
        if (typeof product.price !== "number" || !Number.isFinite(product.price) || product.price < 0) {
            issues.push({ productId, reason: "Product price is invalid" });
            continue;
        }
        if (product.stockQuantity < cartItem.quantity) {
            issues.push({
                productId,
                reason: "Insufficient stock",
                availableStock: product.stockQuantity,
                requestedQuantity: cartItem.quantity
            });
            continue;
        }

        const unitPriceMinor = toMinorUnits(product.price);
        snapshots.push({
            product,
            vendor,
            quantity: cartItem.quantity,
            unitPriceMinor,
            lineTotalMinor: unitPriceMinor * cartItem.quantity
        });
    }

    if (issues.length > 0) {
        const error = new Error("Cart cannot be checked out");
        error.statusCode = 409;
        error.details = issues;
        throw error;
    }

    const vendorGroupsById = new Map();
    for (const snapshot of snapshots) {
        const existing = vendorGroupsById.get(snapshot.vendor.userId) || {
            vendorId: snapshot.vendor.userId,
            storeName: snapshot.vendor.storeName,
            itemProductIds: [],
            subtotalMinor: 0
        };
        existing.itemProductIds.push(snapshot.product._id);
        existing.subtotalMinor += snapshot.lineTotalMinor;
        vendorGroupsById.set(snapshot.vendor.userId, existing);
    }

    const updatedSnapshots = [];
    try {
        for (const snapshot of snapshots) {
            const result = await Product.updateOne(
                {
                    _id: snapshot.product._id,
                    vendorId: snapshot.vendor.userId,
                    stockQuantity: { $gte: snapshot.quantity }
                },
                { $inc: { stockQuantity: -snapshot.quantity } },
                opts
            );
            if (result.modifiedCount !== 1) {
                const error = new Error("Stock changed during checkout; please refresh your cart");
                error.statusCode = 409;
                throw error;
            }
            updatedSnapshots.push(snapshot);
        }

        const subtotalMinor = snapshots.reduce((total, snapshot) => (
            total + snapshot.lineTotalMinor
        ), 0);

        const [createdOrder] = await Order.create([{
            orderId: `ORD-${crypto.randomUUID()}`,
            customerUserId: Number(customerUserId),
            items: snapshots.map((snapshot) => ({
                productId: snapshot.product._id,
                vendorId: snapshot.vendor.userId,
                title: snapshot.product.title,
                storeName: snapshot.vendor.storeName,
                unitPriceMinor: snapshot.unitPriceMinor,
                quantity: snapshot.quantity,
                lineTotalMinor: snapshot.lineTotalMinor
            })),
            vendorGroups: Array.from(vendorGroupsById.values()),
            subtotalMinor,
            totalMinor: subtotalMinor,
            currency: "USD",
            paymentStatus: "pending",
            deliveryAddress
        }], opts);

        const clearResult = await Cart.updateOne(
            { _id: cart._id, userId: Number(customerUserId), __v: cart.__v },
            { $set: { items: [] }, $inc: { __v: 1 } },
            opts
        );
        if (clearResult.modifiedCount !== 1) {
            const error = new Error("Cart changed during checkout; please retry");
            error.statusCode = 409;
            throw error;
        }

        return createdOrder;
    } catch (err) {
        if (!session && updatedSnapshots.length > 0) {
            for (const snap of updatedSnapshots) {
                await Product.updateOne(
                    { _id: snap.product._id, vendorId: snap.vendor.userId },
                    { $inc: { stockQuantity: snap.quantity } }
                ).catch(() => {});
            }
        }
        throw err;
    }
};

const createOrder = async (customerUserId, deliveryAddress) => {
    let session = null;
    try {
        session = await mongoose.startSession();
        let createdOrder;
        await session.withTransaction(async () => {
            createdOrder = await executeOrderCreation(customerUserId, deliveryAddress, session);
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });

        return serializeOrder(createdOrder);
    } catch (error) {
        if (isTransactionUnavailable(error)) {
            if (process.env.STRICT_TRANSACTIONS === "true") {
                throw transactionUnavailableError();
            }
            console.warn("[order.service] MongoDB replica set transactions unavailable; executing standalone atomic checkout fallback.");
            const createdOrder = await executeOrderCreation(customerUserId, deliveryAddress, null);
            return serializeOrder(createdOrder);
        }
        throw error;
    } finally {
        if (session) {
            await session.endSession().catch(() => {});
        }
    }
};

const serializeOrder = (order) => ({
    orderId: order.orderId,
    customerUserId: order.customerUserId,
    items: order.items.map((item) => ({
        productId: item.productId.toString(),
        vendorId: item.vendorId,
        title: item.title,
        storeName: item.storeName,
        unitPrice: fromMinorUnits(item.unitPriceMinor),
        quantity: item.quantity,
        lineTotal: fromMinorUnits(item.lineTotalMinor)
    })),
    vendorGroups: order.vendorGroups.map((group) => ({
        vendorId: group.vendorId,
        storeName: group.storeName,
        itemProductIds: group.itemProductIds.map((id) => id.toString()),
        subtotal: fromMinorUnits(group.subtotalMinor)
    })),
    subtotal: fromMinorUnits(order.subtotalMinor),
    total: fromMinorUnits(order.totalMinor),
    currency: order.currency,
    status: order.status,
    paymentStatus: order.paymentStatus,
    deliveryAddress: order.deliveryAddress,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
});

const listOrders = async (customerUserId, page, pageSize) => {
    const filter = { customerUserId: Number(customerUserId) };
    const [orders, totalItems] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * pageSize).limit(pageSize).lean(),
        Order.countDocuments(filter)
    ]);

    return {
        items: orders.map((order) => ({
            orderId: order.orderId,
            total: fromMinorUnits(order.totalMinor),
            currency: order.currency,
            status: order.status,
            paymentStatus: order.paymentStatus,
            itemCount: order.items.reduce((count, item) => count + item.quantity, 0),
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        })),
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize)
    };
};

const getOrder = async (customerUserId, orderId) => {
    validateOrderId(orderId);
    const order = await Order.findOne({
        orderId,
        customerUserId: Number(customerUserId)
    }).lean();
    if (!order) {
        const error = new Error("Order not found");
        error.statusCode = 404;
        throw error;
    }
    return serializeOrder(order);
};

const executeOrderCancellation = async (customerUserId, orderId, session = null) => {
    const opts = session ? { session, new: true } : { new: true };
    const queryOpts = session ? { session } : {};

    const order = await Order.findOneAndUpdate(
        {
            orderId,
            customerUserId: Number(customerUserId),
            status: "pending",
            paymentStatus: "pending",
            inventoryRestored: false
        },
        { $set: { status: "cancelled", inventoryRestored: true } },
        opts
    );

    if (!order) {
        const findQuery = Order.findOne({
            orderId,
            customerUserId: Number(customerUserId)
        });
        if (session) findQuery.session(session);
        const existing = await findQuery.lean();
        const error = new Error(existing ? "Order cannot be cancelled in its current state" : "Order not found");
        error.statusCode = existing ? 409 : 404;
        throw error;
    }

    for (const item of order.items) {
        const restoreResult = await Product.updateOne(
            { _id: item.productId, vendorId: item.vendorId },
            { $inc: { stockQuantity: item.quantity } },
            queryOpts
        );
        if (restoreResult.modifiedCount !== 1) {
            const error = new Error("Inventory could not be restored; order cancellation was not completed");
            error.statusCode = 409;
            throw error;
        }
    }

    return order;
};

const cancelOrder = async (customerUserId, orderId) => {
    validateOrderId(orderId);
    let session = null;
    try {
        session = await mongoose.startSession();
        let cancelledOrder;
        await session.withTransaction(async () => {
            cancelledOrder = await executeOrderCancellation(customerUserId, orderId, session);
        });

        return serializeOrder(cancelledOrder);
    } catch (error) {
        if (isTransactionUnavailable(error)) {
            if (process.env.STRICT_TRANSACTIONS === "true") {
                throw transactionUnavailableError();
            }
            console.warn("[order.service] MongoDB replica set transactions unavailable; executing standalone cancellation fallback.");
            const cancelledOrder = await executeOrderCancellation(customerUserId, orderId, null);
            return serializeOrder(cancelledOrder);
        }
        throw error;
    } finally {
        if (session) {
            await session.endSession().catch(() => {});
        }
    }
};

const listVendorOrders = async (vendorUserId) => {
    const orders = await Order.find({
        "items.vendorId": Number(vendorUserId)
    }).sort({ createdAt: -1, _id: -1 }).lean();

    return orders.map((order) => {
        const vendorItems = order.items.filter((item) => Number(item.vendorId) === Number(vendorUserId));
        const subtotalMinor = vendorItems.reduce((sum, item) => sum + item.lineTotalMinor, 0);

        return {
            orderId: order.orderId,
            customerUserId: order.customerUserId,
            status: order.status,
            paymentStatus: order.paymentStatus,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            deliveryAddress: order.deliveryAddress,
            subtotal: fromMinorUnits(subtotalMinor),
            items: vendorItems.map((item) => ({
                productId: item.productId.toString(),
                title: item.title,
                storeName: item.storeName,
                unitPrice: fromMinorUnits(item.unitPriceMinor),
                quantity: item.quantity,
                lineTotal: fromMinorUnits(item.lineTotalMinor)
            }))
        };
    });
};

const updateVendorOrderStatus = async (vendorUserId, orderId, newStatus) => {
    validateOrderId(orderId);
    const validStatuses = ["pending", "processing", "completed", "cancelled"];
    if (!validStatuses.includes(newStatus)) {
        const error = new Error(`Invalid status: ${newStatus}. Allowed: ${validStatuses.join(", ")}`);
        error.statusCode = 400;
        throw error;
    }

    const order = await Order.findOneAndUpdate(
        {
            orderId,
            "items.vendorId": Number(vendorUserId)
        },
        { $set: { status: newStatus } },
        { new: true }
    ).lean();

    if (!order) {
        const error = new Error("Order not found or does not belong to this vendor");
        error.statusCode = 404;
        throw error;
    }

    return order;
};

export {
    createOrder,
    listOrders,
    getOrder,
    cancelOrder,
    serializeOrder,
    listVendorOrders,
    updateVendorOrderStatus
};
