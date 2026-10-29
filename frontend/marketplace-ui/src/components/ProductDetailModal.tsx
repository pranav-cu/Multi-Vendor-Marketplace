import React, { useState, useEffect } from 'react';
import type { CatalogProduct } from '../types/customer';
import { getCatalogProduct, CustomerApiError } from '../services/customerApi';
import { useCustomer } from '../context/useCustomer';
import { XIcon, BagIcon, CheckIcon, SpinnerIcon, AtelierLogoGlyph } from './ui/Icons';

export interface ProductDetailModalProps {
  productId: string;
  onClose: () => void;
  onNavigateToAuth: () => void;
  onNavigateToCart: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  productId,
  onClose,
  onNavigateToAuth,
  onNavigateToCart,
}) => {
  const { isCustomerAuthenticated, addToCart, logoutCustomer } = useCustomer();
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    getCatalogProduct(productId)
      .then((data) => {
        if (isMounted) {
          setProduct(data);
          setQuantity(1);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          if (err instanceof CustomerApiError) {
            setErrorMessage(err.message);
          } else {
            setErrorMessage('Unable to load product dossier.');
          }
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [productId]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAddToCart = async () => {
    if (!product) return;
    if (!isCustomerAuthenticated) {
      onNavigateToAuth();
      return;
    }

    setIsAdding(true);
    setErrorMessage(null);

    try {
      await addToCart(product.productId, quantity);
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 2200);
    } catch (err) {
      if (err instanceof CustomerApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          logoutCustomer();
          onNavigateToAuth();
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage('Failed to add item to bag.');
      }
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-detail-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
    >
      <div className="relative bg-white w-full max-w-2xl border border-neutral-300 shadow-2xl p-6 sm:p-8 space-y-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-neutral-400 hover:text-black p-1 cursor-pointer transition-colors"
        >
          <XIcon className="w-5 h-5" />
        </button>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-500">
            <SpinnerIcon className="w-6 h-6 animate-spin text-neutral-800" />
            <span className="text-xs tracking-widest uppercase">Fetching Object Specification...</span>
          </div>
        ) : errorMessage ? (
          <div className="py-12 text-center space-y-4">
            <p className="text-sm text-red-600">{errorMessage}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-neutral-900 text-white text-xs font-semibold tracking-wider uppercase cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : product ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-start">
            {/* Neutral Editorial Visual Fallback */}
            <div className="aspect-square bg-[#f2efe9] border border-neutral-200 flex flex-col items-center justify-center p-8 text-neutral-400 text-center relative">
              <div className="w-16 h-16 border border-neutral-300 flex items-center justify-center mb-3">
                <AtelierLogoGlyph className="w-8 h-8 text-neutral-600" />
              </div>
              <span className="text-[10px] tracking-[0.25em] uppercase text-neutral-500 font-semibold">
                ARCHIVAL SPECIMEN
              </span>
              <span className="text-[9px] font-mono text-neutral-400 mt-1">ID: {product.productId}</span>
              {product.stockQuantity === 0 && (
                <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center">
                  <span className="text-xs font-bold tracking-widest uppercase text-white bg-black px-3 py-1 border border-neutral-600">
                    EXHAUSTED
                  </span>
                </div>
              )}
            </div>

            {/* Details & Controls */}
            <div className="space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] tracking-[0.2em] font-bold uppercase text-[#9c784e]">
                  <span>{product.storeName ? `ATELIER: ${product.storeName}` : 'CURATED PIECE'}</span>
                </div>

                <h2 id="product-detail-title" className="text-xl sm:text-2xl font-normal text-neutral-900 leading-snug">
                  {product.title}
                </h2>

                <p className="text-lg font-semibold text-neutral-900">
                  ${product.price.toFixed(2)} <span className="text-xs font-normal text-neutral-500">USD</span>
                </p>

                <p className="text-xs text-neutral-600 font-light leading-relaxed pt-2 border-t border-neutral-100">
                  {product.description}
                </p>

                <div className="pt-2 text-xs text-neutral-500 flex items-center gap-2">
                  <span className="font-semibold text-neutral-700">Available Stock:</span>
                  <span>{product.stockQuantity > 0 ? `${product.stockQuantity} units` : 'Out of stock'}</span>
                </div>
              </div>

              {/* Action Area */}
              <div className="pt-4 border-t border-neutral-200 space-y-3">
                {product.stockQuantity > 0 ? (
                  <>
                    <div className="flex items-center gap-3">
                      <label htmlFor="qty-select" className="text-xs font-semibold tracking-wider uppercase text-neutral-700">
                        Quantity:
                      </label>
                      <select
                        id="qty-select"
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="bg-[#fcfcfb] border border-neutral-300 px-3 py-1.5 text-xs text-neutral-800 rounded-none focus:outline-none focus:border-black"
                      >
                        {Array.from({ length: Math.min(product.stockQuantity, 10) }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={isAdding}
                      onClick={handleAddToCart}
                      className={`w-full py-3 text-xs font-semibold tracking-[0.18em] uppercase transition-colors flex items-center justify-center gap-2 rounded-none cursor-pointer ${
                        addedSuccess
                          ? 'bg-emerald-700 text-white'
                          : 'bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-400'
                      }`}
                    >
                      {isAdding ? (
                        <>
                          <SpinnerIcon className="w-4 h-4 animate-spin" />
                          <span>SYNCHRONIZING...</span>
                        </>
                      ) : addedSuccess ? (
                        <>
                          <CheckIcon />
                          <span>ADDED TO BAG</span>
                        </>
                      ) : (
                        <>
                          <BagIcon className="w-4 h-4" />
                          <span>{isCustomerAuthenticated ? 'ADD TO BAG' : 'SIGN IN TO ACQUIRE'}</span>
                        </>
                      )}
                    </button>

                    {addedSuccess && (
                      <button
                        type="button"
                        onClick={onNavigateToCart}
                        className="w-full text-center text-xs font-semibold tracking-wider uppercase text-neutral-800 underline hover:text-black pt-1 cursor-pointer"
                      >
                        View Shopping Bag →
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full py-3 text-xs font-semibold tracking-[0.18em] uppercase bg-neutral-200 text-neutral-400 rounded-none cursor-not-allowed"
                  >
                    OUT OF STOCK
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
