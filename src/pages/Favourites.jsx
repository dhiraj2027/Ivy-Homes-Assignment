import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ArrowRight,
  Heart,
} from 'lucide-react';
import {
  Link,
} from 'react-router-dom';

import {
  getFavourites,
  removeFavourite,
} from '../api/client.js';

import {
  useAuth,
} from '../context/AuthContext.jsx';

import {
  formatArea,
  formatPrice,
  formatPricePerSqft,
  formatRelative,
  titleCase,
} from '../utils/formatters.js';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function hasText(value) {
  return normalizeText(value).length > 0;
}

function isValidPositiveNumber(value) {
  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number > 0
  );
}

function isValidCount(value) {
  const number = Number(value);

  return (
    Number.isInteger(number) &&
    number >= 0
  );
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value
      .trim()
      .toLowerCase();

    if (
      normalized === 'true' ||
      normalized === '1' ||
      normalized === 'yes'
    ) {
      return true;
    }

    if (
      normalized === 'false' ||
      normalized === '0' ||
      normalized === 'no'
    ) {
      return false;
    }
  }

  /*
   * Missing status is intentionally NOT treated as live.
   * This avoids showing an unknown listing as active.
   */
  return null;
}

function Tag({ children }) {
  return (
    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      {children}
    </span>
  );
}

function FavCard({
  listing,
  onRemove,
  removing,
}) {
  const listingId = normalizeText(
    listing?.listing_id
  );

  if (!listingId) {
    return null;
  }

  const apartmentName = normalizeText(
    listing?.apartment_name
  );

  const locality = normalizeText(
    listing?.locality
  );

  const furnishing = normalizeText(
    listing?.furnishing
  );

  const bedroom = listing?.bedroom;
  const bathroom = listing?.bathroom;
  const carpetArea = listing?.carpet_area;
  const price = listing?.price;
  const postedAt = listing?.posted_at;

  const liveStatus = normalizeBoolean(
    listing?.is_live
  );

  const isLive = liveStatus === true;
  const statusKnown = liveStatus !== null;

  const validPrice =
    isValidPositiveNumber(price);

  const validArea =
    isValidPositiveNumber(carpetArea);

  const validBedroom =
    isValidCount(bedroom);

  const validBathroom =
    isValidCount(bathroom);

  const listingPath =
    `/listings/${encodeURIComponent(
      listingId
    )}`;

  return (
    <article
      className={`rounded-xl border bg-white p-4 transition-all ${
        isLive
          ? 'border-gray-200'
          : 'border-gray-100 opacity-75'
      }`}
    >
      <div
        className={`-mx-4 -mt-4 mb-4 h-1 rounded-t-xl ${
          isLive
            ? 'bg-emerald-400'
            : 'bg-gray-300'
        }`}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3">
        <Link
          to={listingPath}
          className="min-w-0 flex-1 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          <p className="truncate text-sm font-semibold text-navy-900 hover:underline">
            {apartmentName ||
              'Unnamed property'}
          </p>

          <p className="mt-0.5 truncate text-xs text-gray-500">
            {locality
              ? titleCase(locality)
              : 'Locality unavailable'}
          </p>
        </Link>

        <button
          type="button"
          onClick={() =>
            onRemove(listingId)
          }
          disabled={removing}
          aria-label={`Remove ${
            apartmentName || 'listing'
          } from saved listings`}
          title="Remove from saved"
          className="shrink-0 rounded-md p-1 text-red-400 transition-colors hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Heart
            size={18}
            fill="currentColor"
            aria-hidden="true"
          />
        </button>
      </div>

      {!isLive && statusKnown && (
        <p className="mt-2 text-xs text-amber-600">
          This listing is currently inactive.
        </p>
      )}

      {!statusKnown && (
        <p className="mt-2 text-xs text-gray-400">
          Listing status unavailable.
        </p>
      )}

      <Link
        to={listingPath}
        className="mt-1 block rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
      >
        {/* Price */}
        <div className="my-3">
          <p className="tabular-nums text-xl font-bold text-navy-900">
            {validPrice
              ? formatPrice(price)
              : 'Price unavailable'}
          </p>

          {validPrice && validArea && (
            <p className="text-xs text-gray-400">
              {formatPricePerSqft(
                price,
                carpetArea
              )}
            </p>
          )}
        </div>

        {/* Stats */}
        {(validBedroom ||
          validBathroom ||
          validArea ||
          hasText(furnishing)) && (
          <div className="mb-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
            {validBedroom && (
              <span>
                {Number(bedroom)}{' '}
                {Number(bedroom) === 1
                  ? 'bed'
                  : 'beds'}
              </span>
            )}

            {validBathroom && (
              <span>
                {Number(bathroom)}{' '}
                {Number(bathroom) === 1
                  ? 'bath'
                  : 'baths'}
              </span>
            )}

            {validArea && (
              <span>
                {formatArea(carpetArea)}
              </span>
            )}

            {hasText(furnishing) && (
              <Tag>
                {titleCase(furnishing)}
              </Tag>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400">
            {hasText(postedAt)
              ? formatRelative(postedAt)
              : 'Date unavailable'}
          </span>

          <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-blue-600">
            View
            <ArrowRight
              size={12}
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    </article>
  );
}

function Skeleton() {
  return (
    <div
      className="h-48 animate-pulse rounded-xl border border-gray-200 bg-white p-4"
      aria-hidden="true"
    >
      <div className="-mx-4 -mt-4 mb-4 h-1 rounded-t-xl bg-gray-200" />

      <div className="mb-2 h-4 w-3/4 rounded bg-gray-200" />

      <div className="mb-5 h-3 w-1/2 rounded bg-gray-100" />

      <div className="mb-4 h-7 w-1/2 rounded bg-gray-200" />

      <div className="h-3 w-full rounded bg-gray-100" />
    </div>
  );
}

export default function Favourites() {
  const {
    isAuthenticated,
  } = useAuth();

  const [favourites, setFavourites] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [removingId, setRemovingId] =
    useState(null);

  const [refreshing, setRefreshing] =
    useState(false);

  const load = useCallback(
    async ({
      signal,
      showLoading = true,
    } = {}) => {
      if (!isAuthenticated) {
        setFavourites([]);
        setError('');
        setLoading(false);
        return;
      }

      if (showLoading) {
        setLoading(true);
      }

      setError('');

      try {
        const response =
          await getFavourites({
            signal,
          });

        if (signal?.aborted) {
          return;
        }

        if (
          !response ||
          !Array.isArray(
            response.results
          )
        ) {
          throw new Error(
            'Invalid favourites response from the API.'
          );
        }

        setFavourites(response.results);
      } catch (err) {
        if (
          err?.name === 'AbortError' ||
          signal?.aborted
        ) {
          return;
        }

        setFavourites([]);

        setError(
          err?.message ||
            'Could not load saved listings.'
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    const controller =
      new AbortController();

    load({
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [load]);

  const handleRefresh = useCallback(
    async () => {
      if (
        !isAuthenticated ||
        refreshing
      ) {
        return;
      }

      const controller =
        new AbortController();

      setRefreshing(true);
      setError('');

      try {
        await load({
          signal: controller.signal,
          showLoading: false,
        });
      } finally {
        controller.abort();
        setRefreshing(false);
      }
    },
    [
      isAuthenticated,
      refreshing,
      load,
    ]
  );

  const handleRemove = useCallback(
    async (listingId) => {
      const normalizedId =
        normalizeText(listingId);

      if (
        !normalizedId ||
        removingId !== null
      ) {
        return;
      }

      setRemovingId(normalizedId);
      setError('');

      try {
        await removeFavourite(
          normalizedId
        );

        setFavourites((current) =>
          current.filter(
            (listing) =>
              normalizeText(
                listing?.listing_id
              ) !== normalizedId
          )
        );
      } catch (err) {
        setError(
          err?.message ||
            'Could not remove the saved listing.'
        );
      } finally {
        setRemovingId(null);
      }
    },
    [removingId]
  );

  if (!isAuthenticated) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Heart
          size={40}
          className="mx-auto mb-4 text-gray-300"
          aria-hidden="true"
        />

        <h1 className="text-xl font-bold text-gray-700">
          Sign in to see your saved listings
        </h1>

        <p className="mt-2 mb-6 text-sm text-gray-500">
          Your saved properties are tied
          to your account.
        </p>

        <Link
          to="/login"
          className="inline-block rounded-lg bg-navy-900 px-6 py-2.5 font-medium text-white transition-colors hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2"
        >
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-navy-900">
            <Heart
              size={22}
              className="text-red-400"
              fill="currentColor"
              aria-hidden="true"
            />

            Saved listings
          </h1>

          {!loading && (
            <p className="mt-0.5 text-sm text-gray-500">
              {favourites.length}{' '}
              {favourites.length === 1
                ? 'property'
                : 'properties'}{' '}
              saved
            </p>
          )}
        </div>

        {!loading &&
          favourites.length > 0 && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing
                ? 'Refreshing…'
                : 'Refresh'}
            </button>
          )}
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Loading saved listings"
        >
          {Array.from({
            length: 6,
          }).map((_, index) => (
            <Skeleton
              key={index}
            />
          ))}
        </div>
      ) : favourites.length === 0 ? (
        /* Empty state */
        <section className="py-20 text-center">
          <Heart
            size={40}
            className="mx-auto mb-4 text-gray-200"
            aria-hidden="true"
          />

          <h2 className="text-lg font-medium text-gray-500">
            No saved listings yet
          </h2>

          <p className="mt-1 mb-6 text-sm text-gray-400">
            Browse properties and click
            Save to add them here.
          </p>

          <Link
            to="/"
            className="inline-block rounded-lg bg-navy-900 px-6 py-2.5 font-medium text-white transition-colors hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2"
          >
            Browse listings
          </Link>
        </section>
      ) : (
        /* Results */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favourites.map((listing) => {
            const id = normalizeText(
              listing?.listing_id
            );

            if (!id) {
              return null;
            }

            return (
              <FavCard
                key={id}
                listing={listing}
                onRemove={handleRemove}
                removing={
                  removingId === id
                }
              />
            );
          })}
        </div>
      )}
    </main>
  );
}