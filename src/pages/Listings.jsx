import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useSearchParams } from 'react-router-dom';

import {
  Grid2X2,
  List,
  SlidersHorizontal,
} from 'lucide-react';

import {
  fetchAll,
  getListings,
} from '../api/client.js';

import ListingCard from '../components/ListingCard.jsx';
import FilterPanel from '../components/FilterPanel.jsx';
import Pagination from '../components/Pagination.jsx';

const PAGE_SIZE = 20;

const DEFAULT_LOCALITY =
  'Golf Course Road';

const DEFAULT_SORT =
  'posted_at';

const DEFAULT_ORDER =
  'desc';

const DEFAULT_VIEW =
  'grid';

const VALID_SORTS = new Set([
  'posted_at',
  'price',
  'carpet_area',
]);

const VALID_ORDERS = new Set([
  'asc',
  'desc',
]);

function toPositiveInt(
  value,
  fallback = 1
) {
  const parsed =
    Number.parseInt(
      value,
      10
    );

  return Number.isInteger(
    parsed
  ) && parsed > 0
    ? parsed
    : fallback;
}

function normalizeString(value) {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function normalizeText(value) {
  return normalizeString(
    value
  ).toLowerCase();
}

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function Skeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-4 h-1 rounded-t-full bg-gray-200" />

      <div className="mb-2 h-4 w-3/4 rounded bg-gray-200" />

      <div className="mb-4 h-3 w-1/2 rounded bg-gray-100" />

      <div className="mb-1 h-7 w-1/2 rounded bg-gray-200" />

      <div className="mb-4 h-3 w-1/3 rounded bg-gray-100" />

      <div className="mt-3 flex gap-3 border-t pt-3">
        <div className="h-3 w-16 rounded bg-gray-100" />
        <div className="h-3 w-16 rounded bg-gray-100" />
        <div className="h-3 w-20 rounded bg-gray-100" />
      </div>
    </div>
  );
}

function EmptyState({
  hasFilters,
  onReset,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-20 text-center">
      <p className="text-lg font-semibold text-gray-600">
        No listings found
      </p>

      <p className="mt-1 text-sm text-gray-400">
        {hasFilters
          ? 'Try changing or clearing your filters.'
          : 'There are currently no listings to display.'}
      </p>

      {hasFilters && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-red-700"
    >
      <p className="font-medium">
        Could not load listings
      </p>

      <p className="mt-1 text-sm">
        {message}
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
      >
        Try again
      </button>
    </div>
  );
}

function matchesFilters(
  listing,
  filters
) {
  const requestedLocality =
    normalizeText(
      filters.locality
    );

  if (
    requestedLocality &&
    normalizeText(
      listing.locality
    ) !== requestedLocality
  ) {
    return false;
  }

  const requestedBhk =
    normalizeText(
      filters.bhk
    );

  const bedroom =
    toNumber(
      listing.bedroom
    );

  if (requestedBhk === '5+') {
    if (
      bedroom === null ||
      bedroom < 5
    ) {
      return false;
    }
  } else if (
    requestedBhk
  ) {
    if (
      bedroom === null ||
      bedroom !==
        Number(requestedBhk)
    ) {
      return false;
    }
  }

  const requestedMinPrice =
    normalizeText(
      filters.min_price
    );

  if (requestedMinPrice) {
    const minPrice =
      Number(
        requestedMinPrice
      );

    const price =
      toNumber(
        listing.price
      );

    if (
      !Number.isFinite(
        minPrice
      ) ||
      price === null ||
      price < minPrice
    ) {
      return false;
    }
  }

  const requestedMaxPrice =
    normalizeText(
      filters.max_price
    );

  if (requestedMaxPrice) {
    const maxPrice =
      Number(
        requestedMaxPrice
      );

    const price =
      toNumber(
        listing.price
      );

    if (
      !Number.isFinite(
        maxPrice
      ) ||
      price === null ||
      price > maxPrice
    ) {
      return false;
    }
  }

  const requestedFurnishing =
    normalizeText(
      filters.furnishing
    );

  if (
    requestedFurnishing &&
    normalizeText(
      listing.furnishing
    ) !== requestedFurnishing
  ) {
    return false;
  }

  const requestedPropertyType =
    normalizeText(
      filters.property_type
    );

  if (
    requestedPropertyType &&
    normalizeText(
      listing.property_type
    ) !== requestedPropertyType
  ) {
    return false;
  }

  return true;
}

function compareValues(
  first,
  second,
  sortBy
) {
  if (
    sortBy === 'posted_at'
  ) {
    const firstTime =
      Date.parse(
        first?.posted_at
      );

    const secondTime =
      Date.parse(
        second?.posted_at
      );

    const safeFirst =
      Number.isFinite(
        firstTime
      )
        ? firstTime
        : 0;

    const safeSecond =
      Number.isFinite(
        secondTime
      )
        ? secondTime
        : 0;

    return (
      safeFirst -
      safeSecond
    );
  }

  const field =
    sortBy === 'price'
      ? 'price'
      : 'carpet_area';

  const firstValue =
    toNumber(
      first?.[field]
    );

  const secondValue =
    toNumber(
      second?.[field]
    );

  if (
    firstValue === null &&
    secondValue === null
  ) {
    return 0;
  }

  if (
    firstValue === null
  ) {
    return 1;
  }

  if (
    secondValue === null
  ) {
    return -1;
  }

  return (
    firstValue -
    secondValue
  );
}

export default function Listings() {
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const [listings, setListings] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [
    showFilters,
    setShowFilters,
  ] = useState(false);

  const [view, setView] =
    useState(() => {
      try {
        const stored =
          localStorage.getItem(
            'ivy_listings_view'
          );

        return stored === 'list'
          ? 'list'
          : DEFAULT_VIEW;
      } catch {
        return DEFAULT_VIEW;
      }
    });

  const [retryKey, setRetryKey] =
    useState(0);

  const filters = useMemo(() => {
    const requestedSort =
      normalizeString(
        searchParams.get(
          'sort_by'
        )
      );

    const requestedOrder =
      normalizeString(
        searchParams.get(
          'order'
        )
      );

    return {
      page: toPositiveInt(
        searchParams.get(
          'page'
        ),
        1
      ),

      locality:
        searchParams.has(
          'locality'
        )
          ? normalizeString(
              searchParams.get(
                'locality'
              )
            )
          : DEFAULT_LOCALITY,

      bhk: normalizeString(
        searchParams.get(
          'bhk'
        )
      ),

      min_price:
        normalizeString(
          searchParams.get(
            'min_price'
          )
        ),

      max_price:
        normalizeString(
          searchParams.get(
            'max_price'
          )
        ),

      furnishing:
        normalizeString(
          searchParams.get(
            'furnishing'
          )
        ),

      property_type:
        normalizeString(
          searchParams.get(
            'property_type'
          )
        ),

      sort_by:
        VALID_SORTS.has(
          requestedSort
        )
          ? requestedSort
          : DEFAULT_SORT,

      order:
        VALID_ORDERS.has(
          requestedOrder
        )
          ? requestedOrder
          : DEFAULT_ORDER,
    };
  }, [searchParams]);

  const hasFilters = Boolean(
    normalizeText(
      filters.locality
    ) !==
      normalizeText(
        DEFAULT_LOCALITY
      ) ||
      filters.bhk ||
      filters.min_price ||
      filters.max_price ||
      filters.furnishing ||
      filters.property_type
  );

  const updateFilters =
    useCallback(
      (updates = {}) => {
        const filterKeys = [
          'locality',
          'bhk',
          'min_price',
          'max_price',
          'furnishing',
          'property_type',
          'sort_by',
          'order',
        ];

        const hasFilterChange =
          Object.keys(
            updates
          ).some((key) =>
            filterKeys.includes(
              key
            )
          );

        const merged = {
          ...filters,
          ...updates,
        };

        if (
          hasFilterChange
        ) {
          merged.page = 1;
        }

        const nextParams =
          {};

        Object.entries(
          merged
        ).forEach(
          ([key, value]) => {
            if (
              value === '' ||
              value === null ||
              value === undefined
            ) {
              return;
            }

            if (
              key === 'page' &&
              String(value) ===
                '1'
            ) {
              return;
            }

            if (
              key === 'locality' &&
              normalizeText(
                value
              ) ===
                normalizeText(
                  DEFAULT_LOCALITY
                )
            ) {
              return;
            }

            if (
              key === 'sort_by' &&
              value ===
                DEFAULT_SORT
            ) {
              return;
            }

            if (
              key === 'order' &&
              value ===
                DEFAULT_ORDER
            ) {
              return;
            }

            nextParams[key] =
              String(value);
          }
        );

        setSearchParams(
          nextParams,
          {
            replace: true,
          }
        );
      },
      [
        filters,
        setSearchParams,
      ]
    );

  const resetFilters =
    useCallback(() => {
      setSearchParams(
        {},
        {
          replace: true,
        }
      );
    }, [setSearchParams]);

  const changeView =
    useCallback(
      (nextView) => {
        if (
          nextView !== 'grid' &&
          nextView !== 'list'
        ) {
          return;
        }

        setView(nextView);

        try {
          localStorage.setItem(
            'ivy_listings_view',
            nextView
          );
        } catch {
          // Ignore unavailable localStorage.
        }
      },
      []
    );

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadListings() {
      setLoading(true);
      setError('');

      try {
        const response =
          await fetchAll(
            ({
              offset,
              limit,
              signal,
            }) =>
              getListings(
                {
                  offset,
                  limit,
                },
                {
                  signal,
                }
              ),
            {
              pageSize: 50,
              signal:
                controller.signal,
              label: 'listings',
            }
          );

        if (
          !response ||
          !Array.isArray(
            response.results
          )
        ) {
          throw new Error(
            'Invalid listings response from the API.'
          );
        }

        setListings(
          response.results
        );
      } catch (err) {
        if (
          err?.name ===
          'AbortError'
        ) {
          return;
        }

        setListings([]);

        setError(
          err?.message ||
            'Could not load listings.'
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    }

    loadListings();

    return () => {
      controller.abort();
    };
  }, [retryKey]);

  const filteredListings =
    useMemo(() => {
      const result =
        listings.filter(
          (listing) =>
            matchesFilters(
              listing,
              filters
            )
        );

      result.sort(
        (first, second) => {
          const comparison =
            compareValues(
              first,
              second,
              filters.sort_by
            );

          return filters.order ===
            'asc'
            ? comparison
            : -comparison;
        }
      );

      return result;
    }, [
      listings,
      filters,
    ]);

  const total =
    filteredListings.length;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total / PAGE_SIZE
      )
    );

  const safePage =
    Math.min(
      filters.page,
      totalPages
    );

  const paginatedListings =
    useMemo(() => {
      const start =
        (safePage - 1) *
        PAGE_SIZE;

      return filteredListings.slice(
        start,
        start + PAGE_SIZE
      );
    }, [
      filteredListings,
      safePage,
    ]);

  useEffect(() => {
    if (
      !loading &&
      filters.page !== safePage
    ) {
      updateFilters({
        page: safePage,
      });
    }
  }, [
    loading,
    filters.page,
    safePage,
    updateFilters,
  ]);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, [safePage]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">
            Sale Listings
          </h1>

          {!loading && (
            <p className="mt-0.5 text-sm text-gray-500">
              {total.toLocaleString(
                'en-IN'
              )}{' '}
              properties found
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div
            className="hidden items-center rounded-lg border border-gray-200 bg-white p-1 sm:flex"
            role="group"
            aria-label="Listing view"
          >
            <button
              type="button"
              onClick={() =>
                changeView(
                  'grid'
                )
              }
              aria-label="Grid view"
              aria-pressed={
                view === 'grid'
              }
              className={[
                'rounded-md p-1.5 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-emerald-400',
                view === 'grid'
                  ? 'bg-navy-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100',
              ].join(' ')}
            >
              <Grid2X2
                size={16}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={() =>
                changeView(
                  'list'
                )
              }
              aria-label="List view"
              aria-pressed={
                view === 'list'
              }
              className={[
                'rounded-md p-1.5 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-emerald-400',
                view === 'list'
                  ? 'bg-navy-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100',
              ].join(' ')}
            >
              <List
                size={16}
                aria-hidden="true"
              />
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowFilters(
                (current) =>
                  !current
              )
            }
            aria-expanded={
              showFilters
            }
            aria-controls="listing-filters"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 md:hidden"
          >
            <SlidersHorizontal
              size={14}
              aria-hidden="true"
            />

            Filters
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        <aside
          id="listing-filters"
          className={[
            'w-full shrink-0 md:block md:w-64',
            showFilters
              ? 'block'
              : 'hidden',
          ].join(' ')}
        >
          <FilterPanel
            filters={filters}
            onChange={
              updateFilters
            }
            onReset={
              resetFilters
            }
            className="md:sticky md:top-20"
          />
        </aside>

        <section
          className="min-w-0 flex-1"
          aria-live="polite"
        >
          {loading ? (
            <div
              className={
                view === 'grid'
                  ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'
                  : 'space-y-4'
              }
            >
              {Array.from({
                length: 9,
              }).map(
                (_, index) => (
                  <Skeleton
                    key={index}
                  />
                )
              )}
            </div>
          ) : error ? (
            <ErrorState
              message={error}
              onRetry={() =>
                setRetryKey(
                  (value) =>
                    value + 1
                )
              }
            />
          ) : paginatedListings.length >
            0 ? (
            <>
              <div
                className={
                  view === 'grid'
                    ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'
                    : 'space-y-4'
                }
              >
                {paginatedListings.map(
                  (listing) => {
                    const listingId =
                      listing?.listing_id;

                    if (
                      listingId ===
                        undefined ||
                      listingId ===
                        null
                    ) {
                      return null;
                    }

                    return (
                      <ListingCard
                        key={String(
                          listingId
                        )}
                        listing={
                          listing
                        }
                      />
                    );
                  }
                )}
              </div>

              {total > PAGE_SIZE && (
                <Pagination
                  page={safePage}
                  total={total}
                  pageSize={
                    PAGE_SIZE
                  }
                  onChange={(
                    nextPage
                  ) => {
                    updateFilters(
                      {
                        page: nextPage,
                      }
                    );
                  }}
                />
              )}
            </>
          ) : (
            <EmptyState
              hasFilters={
                hasFilters
              }
              onReset={
                resetFilters
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}