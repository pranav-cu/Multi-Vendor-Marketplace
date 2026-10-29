import {
    createOrder,
    listOrders,
    getOrder,
    cancelOrder,
    listVendorOrders,
    updateVendorOrderStatus
} from "../services/order.service.js";
import { parsePagination } from "../utils/catalog.validation.js";
import { addressSnapshot, validateDeliveryAddress, validateOrderId } from "../utils/order.validation.js";
import { resolveOwnedAddress } from "../services/customer.service.js";

const userIdFromRequest = (req, res) => {
    const userId = req.user?.userId;
    if (userId === undefined || userId === null) {
        res.status(401).json({ message: "Authenticated customer identity is required" });
        return null;
    }
    return userId;
};

export const createOrderController = async (req, res) => {
    try {
        const userId = userIdFromRequest(req, res);
        if (userId === null) return;
        const { deliveryAddress: suppliedAddress, savedAddressId } = req.body || {};
        if (suppliedAddress !== undefined && savedAddressId !== undefined) {
            return res.status(400).json({
                message: "Provide either deliveryAddress or savedAddressId, not both"
            });
        }
        const deliveryAddress = savedAddressId !== undefined
            ? addressSnapshot(await resolveOwnedAddress(userId, savedAddressId))
            : validateDeliveryAddress(suppliedAddress);
        const order = await createOrder(userId, deliveryAddress);
        return res.status(201).json({ message: "Order created successfully", data: order });
    } catch (error) {
        console.error("Error in createOrderController:", error);
        const response = { message: error.message || "Unable to create order" };
        if (error.details) response.details = error.details;
        return res.status(error.statusCode || 500).json(response);
    }
};

export const listOrdersController = async (req, res) => {
    try {
        const userId = userIdFromRequest(req, res);
        if (userId === null) return;
        const { page, pageSize } = parsePagination(req.query);
        const result = await listOrders(userId, page, pageSize);
        return res.status(200).json({ message: "Orders fetched successfully", data: result });
    } catch (error) {
        console.error("Error in listOrdersController:", error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Unable to fetch orders"
        });
    }
};

export const getOrderController = async (req, res) => {
    try {
        const userId = userIdFromRequest(req, res);
        if (userId === null) return;
        const order = await getOrder(userId, validateOrderId(req.params.orderId));
        return res.status(200).json({ message: "Order fetched successfully", data: order });
    } catch (error) {
        console.error("Error in getOrderController:", error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Unable to fetch order"
        });
    }
};

export const cancelOrderController = async (req, res) => {
    try {
        const userId = userIdFromRequest(req, res);
        if (userId === null) return;
        const order = await cancelOrder(userId, validateOrderId(req.params.orderId));
        return res.status(200).json({ message: "Order cancelled successfully", data: order });
    } catch (error) {
        console.error("Error in cancelOrderController:", error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Unable to cancel order"
        });
    }
};

export const getVendorOrdersController = async (req, res) => {
    try {
        const vendorUserId = req.user?.userId;
        if (!vendorUserId) {
            return res.status(401).json({ message: "Vendor authentication required" });
        }
        const orders = await listVendorOrders(vendorUserId);
        return res.status(200).json({
            message: "Vendor sub-orders fetched successfully",
            data: orders
        });
    } catch (error) {
        console.error("Error in getVendorOrdersController:", error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Unable to fetch vendor orders"
        });
    }
};

export const updateVendorOrderStatusController = async (req, res) => {
    try {
        const vendorUserId = req.user?.userId;
        if (!vendorUserId) {
            return res.status(401).json({ message: "Vendor authentication required" });
        }
        const { orderId } = req.params;
        const { status } = req.body || {};
        if (!status) {
            return res.status(400).json({ message: "status is required" });
        }
        const updated = await updateVendorOrderStatus(vendorUserId, orderId, status);
        return res.status(200).json({
            message: "Sub-order status updated successfully",
            data: updated
        });
    } catch (error) {
        console.error("Error in updateVendorOrderStatusController:", error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Unable to update sub-order status"
        });
    }
};

export default {
    createOrderController,
    listOrdersController,
    getOrderController,
    cancelOrderController,
    getVendorOrdersController,
    updateVendorOrderStatusController
};
