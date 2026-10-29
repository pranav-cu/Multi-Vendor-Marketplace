import React, { useState, useEffect } from 'react';
import type { CatalogProduct } from '../types/customer';
import { getCatalogProducts, CustomerApiError } from '../services/customerApi';
import { useCustomer } from '../context/useCustomer';
import { ProductDetailModal } from '../components/ProductDetailModal';
import {
  SearchIcon,
  BagIcon,
  CheckIcon,
  SpinnerIcon,
  AtelierLogoGlyph,
} from '../components/ui/Icons';

export interface CatalogViewProps {
  onNavigateToCart: () => void;
  onNavigateToAuth: () => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  onNavigateToCart,
  onNavigateToAuth,
}) => {
  const { isCustomerAuthenticated, addToCart } = useCustomer();

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ text: string; error: boolean } | null>(null);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    getCatalogProducts({
      page,
      pageSize,
      search: activeSearch.trim() || undefined,
    })
      .then((res) => {
        if (!isMounted) return;
        setProducts(res.items);
        setPage(res.page);
        setTotalPages(res.totalPages || 1);
        setTotalItems(res.totalItems);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof CustomerApiError) {
          setErrorMessage(err.message);
        } else if (err instanceof Error) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Failed to load catalogue from marketplace service.');
        }
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [page, activeSearch, pageSize]);

  const handleRetry = () => {
    setIsLoading(true);
    setErrorMessage(null);
    getCatalogProducts({
      page,
      pageSize,
      search: activeSearch.trim() || undefined,
    })
      .then((res) => {
        setProducts(res.items);
        setPage(res.page);
        setTotalPages(res.totalPages || 1);
        setTotalItems(res.totalItems);
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load catalogue.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchQuery.trim().slice(0, 100));
  };

  const handleQuickAdd = async (e: React.MouseEvent, product: CatalogProduct) => {
    e.stopPropagation();
    if (!isCustomerAuthenticated) {
      onNavigateToAuth();
      return;
    }

    setAddingId(product.productId);
    setActionFeedback(null);

    try {
      await addToCart(product.productId, 1);
      setRecentlyAddedId(product.productId);
      setActionFeedback({ text: `Acquired "${product.title}" to client bag.`, error: false });
      setTimeout(() => {
        setRecentlyAddedId(null);
        setActionFeedback((curr) => (curr?.error ? curr : null));
      }, 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to acquire piece.';
      setActionFeedback({ text: msg, error: true });
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Editorial Header */}
      <div className="mb-10 space-y-3">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.22em] uppercase text-[#9c784e]">
          <span className="w-2 h-2 bg-[#9c784e]" aria-hidden="true" />
          <span>CURATED CROSS-VENDOR REPOSITORY • LIVE CATALOGUE</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-normal tracking-tight text-neutral-900 leading-tight">
              Archival Catalogue
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 font-light max-w-xl mt-1">
              Authoritative product repository populated from verified approved ateliers.
            </p>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
            <input
              type="text"
              maxLength={100}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SEARCH BY TITLE OR DETAIL..."
              className="w-full bg-[#f4f4f2] border border-neutral-300 px-3.5 py-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-black tracking-wider uppercase rounded-none"
            />
            <button
              type="submit"
              className="absolute right-3 top-2.5 text-neutral-400 hover:text-black cursor-pointer"
              aria-label="Submit search"
            >
              <SearchIcon className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Action feedback banner */}
      {actionFeedback && (
        <div
          className={`mb-6 p-3 text-xs flex items-center justify-between border ${
            actionFeedback.error
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <span>{actionFeedback.text}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-[10px] font-bold uppercase tracking-wider underline cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-y border-neutral-200 py-3 mb-8 gap-2 text-xs">
        <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-neutral-600">
          {isLoading
            ? 'SYNCHRONIZING WITH BACKEND...'
            : `SHOWING ${products.length} OF ${totalItems} ARTIFACTS`}
          {activeSearch && ` MATCHING "${activeSearch}"`}
        </div>

        {activeSearch && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveSearch('');
              setPage(1);
            }}
            className="text-[10px] font-bold tracking-widest uppercase text-neutral-900 underline hover:text-neutral-600 cursor-pointer text-left"
          >
            Clear Search Filter
          </button>
        )}
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="p-6 bg-red-50 border border-red-200 text-center space-y-3 mb-10">
          <p className="text-xs text-red-800 font-medium">{errorMessage}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="px-5 py-2 bg-neutral-900 text-white text-[10px] font-semibold tracking-wider uppercase hover:bg-neutral-800 cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="bg-white border border-neutral-200 p-6 space-y-4 animate-pulse">
              <div className="aspect-[4/3] bg-neutral-200" />
              <div className="h-4 bg-neutral-200 w-3/4" />
              <div className="h-3 bg-neutral-100 w-full" />
              <div className="h-3 bg-neutral-100 w-1/2" />
              <div className="h-8 bg-neutral-200 w-full pt-4" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="py-24 text-center border border-dashed border-neutral-300 bg-[#fafaf8] space-y-3">
          <AtelierLogoGlyph className="w-8 h-8 text-neutral-300 mx-auto" />
          <p className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">
            No approved products found in the catalog.
          </p>
          <p className="text-[11px] text-neutral-400 font-light">
            Products must belong to an approved atelier to appear in the live customer catalogue.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {products.map((product) => {
            const isAdded = recentlyAddedId === product.productId;
            const isPending = addingId === product.productId;

            return (
              <article
                key={product.productId}
                onClick={() => setSelectedProductId(product.productId)}
                className="group flex flex-col justify-between bg-white border border-neutral-200/90 transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] cursor-pointer"
              >
                {/* Image Container with Neutral Luxury Architectural Fallback */}
                <div className="relative aspect-[4/3] bg-[#ece9e2] overflow-hidden flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-12 h-12 border border-neutral-300 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <AtelierLogoGlyph className="w-6 h-6 text-neutral-600" />
                  </div>
                  <span className="text-[9px] font-bold tracking-[0.24em] uppercase text-neutral-500">
                    SPECIMEN ARCHIVE
                  </span>

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="bg-white/95 backdrop-blur-xs border border-neutral-200 px-2.5 py-1 text-[9px] font-bold tracking-[0.18em] uppercase text-neutral-800">
                      {product.storeName || 'INDEPENDENT ATELIER'}
                    </span>

                    {product.stockQuantity <= 5 && product.stockQuantity > 0 && (
                      <span className="bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase">
                        ONLY {product.stockQuantity} LEFT
                      </span>
                    )}

                    {product.stockQuantity === 0 && (
                      <span className="bg-neutral-800 text-white px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase">
                        EXHAUSTED
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Section */}
                <div className="p-6 flex flex-col flex-1 justify-between space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.16em] uppercase text-[#9c784e]">
                      <span>STOCK: {product.stockQuantity}</span>
                      <span className="font-mono text-neutral-400">ID: {product.productId.slice(-6)}</span>
                    </div>

                    <h2 className="text-base font-normal tracking-tight text-neutral-900 group-hover:text-black">
                      {product.title}
                    </h2>

                    <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed font-light">
                      {product.description}
                    </p>
                  </div>

                  {/* Price & Action Button */}
                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-sm font-semibold tracking-wide text-neutral-900">
                      ${product.price.toFixed(2)}{' '}
                      <span className="text-[10px] text-neutral-400 font-normal">USD</span>
                    </span>

                    <button
                      type="button"
                      disabled={product.stockQuantity === 0 || isPending}
                      onClick={(e) => handleQuickAdd(e, product)}
                      className={`px-4 py-2.5 text-[10px] font-semibold tracking-[0.18em] uppercase transition-colors rounded-none cursor-pointer flex items-center gap-1.5 ${
                        isAdded
                          ? 'bg-emerald-700 text-white'
                          : product.stockQuantity === 0
                          ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                          : 'bg-black text-white hover:bg-neutral-800'
                      }`}
                    >
                      {isPending ? (
                        <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                      ) : isAdded ? (
                        <>
                          <CheckIcon />
                          <span>ACQUIRED</span>
                        </>
                      ) : (
                        <>
                          <BagIcon className="w-3.5 h-3.5" />
                          <span>ACQUIRE</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-4 text-xs font-semibold tracking-widest uppercase">
          <button
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-4 py-2 border border-neutral-300 hover:border-black disabled:border-neutral-200 disabled:text-neutral-300 cursor-pointer"
          >
            ← PREVIOUS
          </button>
          <span className="text-neutral-500">
            PAGE {page} OF {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-4 py-2 border border-neutral-300 hover:border-black disabled:border-neutral-200 disabled:text-neutral-300 cursor-pointer"
          >
            NEXT →
          </button>
        </div>
      )}

      {/* Floating View Cart Banner if customer wants to navigate to cart */}
      <div className="mt-16 p-6 bg-[#f4f2ee] border border-neutral-300/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-neutral-900">
            MULTI-VENDOR UNIFIED SHOPPING CART
          </p>
          <p className="text-xs text-neutral-600 font-light">
            Acquire pieces across different approved ateliers with server-managed inventory and atomic order processing.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToCart}
          className="bg-black text-white px-6 py-3 text-[10px] font-semibold tracking-[0.18em] uppercase hover:bg-neutral-800 transition-colors cursor-pointer rounded-none whitespace-nowrap"
        >
          VIEW CART & CHECKOUT →
        </button>
      </div>

      {/* Product Detail Modal */}
      {selectedProductId && (
        <ProductDetailModal
          productId={selectedProductId}
          onClose={() => setSelectedProductId(null)}
          onNavigateToAuth={onNavigateToAuth}
          onNavigateToCart={onNavigateToCart}
        />
      )}
    </div>
  );
};

export default CatalogView;
