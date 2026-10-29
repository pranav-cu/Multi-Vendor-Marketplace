import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

test.after(async () => {
    await mongoose.disconnect();
});

process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";

const { authenticate, authorizeRoles } = await import("../middlewares/auth.js");
const { isPositiveInteger, isValidProductIdInput } = await import("../utils/cart.validation.js");
const { parsePagination } = await import("../utils/catalog.validation.js");
const {
    validateDeliveryAddress,
    toMinorUnits,
    validateOrderId
} = await import("../utils/order.validation.js");
const { validateAddress } = await import("../utils/address.validation.js");
const { serializeVendorPublic } = await import("../utils/vendor.serialization.js");

const response = () => {
    const result = {};
    return {
        result,
        status(code) {
            result.status = code;
            return this;
        },
        json(body) {
            result.body = body;
            return this;
        }
    };
};

test("customer middleware rejects missing authentication", () => {
    const res = response();
    authenticate({ headers: {} }, res, () => assert.fail("next should not run"));
    assert.equal(res.result.status, 401);
});

test("customer authorization rejects a vendor role", () => {
    const res = response();
    authorizeRoles("customer")({ user: { userId: 7, role: "vendor" } }, res, () => {
        assert.fail("next should not run");
    });
    assert.equal(res.result.status, 403);
});

test("vendor store authorization rejects a customer role", () => {
    const res = response();
    authorizeRoles("vendor", "admin")({ user: { userId: 42, role: "customer" } }, res, () => {
        assert.fail("next should not run");
    });
    assert.equal(res.result.status, 403);
    assert.match(res.result.body.message, /Forbidden: Access requires one of/);
});

test("admin authorization strictly permits only admin role", () => {
    const customerRes = response();
    authorizeRoles("admin")({ user: { userId: 42, role: "customer" } }, customerRes, () => {
        assert.fail("next should not run");
    });
    assert.equal(customerRes.result.status, 403);

    const vendorRes = response();
    authorizeRoles("admin")({ user: { userId: 7, role: "vendor" } }, vendorRes, () => {
        assert.fail("next should not run");
    });
    assert.equal(vendorRes.result.status, 403);

    const adminRes = response();
    let nextCalled = false;
    authorizeRoles("admin")({ user: { userId: 99, role: "admin" } }, adminRes, () => {
        nextCalled = true;
    });
    assert.equal(nextCalled, true);
});

test("customer JWT identity is read from the verified token", () => {
    const token = jwt.sign(
        { userId: 42, email: "customer@example.com", role: "customer" },
        process.env.JWT_SECRET,
        { algorithm: "HS256" }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = response();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.userId, 42);
    assert.equal(req.user.role, "customer");
});

test("cart quantities must be positive integers", () => {
    assert.equal(isPositiveInteger(1), true);
    assert.equal(isPositiveInteger(0), false);
    assert.equal(isPositiveInteger(-1), false);
    assert.equal(isPositiveInteger(1.5), false);
    assert.equal(isPositiveInteger("1"), false);
});

test("cart product IDs must be present strings", () => {
    assert.equal(isValidProductIdInput("507f1f77bcf86cd799439011"), true);
    assert.equal(isValidProductIdInput(""), false);
    assert.equal(isValidProductIdInput(null), false);
});

test("catalog pagination rejects invalid and oversized pages", () => {
    assert.deepEqual(parsePagination({}), { page: 1, pageSize: 20 });
    assert.throws(() => parsePagination({ page: "0" }), /positive integer/);
    assert.throws(() => parsePagination({ pageSize: "51" }), /between 1 and 50/);
});

test("delivery addresses are normalized and required fields are enforced", () => {
    const address = validateDeliveryAddress({
        recipientName: "  Buyer  ",
        phone: "+1 555 0100",
        addressLine1: "10 Market Street",
        city: "London",
        state: "London",
        postalCode: "SW1A 1AA",
        country: "United Kingdom"
    });
    assert.equal(address.recipientName, "Buyer");
    assert.throws(() => validateDeliveryAddress({}), /recipientName is required/);
});

test("order money uses integer minor units", () => {
    assert.equal(toMinorUnits(79.99), 7999);
    assert.equal(toMinorUnits(0), 0);
    assert.throws(() => toMinorUnits(Number.NaN), /price is invalid/);
    assert.throws(() => toMinorUnits(-1), /price is invalid/);
});

test("order identifiers must use the generated order format", () => {
    assert.equal(
        validateOrderId("ORD-00000000-0000-0000-0000-000000000000"),
        "ORD-00000000-0000-0000-0000-000000000000"
    );
    assert.throws(() => validateOrderId("not-an-order"), /Invalid order ID/);
});

test("saved address validation rejects protected fields and normalizes values", () => {
    const address = validateAddress({
        recipientName: "  Buyer  ",
        phone: "+1 555 0100",
        addressLine1: "10 Market Street",
        city: "London",
        state: "London",
        postalCode: "SW1A 1AA",
        country: "United Kingdom",
        label: " Home "
    });
    assert.equal(address.recipientName, "Buyer");
    assert.equal(address.label, "Home");
    assert.throws(() => validateAddress({ userId: 99 }), /recipientName is required/);
});

test("vendor public serialization excludes private KYC and payout fields", () => {
    const result = serializeVendorPublic({
        userId: 7,
        email: "vendor@example.com",
        storeName: "Store",
        slug: "store",
        status: "approved",
        uuid: "vendor-uuid",
        kycDocs: ["private-document-path"],
        payoutAccountId: "private-payout-id",
        password: "private-password"
    });
    assert.deepEqual(result, {
        userId: 7,
        email: "vendor@example.com",
        storeName: "Store",
        slug: "store",
        status: "approved",
        uuid: "vendor-uuid",
        createdAt: undefined,
        updatedAt: undefined
    });
    assert.equal("kycDocs" in result, false);
    assert.equal("payoutAccountId" in result, false);
});

test("vendor self serialization includes commission, payoutAccountId, and KYC docs", async () => {
    const { serializeVendorSelf } = await import("../utils/vendor.serialization.js");
    const result = serializeVendorSelf({
        userId: 7,
        email: "vendor@example.com",
        storeName: "Store",
        slug: "store",
        status: "approved",
        uuid: "vendor-uuid",
        commissionPct: 15,
        payoutAccountId: "acct_test123",
        kycDocs: ["kyc_passport.pdf"],
        password: "hash-should-be-omitted"
    });
    assert.equal(result.commissionPct, 15);
    assert.equal(result.payoutAccountId, "acct_test123");
    assert.deepEqual(result.kycDocs, ["kyc_passport.pdf"]);
    assert.equal("password" in result, false);
});

test("vendor order status update validates status and orderId", async () => {
    const { updateVendorOrderStatus } = await import("../services/order.service.js");
    await assert.rejects(
        () => updateVendorOrderStatus(1001, "invalid-order-id", "processing"),
        /Invalid order ID/
    );
    await assert.rejects(
        () => updateVendorOrderStatus(1001, "ORD-00000000-0000-0000-0000-000000000000", "bogus_status"),
        /Invalid status: bogus_status/
    );
});

test("product images upload controller handles file uploads and missing file errors", async () => {
    const { uploadProductImagesController } = await import("../controllers/product.controller.js");

    const errorRes = response();
    await uploadProductImagesController({ files: [] }, errorRes);
    assert.equal(errorRes.result.status, 400);
    assert.match(errorRes.result.body.message, /No image file was uploaded/);

    const successRes = response();
    await uploadProductImagesController({
        files: [
            { filename: "prod-vase-1.png" },
            { filename: "prod-vase-2.webp" }
        ]
    }, successRes);
    assert.equal(successRes.result.status, 200);
    assert.deepEqual(successRes.result.body.data.images, [
        "/uploads/products/prod-vase-1.png",
        "/uploads/products/prod-vase-2.webp"
    ]);
});
