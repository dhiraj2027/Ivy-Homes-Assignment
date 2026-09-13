import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  Filter,
  MapPin,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

import { fetchAll, getRentals } from '../api/client.js';
import RentalCard from '../components/RentalCard.jsx';
import Pagination from '../components/Pagination.jsx';

const PAGE_SIZE = 20;
const DEFAULT_LOCALITY = 'Golf Course Road';

const BHK_OPTIONS = [
  { value: '', label: 'All BHK' },
  { value: '1', label: '1 BHK' },
  { value: '2', label: '2 BHK' },
  { value: '3', label: '3 BHK' },
  { value: '4', label: '4 BHK' },
];

const FURNISHING_OPTIONS = [
  { value: '', label: 'All furnishing' },
  { value: 'fully furnished', label: 'Fully furnished' },
  { value: 'semi furnished', label: 'Semi furnished' },
  { value: 'unfurnished', label: 'Unfurnished' },
];

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function parsePage(value) {
  const page = Number(value);

  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}

function parseBhk(value) {
  const bhk = Number(value);

  if (!Number.isInteger(bhk) || bhk < 1) {
    return '';
  }

  return String(bhk);
}

function getInitialFilters(searchParams) {
  const localityParam = searchParams.get('locality');

  return {
    locality:
      localityParam === null
        ? DEFAULT_LOCALITY
        : localityParam,
    bhk: parseBhk(searchParams.get('bhk')),
    furnishing:
      searchParams.get('furnishing') || '',
  };
}

function getPage(searchParams) {
  return parsePage(searchParams.get('page'));
}

function matchesLocality(rental, locality) {
  const requested = normalizeText(locality);

  if (!requested) {
    return true;
  }

  return normalizeText(rental.locality) === requested;
}

function matchesBhk(rental, bhk) {
  if (!bhk) {
    return true;
  }

  return Number(rental.bedroom) === Number(bhk);
}

function matchesFurnishing(rental, furnishing) {
  if (!furnishing) {
    return true;
  }

  return (
    normalizeText(rental.furnishing) ===
    normalizeText(furnishing)
  );
}

function EmptyState({ hasFilters, onClear }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <Building2 className="h-6 w-6 text-gray-400" />
      </div>

      <h2 className="mt-4 text-lg font-semibold text-gray-900">
        No rentals found
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
        {hasFilters
          ? 'Try changing your filters to see more rental properties.'
          : 'There are no rental properties available.'}
      </p>

      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          <X className="h-4 w-4" />
          Reset filters
        </button>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-72 animate-pulse rounded-2xl border border-gray-200 bg-white"
        />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <RefreshCw className="h-6 w-6 text-red-500" />
      </div>

      <h2 className="mt-4 text-lg font-semibold text-gray-900">
        Unable to load rentals
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
        {message || 'Something went wrong while loading rentals.'}
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}

export default function Rentals() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState(() =>
    getInitialFilters(searchParams)
  );

  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const page = getPage(searchParams);

  useEffect(() => {
    const nextFilters = getInitialFilters(searchParams);

    setFilters((current) => {
      if (
        current.locality === nextFilters.locality &&
        current.bhk === nextFilters.bhk &&
        current.furnishing === nextFilters.furnishing
      ) {
        return current;
      }

      return nextFilters;
    });
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRentals() {
      setLoading(true);
      setError('');

      try {
        const response = await fetchAll(
          ({ offset, limit, signal }) =>
            getRentals(
              {
                offset,
                limit,
              },
              { signal }
            ),
          {
            pageSize: 50,
            signal: controller.signal,
            label: 'rentals',
          }
        );

        setRentals(
          Array.isArray(response?.results)
            ? response.results
            : []
        );
      } catch (err) {
        if (err?.name === 'AbortError') {
          return;
        }

        setError(
          err?.message || 'Failed to load rentals.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadRentals();

    return () => {
      controller.abort();
    };
  }, [retryKey]);

  const filteredRentals = useMemo(() => {
    return rentals.filter((rental) => {
      return (
        matchesLocality(
          rental,
          filters.locality
        ) &&
        matchesBhk(
          rental,
          filters.bhk
        ) &&
        matchesFurnishing(
          rental,
          filters.furnishing
        )
      );
    });
  }, [rentals, filters]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRentals.length / PAGE_SIZE)
  );

  const safePage = Math.min(
    page,
    totalPages
  );

  const paginatedRentals = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;

    return filteredRentals.slice(
      start,
      start + PAGE_SIZE
    );
  }, [filteredRentals, safePage]);

  const hasOptionalFilters =
    Boolean(filters.bhk) ||
    Boolean(filters.furnishing) ||
    normalizeText(filters.locality) !==
      normalizeText(DEFAULT_LOCALITY);

  function updateFilters(nextValues) {
    const nextFilters = {
      ...filters,
      ...nextValues,
    };

    setFilters(nextFilters);

    const nextParams = new URLSearchParams();

    if (
      normalizeText(nextFilters.locality)
    ) {
      nextParams.set(
        'locality',
        nextFilters.locality
      );
    }

    if (nextFilters.bhk) {
      nextParams.set(
        'bhk',
        nextFilters.bhk
      );
    }

    if (nextFilters.furnishing) {
      nextParams.set(
        'furnishing',
        nextFilters.furnishing
      );
    }

    setSearchParams(nextParams, {
      replace: true,
    });
  }

  function handleLocalityChange(event) {
    updateFilters({
      locality: event.target.value,
    });
  }

  function handleBhkChange(event) {
    updateFilters({
      bhk: event.target.value,
    });
  }

  function handleFurnishingChange(event) {
    updateFilters({
      furnishing: event.target.value,
    });
  }

  function clearFilters() {
    const defaultFilters = {
      locality: DEFAULT_LOCALITY,
      bhk: '',
      furnishing: '',
    };

    setFilters(defaultFilters);

    const nextParams = new URLSearchParams();

    nextParams.set(
      'locality',
      DEFAULT_LOCALITY
    );

    setSearchParams(nextParams, {
      replace: true,
    });
  }

  function handlePageChange(nextPage) {
    const requestedPage = parsePage(nextPage);

    const nextParams = new URLSearchParams(
      searchParams
    );

    if (requestedPage <= 1) {
      nextParams.delete('page');
    } else {
      nextParams.set(
        'page',
        String(requestedPage)
      );
    }

    setSearchParams(nextParams, {
      replace: true,
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  useEffect(() => {
    if (
      !loading &&
      page !== safePage
    ) {
      const nextParams = new URLSearchParams(
        searchParams
      );

      if (safePage <= 1) {
        nextParams.delete('page');
      } else {
        nextParams.set(
          'page',
          String(safePage)
        );
      }

      setSearchParams(nextParams, {
        replace: true,
      });
    }
  }, [
    loading,
    page,
    safePage,
    searchParams,
    setSearchParams,
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <MapPin className="h-4 w-4" />
            Gurgaon
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Rentals
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Browse rental properties with client-side filtering and pagination.
          </p>
        </div>

        <Link
          to="/listings"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Browse sale listings →
        </Link>
      </div>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-800">
              Filters
            </h2>
          </div>

          {hasOptionalFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Reset
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="relative block">
            <span className="mb-1.5 block text-xs font-medium text-gray-500">
              Locality
            </span>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                value={filters.locality}
                onChange={handleLocalityChange}
                placeholder="Golf Course Road"
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-800 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-gray-500">
              Bedrooms
            </span>

            <div className="relative">
              <select
                value={filters.bhk}
                onChange={handleBhkChange}
                className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 pr-9 text-sm text-gray-800 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              >
                {BHK_OPTIONS.map((option) => (
                  <option
                    key={option.value || 'all'}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-gray-500">
              Furnishing
            </span>

            <div className="relative">
              <select
                value={filters.furnishing}
                onChange={handleFurnishingChange}
                className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 pr-9 text-sm text-gray-800 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              >
                {FURNISHING_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value || 'all'}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  )
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </label>
        </div>
      </section>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() =>
            setRetryKey(
              (value) => value + 1
            )
          }
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              Showing{' '}
              <span className="font-medium text-gray-800">
                {filteredRentals.length}
              </span>{' '}
              matching rentals
            </p>

            {filteredRentals.length > 0 && (
              <p className="text-sm text-gray-400">
                Page {safePage} of {totalPages}
              </p>
            )}
          </div>

          {paginatedRentals.length === 0 ? (
            <EmptyState
              hasFilters={hasOptionalFilters}
              onClear={clearFilters}
            />
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {paginatedRentals.map(
                  (rental) => {
                    const id =
                      rental.listing_id ??
                      rental.rental_id ??
                      rental.id;

                    return (
                      <RentalCard
                        key={String(id)}
                        rental={rental}
                      />
                    );
                  }
                )}
              </div>

              {filteredRentals.length >
                PAGE_SIZE && (
                <div className="mt-8 flex justify-center">
                  <Pagination
                    page={safePage}
                    total={filteredRentals.length}
                    pageSize={PAGE_SIZE}
                    onChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}