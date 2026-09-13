// src/pages/Projects.jsx

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useSearchParams,
} from 'react-router-dom';

import {
  fetchAll,
  getProjects,
} from '../api/client.js';

import ProjectCard from '../components/ProjectCard.jsx';
import Pagination from '../components/Pagination.jsx';

const PAGE_SIZE = 20;

const DEFAULT_LOCALITY = 'Golf Course Road';
const DEFAULT_SORT_BY = 'price_max';
const DEFAULT_ORDER = 'desc';

const STATUS_OPTIONS = [
  'under construction',
  'ready to move',
  'new launch',
];

const SORT_OPTIONS = [
  {
    value: 'price_max:desc',
    label: 'Price: High to Low',
  },
  {
    value: 'price_min:asc',
    label: 'Price: Low to High',
  },
  {
    value: 'launch_date:desc',
    label: 'Newest launches',
  },
  {
    value: 'total_units:desc',
    label: 'Largest',
  },
];

function toPositiveInt(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : fallback;
}

function toFiniteNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeComparableText(value) {
  return normalizeText(value).toLowerCase();
}

function isValidSort(sortBy, order) {
  return SORT_OPTIONS.some(
    (option) =>
      option.value === `${sortBy}:${order}`
  );
}

function compareNumbers(
  a,
  b,
  order = 'asc'
) {
  const first = toFiniteNumber(a);
  const second = toFiniteNumber(b);

  if (first === null && second === null) {
    return 0;
  }

  if (first === null) {
    return 1;
  }

  if (second === null) {
    return -1;
  }

  const result = first - second;

  return order === 'desc'
    ? -result
    : result;
}

function compareDates(
  a,
  b,
  order = 'asc'
) {
  const first = Date.parse(a);
  const second = Date.parse(b);

  const firstValid = Number.isFinite(first);
  const secondValid = Number.isFinite(second);

  if (!firstValid && !secondValid) {
    return 0;
  }

  if (!firstValid) {
    return 1;
  }

  if (!secondValid) {
    return -1;
  }

  const result = first - second;

  return order === 'desc'
    ? -result
    : result;
}

function sortProjects(
  projects,
  sortBy,
  order
) {
  return [...projects].sort((a, b) => {
    let result = 0;

    switch (sortBy) {
      case 'price_min':
        result = compareNumbers(
          a.price_min,
          b.price_min,
          order
        );
        break;

      case 'price_max':
        result = compareNumbers(
          a.price_max,
          b.price_max,
          order
        );
        break;

      case 'launch_date':
        result = compareDates(
          a.launch_date,
          b.launch_date,
          order
        );
        break;

      case 'total_units':
        result = compareNumbers(
          a.total_units,
          b.total_units,
          order
        );
        break;

      default:
        result = 0;
    }

    if (result !== 0) {
      return result;
    }

    return String(
      a.project_id ?? ''
    ).localeCompare(
      String(b.project_id ?? '')
    );
  });
}

function Skeleton() {
  return (
    <div
      className="animate-pulse rounded-xl border border-gray-200 bg-white p-4"
      aria-hidden="true"
    >
      <div className="mb-4 h-1 rounded-t-full bg-amber-200" />

      <div className="mb-2 h-4 w-3/4 rounded bg-gray-200" />

      <div className="mb-4 h-3 w-1/2 rounded bg-gray-100" />

      <div className="mb-4 h-6 w-2/3 rounded bg-gray-200" />

      <div className="flex gap-4 border-t border-gray-100 pt-3">
        <div className="h-3 w-20 rounded bg-gray-100" />
        <div className="h-3 w-20 rounded bg-gray-100" />
      </div>
    </div>
  );
}

export default function Projects() {
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const [
    projects,
    setProjects,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const filters = useMemo(() => {
    const requestedSortBy =
      normalizeText(
        searchParams.get('sort_by')
      ) || DEFAULT_SORT_BY;

    const requestedOrder =
      normalizeText(
        searchParams.get('order')
      ) || DEFAULT_ORDER;

    const validSort = isValidSort(
      requestedSortBy,
      requestedOrder
    );

    const localityParam =
      searchParams.get('locality');

    return {
      page: toPositiveInt(
        searchParams.get('page'),
        1
      ),

      locality:
        localityParam === null
          ? DEFAULT_LOCALITY
          : normalizeText(localityParam),

      project_status:
        normalizeText(
          searchParams.get(
            'project_status'
          )
        ),

      sort_by: validSort
        ? requestedSortBy
        : DEFAULT_SORT_BY,

      order: validSort
        ? requestedOrder
        : DEFAULT_ORDER,
    };
  }, [searchParams]);

  const [
    localityInput,
    setLocalityInput,
  ] = useState(filters.locality);

  useEffect(() => {
    setLocalityInput(filters.locality);
  }, [filters.locality]);

  const selectedSort =
    `${filters.sort_by}:${filters.order}`;

  const hasFilters =
    filters.locality !== DEFAULT_LOCALITY ||
    Boolean(filters.project_status);

  const update = useCallback(
    (updates) => {
      const merged = {
        ...filters,
        ...updates,
      };

      const clean = {};

      const page = toPositiveInt(
        merged.page,
        1
      );

      if (page > 1) {
        clean.page = String(page);
      }

      const locality =
        normalizeText(
          merged.locality
        );

      if (
        locality &&
        locality !== DEFAULT_LOCALITY
      ) {
        clean.locality = locality;
      }

      const status =
        normalizeText(
          merged.project_status
        );

      if (status) {
        clean.project_status = status;
      }

      const sortBy =
        normalizeText(
          merged.sort_by
        ) || DEFAULT_SORT_BY;

      const order =
        normalizeText(
          merged.order
        ) || DEFAULT_ORDER;

      if (
        isValidSort(
          sortBy,
          order
        ) &&
        !(
          sortBy === DEFAULT_SORT_BY &&
          order === DEFAULT_ORDER
        )
      ) {
        clean.sort_by = sortBy;
        clean.order = order;
      }

      setSearchParams(clean);
    },
    [
      filters,
      setSearchParams,
    ]
  );

  const clearFilters = useCallback(() => {
    const clean = {};

    if (
      filters.sort_by !== DEFAULT_SORT_BY ||
      filters.order !== DEFAULT_ORDER
    ) {
      clean.sort_by = filters.sort_by;
      clean.order = filters.order;
    }

    setSearchParams(clean);
  }, [
    filters.sort_by,
    filters.order,
    setSearchParams,
  ]);

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadProjects() {
      setLoading(true);
      setError('');

      try {
        const response =
          await fetchAll(
            ({ offset, limit, signal }) =>
              getProjects(
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
              label: 'projects',
            }
          );

        if (
          !response ||
          !Array.isArray(
            response.results
          )
        ) {
          throw new Error(
            'Invalid projects response from the API.'
          );
        }

        setProjects(
          response.results
        );
      } catch (err) {
        if (
          err?.name ===
          'AbortError'
        ) {
          return;
        }

        setProjects([]);

        setError(
          err?.message ||
            'Could not load projects.'
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    }

    loadProjects();

    return () => {
      controller.abort();
    };
  }, []);

  const filteredProjects =
    useMemo(() => {
      const locality =
        normalizeComparableText(
          filters.locality
        );

      const status =
        normalizeComparableText(
          filters.project_status
        );

      return projects.filter(
        (project) => {
          const projectLocality =
            normalizeComparableText(
              project.locality
            );

          const projectStatus =
            normalizeComparableText(
              project.project_status
            );

          const matchesLocality =
            !locality ||
            projectLocality ===
              locality;

          const matchesStatus =
            !status ||
            projectStatus ===
              status;

          return (
            matchesLocality &&
            matchesStatus
          );
        }
      );
    }, [
      projects,
      filters.locality,
      filters.project_status,
    ]);

  const sortedProjects =
    useMemo(() => {
      return sortProjects(
        filteredProjects,
        filters.sort_by,
        filters.order
      );
    }, [
      filteredProjects,
      filters.sort_by,
      filters.order,
    ]);

  const total =
    sortedProjects.length;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total / PAGE_SIZE
      )
    );

  const currentPage =
    Math.min(
      filters.page,
      totalPages
    );

  const paginatedProjects =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        PAGE_SIZE;

      return sortedProjects.slice(
        start,
        start + PAGE_SIZE
      );
    }, [
      sortedProjects,
      currentPage,
    ]);

  useEffect(() => {
    if (
      !loading &&
      filters.page !== currentPage
    ) {
      update({
        page: currentPage,
      });
    }
  }, [
    loading,
    filters.page,
    currentPage,
    update,
  ]);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'auto',
    });
  }, [currentPage]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">
            Projects
          </h1>

          {!loading && (
            <p className="mt-0.5 text-sm text-gray-500">
              {total.toLocaleString(
                'en-IN'
              )}{' '}
              {total === 1
                ? 'project'
                : 'projects'}
            </p>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <label
          className="sr-only"
          htmlFor="project-locality"
        >
          Locality
        </label>

        <input
          id="project-locality"
          type="text"
          aria-label="Filter projects by locality"
          placeholder="Locality…"
          value={localityInput}
          onChange={(event) => {
            const value =
              event.target.value.replace(
                /^\s+/,
                ''
              );

            setLocalityInput(value);

            update({
              locality: value,
              page: 1,
            });
          }}
          className="w-40 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
        />

        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Project status"
        >
          {STATUS_OPTIONS.map(
            (status) => {
              const selected =
                filters.project_status ===
                status;

              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={
                    selected
                  }
                  onClick={() =>
                    update({
                      project_status:
                        selected
                          ? ''
                          : status,
                      page: 1,
                    })
                  }
                  className={[
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-400',
                    selected
                      ? 'border-navy-900 bg-navy-900 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400',
                  ].join(' ')}
                >
                  {status
                    .charAt(0)
                    .toUpperCase() +
                    status.slice(1)}
                </button>
              );
            }
          )}
        </div>

        <label
          className="sr-only"
          htmlFor="project-sort"
        >
          Sort projects
        </label>

        <select
          id="project-sort"
          aria-label="Sort projects"
          value={selectedSort}
          onChange={(event) => {
            const value =
              event.target.value;

            const separator =
              value.lastIndexOf(':');

            const sortBy =
              value.slice(
                0,
                separator
              );

            const order =
              value.slice(
                separator + 1
              );

            update({
              sort_by: sortBy,
              order,
              page: 1,
            });
          }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
        >
          {SORT_OPTIONS.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            )
          )}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded text-xs text-gray-400 transition-colors hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="shrink-0 font-medium underline focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({
              length: 9,
            }).map(
              (_, index) => (
                <Skeleton
                  key={index}
                />
              )
            )
          : paginatedProjects.map(
              (project) => (
                <ProjectCard
                  key={String(
                    project.project_id
                  )}
                  project={project}
                />
              )
            )}
      </div>

      {!loading &&
        total === 0 && (
          <div className="py-20 text-center">
            <p className="text-lg font-medium text-gray-500">
              No projects found
            </p>

            <p className="mt-1 text-sm text-gray-400">
              {hasFilters
                ? 'Try changing or clearing your filters.'
                : 'There are currently no projects to display.'}
            </p>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

      {!loading &&
        total > 0 && (
          <Pagination
            page={currentPage}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={(nextPage) =>
              update({
                page: nextPage,
              })
            }
          />
        )}
    </div>
  );
}