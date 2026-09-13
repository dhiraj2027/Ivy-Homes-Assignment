import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getListingsByProject, getProject } from '../api/client.js'
import ListingCard from '../components/ListingCard.jsx'
import Pagination from '../components/Pagination.jsx'

import {
  formatArea,
  formatPrice,
  titleCase,
} from '../utils/formatters.js';

const PAGE_SIZE = 20

const STATUS_CLASSES = {
  'under construction': 'bg-amber-50 text-amber-700 ring-amber-200',
  'ready to move': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'new launch': 'bg-blue-50 text-blue-700 ring-blue-200',
};

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase();
}

function getStatusClass(status) {
  return (
    STATUS_CLASSES[normalizeStatus(status)] ||
    'bg-slate-50 text-slate-700 ring-slate-200'
  );
}

function isFiniteNumber(value) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value)
  );
}

function getValidCoordinate(value) {
  if (!isFiniteNumber(value)) {
    return null;
  }

  if (value < -180 || value > 180) {
    return null;
  }

  return value;
}

function getExternalHttpUrl(value) {
  const raw = normalizeText(value);

  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);

    if (
      url.protocol !== 'http:' &&
      url.protocol !== 'https:'
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function getProjectPriceRange(project) {
  const min = project?.price_min;
  const max = project?.price_max;

  const hasMin =
    isFiniteNumber(min) && min > 0;

  const hasMax =
    isFiniteNumber(max) && max > 0;

  if (!hasMin && !hasMax) {
    return 'Price unavailable';
  }

  if (hasMin && !hasMax) {
    return formatPrice(min);
  }

  if (!hasMin && hasMax) {
    return `Up to ${formatPrice(max)}`;
  }

  /*
   * The live dataset contains projects where
   * price_min > price_max. Do not render a misleading
   * "max - min" range in that case.
   */
  if (min > max) {
    return `From ${formatPrice(max)}*`;
  }

  if (min === max) {
    return formatPrice(min);
  }

  return `${formatPrice(min)} – ${formatPrice(max)}`;
}

function getLocation(project) {
  const parts = [
    project?.locality,
    project?.city,
    project?.state,
  ]
    .map(normalizeText)
    .filter(Boolean);

  return parts.length > 0
    ? parts.join(', ')
    : 'Location unavailable';
}

function getAmenities(project) {
  if (!Array.isArray(project?.amenities)) {
    return [];
  }

  return project.amenities
    .map((amenity) => normalizeText(amenity))
    .filter(Boolean);
}

function getCoordinates(project) {
  const latitude = getValidCoordinate(
    project?.latitude
  );

  const longitude = getValidCoordinate(
    project?.longitude
  );

  /*
   * Latitude must be within [-90, 90].
   */
  if (
    latitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude === null
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

function getMapsUrl(project) {
  const coordinates = getCoordinates(project);

  if (!coordinates) {
    return null;
  }

  const {
    latitude,
    longitude,
  } = coordinates;

  return (
    `https://www.google.com/maps/search/?api=1` +
    `&query=${encodeURIComponent(
      `${latitude},${longitude}`
    )}`
  );
}

function getReportedListingCount(project) {
  const value = Number(project?.total_listings);

  return Number.isInteger(value) && value >= 0
    ? value
    : null;
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [listings, setListings] = useState([]);
  const [reportedListingTotal, setReportedListingTotal] =
    useState(null);

  const [loadingProject, setLoadingProject] =
    useState(true);

  const [loadingListings, setLoadingListings] =
    useState(true);

  const [projectError, setProjectError] =
    useState('');

  const [listingsError, setListingsError] =
    useState('');

  const [listPage, setListPage] = useState(1);

  const [retryKey, setRetryKey] = useState(0);

  const normalizedId = normalizeText(id);

  /*
   * Reset page when navigating directly from one project
   * to another.
   */
  useEffect(() => {
    setListPage(1);
  }, [normalizedId]);

  /*
   * Load project metadata.
   */
  useEffect(() => {
    if (!normalizedId) {
      setProject(null);
      setProjectError('Invalid project ID.');
      setLoadingProject(false);
      return undefined;
    }

    const controller = new AbortController();

    let mounted = true;

    const loadProject = async () => {
      setLoadingProject(true);
      setProjectError('');

      try {
        const response = await getProject(
          normalizedId,
          {
            signal: controller.signal,
          }
        );

        if (!mounted) {
          return;
        }

        if (!response) {
          throw new Error(
            'Project was not found.'
          );
        }

        setProject(response);
      } catch (error) {
        if (
          error?.name === 'AbortError' ||
          controller.signal.aborted
        ) {
          return;
        }

        if (!mounted) {
          return;
        }

        setProject(null);
        setProjectError(
          error?.message ||
          'Unable to load project details.'
        );
      } finally {
        if (mounted && !controller.signal.aborted) {
          setLoadingProject(false);
        }
      }
    };

    loadProject();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [normalizedId, retryKey]);

  /*
   * Load project listings independently from project
   * metadata. This prevents an unnecessary reload when
   * unrelated project state changes.
   */
  useEffect(() => {
    if (!normalizedId) {
      setListings([]);
      setReportedListingTotal(null);
      setListingsError('');
      setLoadingListings(false);
      return undefined;
    }

    const controller = new AbortController();

    let mounted = true;

    const loadListings = async () => {
      setLoadingListings(true);
      setListingsError('');

      try {
        const response =
          await getListingsByProject(
            normalizedId,
            {
              offset:
                (listPage - 1) * PAGE_SIZE,
              limit: PAGE_SIZE,
              signal: controller.signal,
            }
          );

        if (!mounted) {
          return;
        }

        const results = Array.isArray(
          response?.results
        )
          ? response.results
          : [];

        setListings(results);

        const total = Number(response?.total);

        setReportedListingTotal(
          Number.isFinite(total) && total >= 0
            ? total
            : null
        );
      } catch (error) {
        if (
          error?.name === 'AbortError' ||
          controller.signal.aborted
        ) {
          return;
        }

        if (!mounted) {
          return;
        }

        setListings([]);
        setReportedListingTotal(null);
        setListingsError(
          error?.message ||
          'Unable to load project listings.'
        );
      } finally {
        if (mounted && !controller.signal.aborted) {
          setLoadingListings(false);
        }
      }
    };

    loadListings();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [normalizedId, listPage, retryKey]);

  const amenities = useMemo(
    () => getAmenities(project),
    [project]
  );

  const status = normalizeText(
    project?.project_status
  );

  const statusClass = getStatusClass(status);

  const location = getLocation(project);

  const projectUrl = getExternalHttpUrl(
    project?.project_url
  );

  const mapsUrl = getMapsUrl(project);

  const reportedProjectListings =
    getReportedListingCount(project);

  const hasCountComparison =
    reportedProjectListings !== null &&
    reportedListingTotal !== null;

  const reportedCountsMatch =
    hasCountComparison &&
    reportedProjectListings ===
      reportedListingTotal;

  const handleRetry = useCallback(() => {
    setRetryKey((value) => value + 1);
  }, []);

  const handlePageChange = useCallback(
    (nextPage) => {
      const page = Number(nextPage);

      if (
        !Number.isInteger(page) ||
        page < 1
      ) {
        return;
      }

      setListPage(page);

      window.requestAnimationFrame(() => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      });
    },
    []
  );

  /*
   * Do not treat the endpoint's reported total as an
   * authoritative exhaustive count. The live API has
   * demonstrated mismatches between reported totals and
   * the number of records returned by complete pagination.
   *
   * Therefore this comparison is explicitly labelled
   * "reported by API", not as an assignment-grade
   * project-count validation.
   */
  const countComparison = useMemo(() => {
    if (!hasCountComparison) {
      return null;
    }

    return {
      matches: reportedCountsMatch,
      projectReported:
        reportedProjectListings,
      endpointReported:
        reportedListingTotal,
    };
  }, [
    hasCountComparison,
    reportedCountsMatch,
    reportedProjectListings,
    reportedListingTotal,
  ]);

  if (loadingProject) {
    return (
      <main
        className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
        aria-busy="true"
      >
        <div
          className="flex min-h-[50vh] items-center justify-center"
          role="status"
          aria-label="Loading project"
        >
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
            aria-hidden="true"
          />
        </div>
      </main>
    );
  }

  if (projectError || !project) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center rounded-lg px-2 py-1 text-sm font-medium text-slate-600 transition hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          ← Back
        </button>

        <section
          className="rounded-2xl border border-red-200 bg-red-50 p-6"
          role="alert"
        >
          <h1 className="text-lg font-semibold text-red-800">
            Unable to load project
          </h1>

          <p className="mt-2 text-sm text-red-700">
            {projectError ||
              'The requested project could not be found.'}
          </p>

          <button
            type="button"
            onClick={handleRetry}
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to="/projects"
          className="inline-flex items-center rounded-lg px-2 py-1 text-sm font-medium text-slate-600 transition hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          ← Back to projects
        </Link>
      </div>

      {/* Project header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                {normalizeText(
                  project.apartment_name
                ) ||
                  normalizeText(project.name) ||
                  `Project ${normalizedId}`}
              </h1>

              {status && (
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClass}`}
                >
                  {titleCase(status)}
                </span>
              )}
            </div>

            <p className="mt-3 text-sm text-slate-600">
              {location}
            </p>

            {project.description && (
              <p className="mt-5 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {String(project.description)}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {projectUrl && (
              <a
                href={projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Project website ↗
              </a>
            )}

            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                View on map ↗
              </a>
            )}
          </div>
        </div>

        {/* Project facts */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Price
            </p>

            <p className="mt-1 text-lg font-semibold text-slate-950">
              {getProjectPriceRange(project)}
            </p>

            {project?.price_min > project?.price_max && (
              <p className="mt-1 text-xs text-amber-700">
                Dataset reports an inverted price range.
              </p>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total units
            </p>

            <p className="mt-1 text-lg font-semibold text-slate-950">
              {Number.isFinite(
                Number(project.total_units)
              )
                ? Number(
                    project.total_units
                  ).toLocaleString('en-IN')
                : '—'}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Project listings
            </p>

            <p className="mt-1 text-lg font-semibold text-slate-950">
              {reportedProjectListings !== null
                ? reportedProjectListings.toLocaleString(
                    'en-IN'
                  )
                : '—'}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              As reported by project data
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Launch date
            </p>

            <p className="mt-1 text-lg font-semibold text-slate-950">
              {normalizeText(
                project.launch_date
              ) || '—'}
            </p>
          </div>
        </div>

        {/* Count comparison */}
        {countComparison && (
          <div
            className={`mt-6 rounded-xl border p-4 ${
              countComparison.matches
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                countComparison.matches
                  ? 'text-emerald-800'
                  : 'text-amber-800'
              }`}
            >
              API-reported listing count comparison
            </p>

            <p
              className={`mt-1 text-sm ${
                countComparison.matches
                  ? 'text-emerald-700'
                  : 'text-amber-700'
              }`}
            >
              Project record reports{' '}
              <strong>
                {countComparison.projectReported}
              </strong>{' '}
              listings, while the project-listings
              endpoint reports{' '}
              <strong>
                {countComparison.endpointReported}
              </strong>
              .
            </p>

            {!countComparison.matches && (
              <p className="mt-2 text-xs text-amber-700">
                This is an API-reported comparison only.
                It is not used as the definitive project
                listing-count validation in Insights.
              </p>
            )}
          </div>
        )}

        {/* Amenities */}
        {amenities.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-950">
              Amenities
            </h2>

            <div className="mt-3 flex flex-wrap gap-2">
              {amenities.map((amenity, index) => (
                <span
                  key={`${amenity}-${index}`}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
                >
                  {titleCase(amenity)}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Listings */}
      <section className="mt-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Listings in this project
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Listings currently returned by the project
              endpoint.
            </p>
          </div>

          {reportedListingTotal !== null && (
            <p className="text-sm text-slate-500">
              API reports{' '}
              {reportedListingTotal.toLocaleString(
                'en-IN'
              )}{' '}
              listings
            </p>
          )}
        </div>

        {loadingListings ? (
          <div
            className="flex min-h-[240px] items-center justify-center"
            role="status"
            aria-label="Loading project listings"
          >
            <div
              className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
              aria-hidden="true"
            />
          </div>
        ) : listingsError ? (
          <div
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-6"
            role="alert"
          >
            <h3 className="font-semibold text-red-800">
              Unable to load project listings
            </h3>

            <p className="mt-1 text-sm text-red-700">
              {listingsError}
            </p>

            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Retry
            </button>
          </div>
        ) : listings.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <h3 className="text-lg font-semibold text-slate-950">
              No listings found
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              There are no listings currently returned
              for this project.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard
                  key={
                    listing?.listing_id ??
                    listing?.id
                  }
                  listing={listing}
                />
              ))}
            </div>

            {reportedListingTotal > PAGE_SIZE && (
              <div className="mt-8">
                <Pagination
                  page={listPage}
                  pageSize={PAGE_SIZE}
                  total={reportedListingTotal}
                  onChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}