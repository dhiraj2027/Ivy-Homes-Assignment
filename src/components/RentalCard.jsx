import { Link } from 'react-router-dom';
import {
  Bed,
  Bath,
  Maximize2,
  MapPin,
} from 'lucide-react';

import {
  formatRent,
  formatPrice,
  formatArea,
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

function isValidNonNegativeNumber(value) {
  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= 0
  );
}

function isValidCount(value) {
  const number = Number(value);

  return (
    Number.isInteger(number) &&
    number >= 0
  );
}

function Tag({ children }) {
  return (
    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      {children}
    </span>
  );
}

function formatFloor(floor, totalFloors) {
  if (
    !isValidNonNegativeNumber(floor) ||
    !isValidNonNegativeNumber(totalFloors)
  ) {
    return '';
  }

  /*
   * A total floor count of zero is legitimate for some
   * property records, so don't fabricate a floor label.
   */
  if (Number(totalFloors) === 0) {
    return '';
  }

  return ` · Floor ${Number(floor)}/${Number(
    totalFloors
  )}`;
}

export default function RentalCard({ rental }) {
  const listingId = normalizeText(
    rental?.listing_id
  );

  if (!listingId) {
    return null;
  }

  const apartmentName = normalizeText(
    rental?.apartment_name
  );

  const locality = normalizeText(
    rental?.locality
  );

  const propertyType = normalizeText(
    rental?.property_type
  );

  const furnishing = normalizeText(
    rental?.furnishing
  );

  const postedBy = normalizeText(
    rental?.posted_by
  );

  const bedroom = rental?.bedroom;
  const bathroom = rental?.bathroom;
  const carpetArea = rental?.carpet_area;
  const price = rental?.price;
  const deposit = rental?.deposit;
  const maintenance = rental?.maintenance;
  const floor = rental?.floor;
  const totalFloors = rental?.total_floors;
  const postedAt = rental?.posted_at;

  const validRent =
    isValidPositiveNumber(price);

  const validDeposit =
    isValidNonNegativeNumber(deposit);

  const validMaintenance =
    isValidNonNegativeNumber(maintenance);

  const validBedroom =
    isValidCount(bedroom);

  const validBathroom =
    isValidCount(bathroom);

  const validArea =
    isValidPositiveNumber(carpetArea);

  const floorLabel = formatFloor(
    floor,
    totalFloors
  );

  const listingPath =
    `/rentals/${encodeURIComponent(listingId)}`;

  return (
    <Link
      to={listingPath}
      aria-label={`View rental ${
        apartmentName || 'property'
      }`}
      className="group block rounded-xl border border-gray-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <div
        className="h-1 rounded-t-xl bg-blue-400"
        aria-hidden="true"
      />

      <div className="p-4">
        {/* Header */}
        <div className="mb-2">
          <p className="truncate text-sm font-semibold text-navy-900">
            {apartmentName || 'Rental property'}
          </p>

          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-gray-500">
            <MapPin
              size={11}
              className="shrink-0"
              aria-hidden="true"
            />

            <span className="truncate">
              {locality
                ? titleCase(locality)
                : 'Location unavailable'}
            </span>

            {floorLabel && (
              <span className="shrink-0">
                {floorLabel}
              </span>
            )}
          </p>
        </div>

        {/* Rent */}
        <div className="my-3">
          <p className="tabular-nums text-2xl font-bold leading-none text-navy-900">
            {validRent
              ? formatRent(price)
              : 'Rent unavailable'}
          </p>

          {(validDeposit ||
            validMaintenance) && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
              {validDeposit && (
                <span>
                  Deposit:{' '}
                  {formatPrice(deposit)}
                </span>
              )}

              {validMaintenance && (
                <span>
                  Maint:{' '}
                  {formatRent(maintenance)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        {(validBedroom ||
          validBathroom ||
          validArea) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-gray-100 pt-3 text-xs text-gray-600">
            {validBedroom && (
              <span className="flex items-center gap-1">
                <Bed
                  size={12}
                  className="text-gray-400"
                  aria-hidden="true"
                />

                {Number(bedroom)}{' '}
                {Number(bedroom) === 1
                  ? 'bed'
                  : 'beds'}
              </span>
            )}

            {validBathroom && (
              <span className="flex items-center gap-1">
                <Bath
                  size={12}
                  className="text-gray-400"
                  aria-hidden="true"
                />

                {Number(bathroom)}{' '}
                {Number(bathroom) === 1
                  ? 'bath'
                  : 'baths'}
              </span>
            )}

            {validArea && (
              <span className="flex items-center gap-1">
                <Maximize2
                  size={12}
                  className="text-gray-400"
                  aria-hidden="true"
                />

                {formatArea(carpetArea)}
              </span>
            )}
          </div>
        )}

        {/* Metadata */}
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {hasText(propertyType) && (
              <Tag>
                {titleCase(propertyType)}
              </Tag>
            )}

            {hasText(furnishing) && (
              <Tag>
                {titleCase(furnishing)}
              </Tag>
            )}

            {hasText(postedBy) && (
              <Tag>
                {titleCase(postedBy)}
              </Tag>
            )}
          </div>

          {hasText(postedAt) && (
            <span className="shrink-0 text-xs text-gray-400">
              {formatRelative(postedAt)}
            </span>
          )}
        </div>

        {/* Debug/reference identifier */}
        <p className="mt-2 truncate font-mono text-[10px] text-gray-300">
          {listingId}
        </p>
      </div>
    </Link>
  );
}