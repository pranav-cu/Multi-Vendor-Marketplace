import test from 'node:test';
import assert from 'node:assert/strict';

// Set up mock window / localStorage environment for Node.js test runner
const storage = new Map();
globalThis.window = {};
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

// Helper to create synthetic JWTs without external dependencies
const createSyntheticJwt = (payload) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'synthetic-signature-bytes';
  return `${header}.${body}.${signature}`;
};

test('1. Customer JWT Validation and Role Enforcement', async (t) => {
  const { validateCustomerToken } = await import('../src/utils/customerAuthUtils.ts');

  await t.test('accepts valid, unexpired customer JWT', () => {
    const validToken = createSyntheticJwt({
      userId: 4001,
      email: 'patron@atelier.com',
      role: 'customer',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const result = validateCustomerToken(validToken);
    assert.ok(result);
    assert.equal(result.userId, 4001);
    assert.equal(result.email, 'patron@atelier.com');
    assert.equal(result.role, 'customer');
  });

  await t.test('strictly rejects vendor or admin tokens from being customer sessions', () => {
    const vendorToken = createSyntheticJwt({
      userId: 1001,
      email: 'vendor@atelier.com',
      role: 'vendor',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const adminToken = createSyntheticJwt({
      userId: 9001,
      email: 'admin@atelier.com',
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    assert.equal(validateCustomerToken(vendorToken), null);
    assert.equal(validateCustomerToken(adminToken), null);
  });

  await t.test('rejects expired customer tokens', () => {
    const expiredToken = createSyntheticJwt({
      userId: 4001,
      email: 'patron@atelier.com',
      role: 'customer',
      exp: Math.floor(Date.now() / 1000) - 60, // 1 minute in the past
    });
    assert.equal(validateCustomerToken(expiredToken), null);
  });

  await t.test('rejects malformed or non-string tokens safely', () => {
    assert.equal(validateCustomerToken(''), null);
    assert.equal(validateCustomerToken(null), null);
    assert.equal(validateCustomerToken('invalid.jwt'), null);
    assert.equal(validateCustomerToken('not-a-token'), null);
  });
});

test('2. Customer API Client & Error Handling', async (t) => {
  const {
    CustomerApiError,
    customerRequest,
    setCustomerToken,
    removeCustomerToken,
    VENDOR_SERVICE_URL,
  } = await import('../src/services/customerApi.ts');

  await t.test('VENDOR_SERVICE_URL has no trailing slash', () => {
    assert.ok(!VENDOR_SERVICE_URL.endsWith('/'));
  });

  await t.test('requiresAuth throws 401 CustomerApiError when no token is present', async () => {
    removeCustomerToken();
    await assert.rejects(
      async () => {
        await customerRequest('/cart', { requiresAuth: true });
      },
      (err) => {
        assert.ok(err instanceof CustomerApiError);
        assert.equal(err.statusCode, 401);
        assert.match(err.message, /sign in/i);
        return true;
      }
    );
  });

  await t.test('requiresAuth attaches Bearer token when customer token exists', async () => {
    const token = createSyntheticJwt({ userId: 55, email: 't@t.com', role: 'customer' });
    setCustomerToken(token);

    let capturedHeaders = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      capturedHeaders = init.headers;
      return new Response(JSON.stringify({ message: 'ok', data: { items: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const res = await customerRequest('/cart', { requiresAuth: true });
      assert.deepEqual(res, { items: [] });
      assert.equal(capturedHeaders.Authorization, `Bearer ${token}`);
    } finally {
      globalThis.fetch = originalFetch;
      removeCustomerToken();
    }
  });

  await t.test('unwraps data envelope when present and maps error messages', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => new Response(
      JSON.stringify({
        message: 'Insufficient stock',
        details: [{ productId: '65f1', reason: 'Insufficient stock' }],
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );

    try {
      await assert.rejects(
        async () => {
          await customerRequest('/orders');
        },
        (err) => {
          assert.ok(err instanceof CustomerApiError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.message, 'Insufficient stock');
          assert.ok(Array.isArray(err.details));
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('maps 503 service unavailable with helpful message', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => new Response(
      JSON.stringify({ message: 'Checkout requires MongoDB transaction support; no order was created' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );

    try {
      await assert.rejects(
        async () => {
          await customerRequest('/orders');
        },
        (err) => {
          assert.ok(err instanceof CustomerApiError);
          assert.equal(err.statusCode, 503);
          assert.match(err.message, /transaction support/i);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('network connection drop is mapped to 503 CustomerApiError', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    try {
      await assert.rejects(
        async () => {
          await customerRequest('/catalog/products');
        },
        (err) => {
          assert.ok(err instanceof CustomerApiError);
          assert.equal(err.statusCode, 503);
          assert.match(err.message, /check your network connection/i);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('3. Catalogue Search & Pagination Contract', async (t) => {
  const { getCatalogProducts } = await import('../src/services/customerApi.ts');

  await t.test('serializes pagination and truncates oversized search query to 100 chars', async () => {
    let requestedUrl = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      requestedUrl = String(url);
      return new Response(
        JSON.stringify({
          message: 'ok',
          data: { items: [], page: 2, pageSize: 12, totalItems: 0, totalPages: 0 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const veryLongSearch = 'a'.repeat(150);
      const res = await getCatalogProducts({
        page: 2,
        pageSize: 12,
        search: veryLongSearch,
      });

      assert.equal(res.page, 2);
      const parsed = new URL(requestedUrl);
      assert.equal(parsed.searchParams.get('page'), '2');
      assert.equal(parsed.searchParams.get('pageSize'), '12');
      assert.equal(parsed.searchParams.get('search'), 'a'.repeat(100));
      assert.equal(parsed.searchParams.get('search').length, 100);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('4. Checkout Mutual Exclusivity and Address Contract', async (t) => {
  const { createOrder, setCustomerToken, removeCustomerToken } = await import('../src/services/customerApi.ts');
  const token = createSyntheticJwt({ userId: 42, role: 'customer' });
  setCustomerToken(token);

  await t.test('submits only savedAddressId when using saved address mode', async () => {
    let capturedBody = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          message: 'Order created',
          data: { orderId: 'ORD-1234', status: 'pending', paymentStatus: 'pending' },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const order = await createOrder({ savedAddressId: 'addr-xyz-789' });
      assert.equal(order.orderId, 'ORD-1234');
      assert.equal(capturedBody.savedAddressId, 'addr-xyz-789');
      assert.equal(capturedBody.deliveryAddress, undefined);
    } finally {
      globalThis.fetch = originalFetch;
      removeCustomerToken();
    }
  });

  await t.test('submits only deliveryAddress when using inline address mode', async () => {
    setCustomerToken(token);
    let capturedBody = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          message: 'Order created',
          data: { orderId: 'ORD-5678', status: 'pending', paymentStatus: 'pending' },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const inlineAddr = {
        recipientName: 'Jane Client',
        phone: '+1 555-0100',
        addressLine1: '742 Evergreen Terrace',
        city: 'Springfield',
        state: 'OR',
        postalCode: '97477',
        country: 'USA',
      };
      const order = await createOrder({ deliveryAddress: inlineAddr });
      assert.equal(order.orderId, 'ORD-5678');
      assert.deepEqual(capturedBody.deliveryAddress, inlineAddr);
      assert.equal(capturedBody.savedAddressId, undefined);
    } finally {
      globalThis.fetch = originalFetch;
      removeCustomerToken();
    }
  });
});

test('5. Cart Mutations & Concurrency / Stock Conflict Contract', async (t) => {
  const { addCartItem, updateCartItem, removeCartItem, clearCart, setCustomerToken, removeCustomerToken, CustomerApiError } = await import('../src/services/customerApi.ts');
  const token = createSyntheticJwt({ userId: 99, role: 'customer' });
  setCustomerToken(token);

  await t.test('addCartItem passes positive integer quantity and productId', async () => {
    let capturedBody = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          message: 'Item added',
          data: { cartId: 'c1', items: [{ productId: 'p1', quantity: 2 }], total: 100, currency: 'USD' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const cart = await addCartItem('p1', 2);
      assert.equal(capturedBody.productId, 'p1');
      assert.equal(capturedBody.quantity, 2);
      assert.equal(cart.total, 100);
    } finally {
      globalThis.fetch = originalFetch;
      removeCustomerToken();
    }
  });

  await t.test('handles 409 stock limit conflict appropriately', async () => {
    setCustomerToken(token);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      JSON.stringify({ message: 'Requested quantity exceeds available stock of 3' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );

    try {
      await assert.rejects(
        async () => {
          await updateCartItem('p1', 5);
        },
        (err) => {
          assert.ok(err instanceof CustomerApiError);
          assert.equal(err.statusCode, 409);
          assert.match(err.message, /exceeds available stock/);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
      removeCustomerToken();
    }
  });
});

test('6. Order Cancellation Contract & Status Validation', async (t) => {
  const { cancelOrder, setCustomerToken, removeCustomerToken, CustomerApiError } = await import('../src/services/customerApi.ts');
  const token = createSyntheticJwt({ userId: 101, role: 'customer' });
  setCustomerToken(token);

  await t.test('calls POST /orders/:orderId/cancel and deserializes cancelled order', async () => {
    let requestedMethod = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      requestedMethod = init.method;
      return new Response(
        JSON.stringify({
          message: 'Order cancelled',
          data: { orderId: 'ORD-999', status: 'cancelled', paymentStatus: 'pending' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const res = await cancelOrder('ORD-999');
      assert.equal(requestedMethod, 'POST');
      assert.equal(res.status, 'cancelled');
    } finally {
      globalThis.fetch = originalFetch;
      removeCustomerToken();
    }
  });

  await t.test('handles 409 when order cannot be cancelled in its current state', async () => {
    setCustomerToken(token);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      JSON.stringify({ message: 'Order cannot be cancelled in its current state' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );

    try {
      await assert.rejects(
        async () => {
          await cancelOrder('ORD-COMPLETED');
        },
        (err) => {
          assert.ok(err instanceof CustomerApiError);
          assert.equal(err.statusCode, 409);
          assert.match(err.message, /cannot be cancelled/i);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
      removeCustomerToken();
    }
  });
});

test('7. Customer Profile & Address Book Contract', async (t) => {
  const { updateCustomerProfile, addAddress, deleteAddress, setDefaultAddress, setCustomerToken, removeCustomerToken } = await import('../src/services/customerApi.ts');
  const token = createSyntheticJwt({ userId: 77, role: 'customer' });
  setCustomerToken(token);

  await t.test('updateCustomerProfile only submits displayName truncated to 120 chars', async () => {
    let capturedBody = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          message: 'Profile updated',
          data: { customerId: 'c77', userId: 77, displayName: capturedBody.displayName },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const veryLongName = 'x'.repeat(150);
      await updateCustomerProfile(veryLongName);
      assert.equal(capturedBody.displayName.length, 120);
      assert.equal(Object.keys(capturedBody).length, 1);
    } finally {
      globalThis.fetch = originalFetch;
      removeCustomerToken();
    }
  });

  await t.test('addAddress sends validated address fields and receives created record', async () => {
    setCustomerToken(token);
    let capturedBody = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          message: 'Address added',
          data: { addressId: 'a1', isDefault: true, ...capturedBody },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const input = {
        recipientName: 'Patron One',
        phone: '+1 555-0199',
        addressLine1: '123 Rue de Louvre',
        city: 'Paris',
        state: 'IDF',
        postalCode: '75001',
        country: 'France',
        isDefault: true,
      };
      const result = await addAddress(input);
      assert.equal(result.addressId, 'a1');
      assert.equal(result.isDefault, true);
    } finally {
      globalThis.fetch = originalFetch;
      removeCustomerToken();
    }
  });

  await t.test('setDefaultAddress calls PATCH /customers/me/addresses/:addressId/default', async () => {
    setCustomerToken(token);
    let requestedUrl = '';
    let requestedMethod = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      requestedUrl = String(url);
      requestedMethod = init.method;
      return new Response(
        JSON.stringify({
          message: 'Default updated',
          data: { addressId: 'a2', isDefault: true },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const result = await setDefaultAddress('a2');
      assert.equal(requestedMethod, 'PATCH');
      assert.ok(requestedUrl.endsWith('/customers/me/addresses/a2/default'));
      assert.equal(result.isDefault, true);
    } finally {
      globalThis.fetch = originalFetch;
      removeCustomerToken();
    }
  });
});

test('8. Role-Based Access Control & Privilege Enforcement', async (t) => {
  const {
    validateUserToken,
    isAdminToken,
    isVendorToken,
  } = await import('../src/utils/customerAuthUtils.ts');
  const { getPendingVendors } = await import('../src/services/adminApi.ts');

  const adminToken = createSyntheticJwt({
    userId: 9001,
    email: 'curator@atelier.com',
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const vendorToken = createSyntheticJwt({
    userId: 1001,
    email: 'atelier@minimaliste.fr',
    role: 'vendor',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const customerToken = createSyntheticJwt({
    userId: 4001,
    email: 'client@atelier.com',
    role: 'customer',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  await t.test('token validation identifies roles precisely', () => {
    assert.equal(isAdminToken(adminToken), true);
    assert.equal(isAdminToken(vendorToken), false);
    assert.equal(isAdminToken(customerToken), false);

    assert.equal(isVendorToken(vendorToken), true);
    assert.equal(isVendorToken(adminToken), false);
    assert.equal(isVendorToken(customerToken), false);

    assert.equal(validateUserToken(adminToken)?.role, 'admin');
    assert.equal(validateUserToken(vendorToken)?.role, 'vendor');
    assert.equal(validateUserToken(customerToken)?.role, 'customer');
  });

  await t.test('adminApi throws error when no token is present', async () => {
    storage.delete('vendor_token');
    await assert.rejects(
      () => getPendingVendors(),
      /Please sign in with an administrator account/
    );
  });

  await t.test('adminApi rejects vendor or customer tokens with access denied', async () => {
    storage.set('vendor_token', vendorToken);
    await assert.rejects(
      () => getPendingVendors(),
      /Access denied: Administrator privileges required/
    );

    storage.set('vendor_token', customerToken);
    await assert.rejects(
      () => getPendingVendors(),
      /Access denied: Administrator privileges required/
    );
  });

  await t.test('adminApi sends request and unwraps response when admin token is provided', async () => {
    storage.set('vendor_token', adminToken);
    let authHeader = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      authHeader = init.headers?.Authorization || '';
      return new Response(
        JSON.stringify({
          message: 'Pending vendors',
          data: [{ userId: 1003, storeName: 'Mercer Bronze', status: 'pending' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const pending = await getPendingVendors();
      assert.equal(authHeader, `Bearer ${adminToken}`);
      assert.equal(pending.length, 1);
      assert.equal(pending[0].storeName, 'Mercer Bronze');
    } finally {
      globalThis.fetch = originalFetch;
      storage.delete('vendor_token');
    }
  });
});

test('9. Product Image Upload & Resolution Contract', async (t) => {
  const { uploadProductImages, resolveProductImageUrl } = await import(
    '../src/services/productApi.ts'
  );

  await t.test('resolveProductImageUrl preserves external and data URLs', () => {
    assert.equal(
      resolveProductImageUrl('https://images.unsplash.com/photo-1'),
      'https://images.unsplash.com/photo-1'
    );
    assert.equal(
      resolveProductImageUrl('data:image/png;base64,abc123'),
      'data:image/png;base64,abc123'
    );
    assert.equal(resolveProductImageUrl(''), '');
  });

  await t.test('resolveProductImageUrl resolves local /uploads paths', () => {
    const resolved = resolveProductImageUrl('/uploads/products/lamp.jpg');
    assert.ok(resolved.endsWith('/uploads/products/lamp.jpg'));
    assert.ok(resolved.startsWith('http'));
  });

  await t.test('uploadProductImages throws when not authenticated', async () => {
    storage.delete('vendor_token');
    await assert.rejects(
      () => uploadProductImages([]),
      /Please sign in before uploading images/
    );
  });

  await t.test('uploadProductImages sends files and returns uploaded paths', async () => {
    storage.set('vendor_token', 'valid-vendor-token');
    let requestMethod = '';
    let hasAuth = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      requestMethod = init.method;
      hasAuth = init.headers?.Authorization === 'Bearer valid-vendor-token';
      return new Response(
        JSON.stringify({
          message: 'Product image(s) uploaded successfully',
          data: {
            images: ['/uploads/products/prod-vase-123.jpg'],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      // Mock File object
      const dummyFile = { name: 'vase.jpg', type: 'image/jpeg' };
      const urls = await uploadProductImages([dummyFile]);
      assert.equal(requestMethod, 'POST');
      assert.equal(hasAuth, true);
      assert.deepEqual(urls, ['/uploads/products/prod-vase-123.jpg']);
    } finally {
      globalThis.fetch = originalFetch;
      storage.delete('vendor_token');
    }
  });
});

test('10. Vendor API Client & Dashboard Integration', async (t) => {
  const {
    getVendorProfile,
    getVendorOrders,
    updateVendorOrderStatus,
  } = await import('../src/services/vendorApi.ts');

  await t.test('getVendorProfile throws error when vendor token is missing', async () => {
    storage.delete('vendor_token');
    await assert.rejects(
      () => getVendorProfile(),
      /Please sign in with a vendor account/
    );
  });

  await t.test('getVendorProfile sends request with vendor token and unwraps profile', async () => {
    storage.set('vendor_token', 'mock-vendor-token');
    const originalFetch = globalThis.fetch;
    let requestedUrl = '';
    let authHeader = '';

    globalThis.fetch = async (url, init) => {
      requestedUrl = String(url);
      authHeader = init?.headers?.Authorization || '';
      return new Response(
        JSON.stringify({
          message: 'Profile retrieved',
          data: {
            userId: 1001,
            email: 'artisan@atelier.com',
            storeName: 'Atelier Ceramics',
            slug: 'atelier-ceramics',
            status: 'approved',
            commissionPct: 12,
            payoutAccountId: 'acct_1001',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const profile = await getVendorProfile();
      assert.ok(requestedUrl.includes('/vendor-data/profile'));
      assert.equal(authHeader, 'Bearer mock-vendor-token');
      assert.equal(profile.userId, 1001);
      assert.equal(profile.storeName, 'Atelier Ceramics');
      assert.equal(profile.commissionPct, 12);
    } finally {
      globalThis.fetch = originalFetch;
      storage.delete('vendor_token');
    }
  });

  await t.test('getVendorOrders retrieves vendor sub-orders', async () => {
    storage.set('vendor_token', 'mock-vendor-token');
    const originalFetch = globalThis.fetch;
    let requestedUrl = '';

    globalThis.fetch = async (url) => {
      requestedUrl = String(url);
      return new Response(
        JSON.stringify({
          message: 'Vendor orders fetched',
          data: [
            {
              orderId: 'ORD-123',
              customerUserId: 4001,
              status: 'pending',
              paymentStatus: 'paid',
              subtotal: 120,
              items: [
                {
                  productId: 'prod-1',
                  title: 'Clay Mug',
                  storeName: 'Atelier Ceramics',
                  unitPrice: 60,
                  quantity: 2,
                  lineTotal: 120,
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const orders = await getVendorOrders();
      assert.ok(requestedUrl.includes('/vendor-data/orders'));
      assert.equal(orders.length, 1);
      assert.equal(orders[0].orderId, 'ORD-123');
      assert.equal(orders[0].subtotal, 120);
      assert.equal(orders[0].items[0].quantity, 2);
    } finally {
      globalThis.fetch = originalFetch;
      storage.delete('vendor_token');
    }
  });

  await t.test('updateVendorOrderStatus sends PATCH to update order fulfillment status', async () => {
    storage.set('vendor_token', 'mock-vendor-token');
    const originalFetch = globalThis.fetch;
    let requestedUrl = '';
    let method = '';
    let body = '';

    globalThis.fetch = async (url, init) => {
      requestedUrl = String(url);
      method = init?.method || '';
      body = String(init?.body || '');
      return new Response(
        JSON.stringify({
          message: 'Order status updated',
          data: { orderId: 'ORD-123', status: 'processing' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      await updateVendorOrderStatus('ORD-123', 'processing');
      assert.ok(requestedUrl.includes('/vendor-data/orders/ORD-123/status'));
      assert.equal(method, 'PATCH');
      assert.deepEqual(JSON.parse(body), { status: 'processing' });
    } finally {
      globalThis.fetch = originalFetch;
      storage.delete('vendor_token');
    }
  });
});



