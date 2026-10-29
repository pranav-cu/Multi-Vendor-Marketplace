import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  createProduct,
  deleteProduct,
  getMyProducts,
  updateProduct,
  uploadProductImages,
  resolveProductImageUrl,
  type ProductInput,
  type VendorProduct,
} from '../services/productApi';
import { EditIcon, PlusIcon, SpinnerIcon, TrashIcon, XIcon, UploadIcon } from './ui/Icons';

type ProductFormState = {
  title: string;
  description: string;
  price: string;
  stockQuantity: string;
  images: string[];
};

const emptyForm: ProductFormState = {
  title: '',
  description: '',
  price: '',
  stockQuantity: '',
  images: [],
};

const toFormState = (product?: VendorProduct): ProductFormState => ({
  title: product?.title || '',
  description: product?.description || '',
  price: product ? String(product.price) : '',
  stockQuantity: product ? String(product.stockQuantity) : '',
  images: product?.images ? [...product.images] : [],
});

const validateForm = (form: ProductFormState): string | null => {
  if (!form.title.trim()) return 'Title is required.';
  if (!form.description.trim()) return 'Description is required.';

  const price = Number(form.price);
  if (!Number.isFinite(price) || price <= 0) {
    return 'Price must be a positive number.';
  }

  const stockQuantity = Number(form.stockQuantity);
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
    return 'Stock quantity must be a non-negative integer.';
  }

  return null;
};

const toProductInput = (form: ProductFormState): ProductInput => ({
  title: form.title.trim(),
  description: form.description.trim(),
  price: Number(form.price),
  stockQuantity: Number(form.stockQuantity),
  images: form.images,
});

export default function VendorProductManagement() {
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<VendorProduct | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    setImageUploadError(null);

    try {
      const fileList = Array.from(files);
      const uploadedUrls = await uploadProductImages(fileList);
      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls],
      }));
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : 'Failed to upload image(s).');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, idx) => idx !== indexToRemove),
    }));
  };

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setProducts(await getMyProducts());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load your products.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  const openCreateForm = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setErrorMessage(null);
    setSuccessMessage(null);
    setImageUploadError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (product: VendorProduct) => {
    setEditingProduct(product);
    setForm(toFormState(product));
    setErrorMessage(null);
    setSuccessMessage(null);
    setImageUploadError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (!isSubmitting) setIsFormOpen(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateForm(form);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const input = toProductInput(form);
      if (editingProduct) {
        await updateProduct(editingProduct.productId, input);
      } else {
        await createProduct(input);
      }

      await loadProducts();
      setIsFormOpen(false);
      setSuccessMessage(editingProduct ? 'Product updated successfully.' : 'Product added successfully.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save the product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (product: VendorProduct) => {
    if (!window.confirm(`Delete "${product.title}"? This action cannot be undone.`)) return;

    setDeletingProductId(product.productId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await deleteProduct(product.productId);
      setProducts((current) =>
        current.filter((currentProduct) => currentProduct.productId !== product.productId)
      );
      setSuccessMessage('Product deleted successfully.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete the product.');
    } finally {
      setDeletingProductId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold uppercase tracking-wide text-neutral-900">
            Product Management
          </h2>
          <p className="text-xs text-neutral-500 font-light">
            Manage your live catalog, prices, and inventory.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="self-start bg-black px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-neutral-800"
        >
          <span className="inline-flex items-center gap-2">
            <PlusIcon />
            Add Product
          </span>
        </button>
      </div>

      {successMessage && (
        <div role="status" className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div role="alert" className="flex items-center justify-between gap-4 border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <span>{errorMessage}</span>
          {!isFormOpen && (
            <button type="button" onClick={() => void loadProducts()} className="font-semibold uppercase tracking-wider underline">
              Retry
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center border border-neutral-200 bg-white">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-500">
            <SpinnerIcon />
            Loading products
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="space-y-3 border border-dashed border-neutral-300 bg-white py-16 text-center">
          <p className="text-xs uppercase tracking-widest text-neutral-400">No products listed yet.</p>
          <button type="button" onClick={openCreateForm} className="bg-black px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white">
            Add your first product
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-[#fbfbfa] text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-600">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.map((product) => (
                <tr key={product.productId} className="hover:bg-neutral-50/70">
                  <td className="max-w-xs px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 shrink-0 border border-neutral-200 bg-[#f4f2ee] overflow-hidden flex items-center justify-center">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={resolveProductImageUrl(product.images[0])}
                            alt={product.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest">
                            No Img
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-neutral-900 truncate">{product.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-500">{product.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-neutral-600">
                    <p>{product.storeName}</p>
                    <p className="mt-1 text-[10px] text-neutral-400">{product.vendorEmail}</p>
                  </td>
                  <td className="px-4 py-4 font-semibold text-neutral-900">${product.price.toLocaleString()}</td>
                  <td className="px-4 py-4 font-mono text-neutral-700">{product.stockQuantity}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right">
                    <button type="button" onClick={() => openEditForm(product)} className="mr-2 p-1.5 text-neutral-500 hover:text-black" title={`Edit ${product.title}`}>
                      <EditIcon />
                      <span className="sr-only">Edit {product.title}</span>
                    </button>
                    <button type="button" onClick={() => void handleDelete(product)} disabled={deletingProductId === product.productId} className="p-1.5 text-neutral-400 hover:text-red-600 disabled:opacity-50" title={`Delete ${product.title}`}>
                      {deletingProductId === product.productId ? <SpinnerIcon /> : <TrashIcon />}
                      <span className="sr-only">Delete {product.title}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto border border-neutral-300 bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-6 flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 id="product-form-title" className="text-sm font-semibold uppercase tracking-wider text-neutral-900">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h3>
              <button type="button" onClick={closeForm} className="text-neutral-400 hover:text-black" aria-label="Close product form">
                <XIcon />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-700">Title</span>
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="w-full border border-neutral-300 bg-[#f6f6f4] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-700">Description</span>
                <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} className="w-full border border-neutral-300 bg-[#f6f6f4] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900" />
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-700">Price</span>
                  <input type="number" min="0.01" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} className="w-full border border-neutral-300 bg-[#f6f6f4] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-700">Stock quantity</span>
                  <input type="number" min="0" step="1" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: event.target.value })} className="w-full border border-neutral-300 bg-[#f6f6f4] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900" />
                </label>
              </div>

              {/* Product Images Local / MongoDB Uploader */}
              <div className="space-y-2 pt-2 border-t border-neutral-200">
                <div className="flex items-center justify-between">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-700">
                    Product Images ({form.images.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage || isSubmitting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[10px] font-semibold uppercase tracking-wider border border-neutral-300 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingImage ? <SpinnerIcon className="w-3 h-3 animate-spin" /> : <UploadIcon className="w-3 h-3" />}
                    <span>{isUploadingImage ? 'Uploading...' : 'Upload Image(s)'}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                </div>

                {imageUploadError && (
                  <p className="text-[11px] text-red-600 bg-red-50 p-2 border border-red-200">
                    {imageUploadError}
                  </p>
                )}

                {form.images.length > 0 ? (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1">
                    {form.images.map((imgUrl, idx) => (
                      <div key={idx} className="relative aspect-square border border-neutral-300 bg-neutral-100 group overflow-hidden">
                        <img
                          src={resolveProductImageUrl(imgUrl)}
                          alt={`Product view ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1 right-1 bg-black/80 hover:bg-black text-white p-0.5 rounded-full opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Remove image"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-400 font-light italic">
                    No images uploaded yet. Upload images to store locally and associate with this catalog specimen.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeForm} disabled={isSubmitting} className="border border-neutral-300 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-black px-6 py-2 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-60">
                  {isSubmitting && <SpinnerIcon />}
                  {isSubmitting ? 'Saving' : editingProduct ? 'Save changes' : 'Add product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
