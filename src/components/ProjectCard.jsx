import { Link } from 'react-router-dom';
import {
  Building2,
  MapPin,
  CalendarDays,
  Home,
} from 'lucide-react';

import {
  formatPrice,
  formatArea,
  formatDate,
  titleCase,
} from '../utils/formatters.js';

const STATUS_STYLES = {
  'ready to move':
    'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'under construction':
    'bg-amber-50 text-amber-700 ring-amber-200',
  'new launch':
    'bg-blue-50 text-blue-700 ring-blue-200',
};

function normalizeText(value) {
  return String(value ?? '').trim();
}

function isValidPositiveNumber(value) {
  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number > 0
  );
}

function isValidNonNegativeInteger(value) {
  const number = Number(value);

  return (
    Number.isInteger(number) &&
    number >= 0
  );
}

function formatPriceRange(
  priceMin,
  priceMax
) {
  const minValid =
    isValidPositiveNumber(priceMin);

  const maxValid =
    isValidPositiveNumber(priceMax);

  if (!minValid && !maxValid) {
    return 'Price unavailable';
  }

  if (minValid && !maxValid) {
    return formatPrice(priceMin);
  }

  if (!minValid && maxValid) {
    return `Up to ${formatPrice(priceMax)}`;
  }

  const min = Number(priceMin);
  const max = Number(priceMax);

  if (min === max) {
    return formatPrice(min);
  }

  /*
   * The live dataset contains records where
   * price_min > price_max. Avoid rendering an
   * invalid ascending range.
   */
  if (min > max) {
    return `From ${formatPrice(max)}`;
  }

  return `${formatPrice(min)} – ${formatPrice(max)}`;
}

function formatAreaRange(
  minArea,
  maxArea
) {
  const minValid =
    isValidPositiveNumber(minArea);

  const maxValid =
    isValidPositiveNumber(maxArea);

  if (!minValid && !maxValid) {
    return 'Area unavailable';
  }

  if (minValid && !maxValid) {
    return formatArea(minArea);
  }

  if (!minValid && maxValid) {
    return `Up to ${formatArea(maxArea)}`;
  }

  const min = Number(minArea);
  const max = Number(maxArea);

  if (min === max) {
    return formatArea(min);
  }

  if (min > max) {
    return `From ${formatArea(max)}`;
  }

  return `${formatArea(min)} – ${formatArea(max)}`;
}

function getStatusClass(status) {
  return (
    STATUS_STYLES[
      normalizeText(status).toLowerCase()
    ] ||
    'bg-gray-100 text-gray-600 ring-gray-200'
  );
}

function formatCount(value, suffix) {
  if (!isValidNonNegativeInteger(value)) {
    return null;
  }

  return `${Number(value).toLocaleString(
    'en-IN'
  )} ${suffix}${
    Number(value) === 1 ? '' : 's'
  }`;
}

export default function ProjectCard({
  project,
}) {
  const projectId = normalizeText(
    project?.project_id
  );

  if (!projectId) {
    return null;
  }

  const apartmentName = normalizeText(
    project?.apartment_name
  );

  const developerName = normalizeText(
    project?.developer_name
  );

  const locality = normalizeText(
    project?.locality
  );

  const projectStatus = normalizeText(
    project?.project_status
  );

  const possessionDate = normalizeText(
    project?.possession_date
  );

  const priceRange = formatPriceRange(
    project?.price_min,
    project?.price_max
  );

  const areaRange = formatAreaRange(
    project?.min_area_sqft,
    project?.max_area_sqft
  );

  const unitsLabel = formatCount(
    project?.total_units,
    'unit'
  );

  const listingsLabel = formatCount(
    project?.total_listings,
    'listing'
  );

  const safeAmenities = Array.isArray(
    project?.amenities
  )
    ? project.amenities
        .map((amenity) =>
          normalizeText(amenity)
        )
        .filter(Boolean)
    : [];

  const statusClass =
    getStatusClass(projectStatus);

  const projectPath =
    `/projects/${encodeURIComponent(projectId)}`;

  return (
    <Link
      to={projectPath}
      aria-label={`View project ${
        apartmentName || projectId
      }`}
      className="group block rounded-xl border border-gray-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
    >
      <div
        className="h-1 rounded-t-xl bg-amber-400"
        aria-hidden="true"
      />

      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-navy-900">
              {apartmentName || 'Project'}
            </p>

            {developerName && (
              <p className="mt-0.5 truncate text-xs text-gray-500">
                {developerName}
              </p>
            )}
          </div>

          {projectStatus && (
            <span
              className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ring-1 ${statusClass}`}
            >
              {titleCase(projectStatus)}
            </span>
          )}
        </div>

        <p className="mb-3 flex min-w-0 items-center gap-1 text-xs text-gray-500">
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
        </p>

        <div className="my-3">
          <p className="tabular-nums text-lg font-bold text-navy-900">
            {priceRange}
          </p>

          <p className="mt-0.5 text-xs text-gray-400">
            {areaRange}
          </p>

          {isValidPositiveNumber(
            project?.price_min
          ) &&
            isValidPositiveNumber(
              project?.price_max
            ) &&
            Number(project.price_min) >
              Number(project.price_max) && (
              <p className="mt-1 text-[11px] text-amber-600">
                Dataset reports an inverted price range.
              </p>
            )}
        </div>

        {(unitsLabel ||
          listingsLabel ||
          possessionDate) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
            {unitsLabel && (
              <span className="flex items-center gap-1">
                <Home
                  size={12}
                  aria-hidden="true"
                />

                {unitsLabel}
              </span>
            )}

            {listingsLabel && (
              <span className="flex items-center gap-1">
                <Building2
                  size={12}
                  aria-hidden="true"
                />

                {listingsLabel}
              </span>
            )}

            {possessionDate && (
              <span className="flex items-center gap-1">
                <CalendarDays
                  size={12}
                  aria-hidden="true"
                />

                {formatDate(possessionDate)}
              </span>
            )}
          </div>
        )}

        {safeAmenities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {safeAmenities
              .slice(0, 4)
              .map((amenity, index) => (
                <span
                  key={`${amenity}-${index}`}
                  className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  {titleCase(amenity)}
                </span>
              ))}

            {safeAmenities.length > 4 && (
              <span className="px-1 py-0.5 text-xs text-gray-400">
                +
                {safeAmenities.length - 4}{' '}
                more
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}