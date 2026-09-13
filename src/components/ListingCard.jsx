import { Link } from 'react-router-dom';

import {
  Bed,
  Bath,
  Maximize2,
  MapPin,
} from 'lucide-react';

import {
  formatPrice,
  formatArea,
  formatPricePerSqft,
  formatRelative,
  titleCase,
} from '../utils/formatters.js';

const TAG_STYLES = {
  gray: 'bg-gray-100 text-gray-600',
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-600',
};

function Tag({
  children,
  variant = 'gray',
}) {
  return (
    <span
      className={[
        'rounded px-2 py-0.5 text-xs font-medium',
        TAG_STYLES[variant] ||
          TAG_STYLES.gray,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

function hasValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== ''
  );
}

function finiteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function normalizeBoolean(
  value,
  fallback = null
) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized =
      value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return fallback;
}

export default function ListingCard({
  listing,
}) {
  if (
    !listing ||
    !hasValue(listing.listing_id)
  ) {
    return null;
  }

  const listingId =
    String(listing.listing_id).trim();

  if (!listingId) {
    return null;
  }

  const apartmentName =
    hasValue(listing.apartment_name)
      ? String(
          listing.apartment_name
        ).trim()
      : 'Property';

  const locality =
    hasValue(listing.locality)
      ? titleCase(
          listing.locality
        )
      : 'Location unavailable';

  const bedroom =
    finiteNumber(listing.bedroom);

  const bathroom =
    finiteNumber(listing.bathroom);

  const carpetArea =
    finiteNumber(
      listing.carpet_area
    );

  const floor =
    finiteNumber(listing.floor);

  const totalFloors =
    finiteNumber(
      listing.total_floors
    );

  const price =
    finiteNumber(listing.price);

  const liveStatus =
    normalizeBoolean(
      listing.is_live
    );

  const isLive =
    liveStatus === true;

  const isInactive =
    liveStatus === false;

  const isVerified =
    normalizeBoolean(
      listing.is_verified,
      false
    ) === true;

  const hasFloorInfo =
    floor !== null &&
    totalFloors !== null;

  const hasPrice =
    price !== null;

  const hasCarpetArea =
    carpetArea !== null &&
    carpetArea > 0;

  const pricePerSqft =
    hasPrice &&
    hasCarpetArea
      ? formatPricePerSqft(
          price,
          carpetArea
        )
      : null;

  const href =
    `/listings/${encodeURIComponent(
      listingId
    )}`;

  return (
    <Link
      to={href}
      aria-label={`View ${apartmentName}`}
      className={[
        'group block overflow-hidden rounded-xl border bg-white',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2',
        'hover:-translate-y-0.5 hover:shadow-md',
        isInactive
          ? 'border-gray-100 opacity-70'
          : 'border-gray-200',
      ].join(' ')}
    >
      <div
        className={[
          'h-1',
          isLive
            ? 'bg-emerald-400'
            : isInactive
              ? 'bg-gray-300'
              : 'bg-amber-300',
        ].join(' ')}
        aria-hidden="true"
      />

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-semibold leading-tight text-navy-900"
              title={apartmentName}
            >
              {apartmentName}
            </p>

            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-gray-500">
              <MapPin
                size={11}
                className="shrink-0"
                aria-hidden="true"
              />

              <span className="truncate">
                {locality}
              </span>

              {hasFloorInfo && (
                <span className="shrink-0">
                  · Floor {floor}/{totalFloors}
                </span>
              )}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            {isVerified && (
              <Tag variant="green">
                Verified
              </Tag>
            )}

            {isInactive && (
              <Tag variant="red">
                Inactive
              </Tag>
            )}

            {liveStatus === null && (
              <Tag variant="gray">
                Status unknown
              </Tag>
            )}
          </div>
        </div>

        <div className="my-3">
          {hasPrice ? (
            <>
              <p className="break-words text-2xl font-bold leading-none tabular-nums text-navy-900">
                {formatPrice(price)}
              </p>

              {pricePerSqft && (
                <p className="mt-1 text-xs text-gray-400">
                  {pricePerSqft}
                </p>
              )}
            </>
          ) : (
            <p className="text-lg font-semibold text-gray-400">
              Price unavailable
            </p>
          )}
        </div>

        <div className="flex min-h-[34px] flex-wrap items-center gap-x-3 gap-y-2 border-t border-gray-100 pt-3 text-xs text-gray-600">
          {bedroom !== null && (
            <span className="flex items-center gap-1">
              <Bed
                size={12}
                className="shrink-0 text-gray-400"
                aria-hidden="true"
              />

              <span>
                {bedroom} bed
              </span>
            </span>
          )}

          {bathroom !== null && (
            <span className="flex items-center gap-1">
              <Bath
                size={12}
                className="shrink-0 text-gray-400"
                aria-hidden="true"
              />

              <span>
                {bathroom} bath
              </span>
            </span>
          )}

          {carpetArea !== null &&
            carpetArea > 0 && (
              <span className="flex items-center gap-1">
                <Maximize2
                  size={12}
                  className="shrink-0 text-gray-400"
                  aria-hidden="true"
                />

                <span>
                  {formatArea(
                    carpetArea
                  )}
                </span>
              </span>
            )}

          {bedroom === null &&
            bathroom === null &&
            carpetArea === null && (
              <span className="text-gray-400">
                Property details unavailable
              </span>
            )}
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-1">
            {hasValue(
              listing.property_type
            ) && (
              <Tag variant="blue">
                {titleCase(
                  listing.property_type
                )}
              </Tag>
            )}

            {hasValue(
              listing.furnishing
            ) && (
              <Tag>
                {titleCase(
                  listing.furnishing
                )}
              </Tag>
            )}

            {hasValue(
              listing.posted_by
            ) && (
              <Tag>
                {titleCase(
                  listing.posted_by
                )}
              </Tag>
            )}
          </div>

          {hasValue(
            listing.posted_at
          ) && (
            <span className="shrink-0 text-xs text-gray-400">
              {formatRelative(
                listing.posted_at
              )}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}