const serializeVendorPublic = (vendor) => {
    const source = vendor?.toObject ? vendor.toObject() : vendor;
    if (!source) return null;

    return {
        userId: source.userId,
        email: source.email,
        storeName: source.storeName,
        slug: source.slug,
        status: source.status,
        uuid: source.uuid,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt
    };
};

const serializeVendorSelf = (vendor) => {
    const source = vendor?.toObject ? vendor.toObject() : vendor;
    if (!source) return null;

    return {
        userId: source.userId,
        email: source.email,
        storeName: source.storeName,
        slug: source.slug,
        status: source.status,
        uuid: source.uuid,
        commissionPct: source.commissionPct ?? 10,
        payoutAccountId: source.payoutAccountId || "",
        kycDocs: source.kycDocs || [],
        createdAt: source.createdAt,
        updatedAt: source.updatedAt
    };
};

export { serializeVendorPublic, serializeVendorSelf };
