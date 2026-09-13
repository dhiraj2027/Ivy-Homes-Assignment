// src/api/client.js

import {
  getApiKey,
  getBaseUrl,
} from '../config.js';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const STORAGE_KEYS = {
  accessToken: 'ivy_token',
  refreshToken: 'ivy_refresh_token',
  user: 'ivy_user',
  expiresAt: 'ivy_token_expires',
};

const REQUEST_TIMEOUT_MS = 20_000;

const MAX_RETRIES = 3;

const CLOCK_SKEW_MS = 30_000;

/* -------------------------------------------------------------------------- */
/* Token storage                                                              */
/* -------------------------------------------------------------------------- */

export function getToken() {
  return localStorage.getItem(
    STORAGE_KEYS.accessToken
  );
}

export function getRefreshToken() {
  return localStorage.getItem(
    STORAGE_KEYS.refreshToken
  );
}

export function setToken(token) {
  if (!token) {
    localStorage.removeItem(
      STORAGE_KEYS.accessToken
    );

    return;
  }

  localStorage.setItem(
    STORAGE_KEYS.accessToken,
    String(token)
  );
}

export function setRefreshToken(token) {
  if (!token) {
    localStorage.removeItem(
      STORAGE_KEYS.refreshToken
    );

    return;
  }

  localStorage.setItem(
    STORAGE_KEYS.refreshToken,
    String(token)
  );
}

export function getStoredUser() {
  const raw = localStorage.getItem(
    STORAGE_KEYS.user
  );

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(
      STORAGE_KEYS.user
    );

    return null;
  }
}

function setStoredUser(user) {
  if (!user) {
    localStorage.removeItem(
      STORAGE_KEYS.user
    );

    return;
  }

  localStorage.setItem(
    STORAGE_KEYS.user,
    JSON.stringify(user)
  );
}

export function clearToken() {
  Object.values(STORAGE_KEYS).forEach(
    (key) => {
      localStorage.removeItem(key);
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Token expiry                                                               */
/* -------------------------------------------------------------------------- */

function setTokenExpiry(expiresInSeconds) {
  const seconds = Number(
    expiresInSeconds
  );

  if (
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    localStorage.removeItem(
      STORAGE_KEYS.expiresAt
    );

    return;
  }

  const expiresAt =
    Date.now() +
    seconds * 1000;

  localStorage.setItem(
    STORAGE_KEYS.expiresAt,
    String(expiresAt)
  );
}

export function isTokenValid() {
  const token = getToken();

  const expiresAt = Number(
    localStorage.getItem(
      STORAGE_KEYS.expiresAt
    ) || 0
  );

  if (
    !token ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= 0
  ) {
    return false;
  }

  return (
    Date.now() <
    expiresAt - CLOCK_SKEW_MS
  );
}

/* -------------------------------------------------------------------------- */
/* Authentication events                                                      */
/* -------------------------------------------------------------------------- */

function emitUnauthorized() {
  window.dispatchEvent(
    new CustomEvent(
      'auth:unauthorized'
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Abort helpers                                                              */
/* -------------------------------------------------------------------------- */

function throwIfAborted(signal) {
  if (!signal?.aborted) {
    return;
  }

  throw new DOMException(
    'Request aborted.',
    'AbortError'
  );
}

/* -------------------------------------------------------------------------- */
/* Error handling                                                             */
/* -------------------------------------------------------------------------- */

async function getErrorMessage(
  response
) {
  try {
    const payload =
      await response.json();

    if (
      typeof payload?.detail ===
      'string'
    ) {
      return payload.detail;
    }

    if (
      typeof payload?.message ===
      'string'
    ) {
      return payload.message;
    }

    if (
      typeof payload?.error ===
      'string'
    ) {
      return payload.error;
    }
  } catch {
    // Response body was not JSON.
  }

  return `Request failed with HTTP ${response.status}`;
}

/* -------------------------------------------------------------------------- */
/* Query parameters                                                           */
/* -------------------------------------------------------------------------- */

function cleanParams(
  params = {}
) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ''
    )
  );
}

function buildUrl(
  path,
  params = {}
) {
  const url = new URL(
    `${getBaseUrl()}${path}`
  );

  const cleaned =
    cleanParams(params);

  for (
    const [key, value] of
    Object.entries(cleaned)
  ) {
    url.searchParams.set(
      key,
      String(value)
    );
  }

  return url.toString();
}

/* -------------------------------------------------------------------------- */
/* Fetch with timeout                                                         */
/* -------------------------------------------------------------------------- */

async function fetchWithTimeout(
  url,
  options = {},
  signal
) {
  throwIfAborted(signal);

  const timeoutController =
    new AbortController();

  let timedOut = false;

  const timeoutId =
    window.setTimeout(() => {
      timedOut = true;

      timeoutController.abort();
    }, REQUEST_TIMEOUT_MS);

  const abortHandler = () => {
    timeoutController.abort();
  };

  signal?.addEventListener(
    'abort',
    abortHandler,
    { once: true }
  );

  try {
    const response =
      await fetch(url, {
        ...options,
        signal:
          timeoutController.signal,
      });

    return response;
  } catch (error) {
    if (signal?.aborted) {
      throw new DOMException(
        'Request aborted.',
        'AbortError'
      );
    }

    if (
      timedOut ||
      error?.name ===
        'AbortError'
    ) {
      throw new Error(
        'The request timed out. Please try again.'
      );
    }

    throw error;
  } finally {
    window.clearTimeout(
      timeoutId
    );

    signal?.removeEventListener(
      'abort',
      abortHandler
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Refresh                                                                    */
/* -------------------------------------------------------------------------- */

/*
 * Multiple requests can discover an expired token
 * at the same time.
 *
 * Only one refresh request should be sent.
 */

let refreshPromise = null;

export async function refreshAccessToken(
  options = {}
) {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken =
    getRefreshToken();

  if (!refreshToken) {
    throw new Error(
      'No refresh token available.'
    );
  }

  throwIfAborted(
    options.signal
  );

  refreshPromise =
    (async () => {
      const response =
        await fetchWithTimeout(
          `${getBaseUrl()}/auth/refresh`,
          {
            method: 'POST',

            headers: {
              Accept:
                'application/json',

              'Content-Type':
                'application/json',

              'X-API-Key':
                getApiKey(),
            },

            body: JSON.stringify({
              refresh_token:
                refreshToken,
            }),
          },
          options.signal
        );

      if (!response.ok) {
        const message =
          await getErrorMessage(
            response
          );

        clearToken();
        emitUnauthorized();

        throw new Error(
          message
        );
      }

      const data =
        await response.json();

      if (
        !data?.access_token
      ) {
        clearToken();
        emitUnauthorized();

        throw new Error(
          'Refresh succeeded but no access_token was returned.'
        );
      }

      setToken(
        data.access_token
      );

      /*
       * Some refresh APIs rotate the
       * refresh token.
       */
      if (
        data.refresh_token
      ) {
        setRefreshToken(
          data.refresh_token
        );
      }

      setTokenExpiry(
        data.expires_in
      );

      if (data.user) {
        setStoredUser(
          data.user
        );
      }

      return data;
    })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/* -------------------------------------------------------------------------- */
/* Core API request                                                           */
/* -------------------------------------------------------------------------- */

async function apiFetch(
  path,
  {
    params = {},
    method = 'GET',
    body,
    auth = false,
    signal,
    retry = true,
    retryCount = 0,
  } = {}
) {
  throwIfAborted(signal);

  /*
   * Proactively refresh an expired access token.
   */
  if (
    auth &&
    !isTokenValid()
  ) {
    const refreshToken =
      getRefreshToken();

    if (!refreshToken) {
      clearToken();
      emitUnauthorized();

      throw new Error(
        'Your session has expired. Please log in again.'
      );
    }

    await refreshAccessToken({
      signal,
    });
  }

  const headers = {
    Accept:
      'application/json',

    'X-API-Key':
      getApiKey(),
  };

  if (
    body !== undefined
  ) {
    headers[
      'Content-Type'
    ] =
      'application/json';
  }

  if (auth) {
    const token =
      getToken();

    if (!token) {
      throw new Error(
        'Authentication required. Please log in first.'
      );
    }

    headers.Authorization =
      `Bearer ${token}`;
  }

  const requestOptions = {
    method,
    headers,

    ...(body !== undefined
      ? {
          body: JSON.stringify(
            body
          ),
        }
      : {}),
  };

  let response;

  try {
    response =
      await fetchWithTimeout(
        buildUrl(
          path,
          params
        ),
        requestOptions,
        signal
      );
  } catch (error) {
    if (
      error?.name ===
      'AbortError'
    ) {
      throw error;
    }

    /*
     * Retry transient network failures.
     *
     * POST requests are deliberately
     * not retried here because blindly
     * repeating mutations can be unsafe.
     */
    if (
      method === 'GET' &&
      retry &&
      retryCount < MAX_RETRIES
    ) {
      const delay =
        500 *
        2 ** retryCount;

      await new Promise(
        (
          resolve,
          reject
        ) => {
          const timeoutId =
            window.setTimeout(
              resolve,
              delay
            );

          signal?.addEventListener(
            'abort',
            () => {
              window.clearTimeout(
                timeoutId
              );

              reject(
                new DOMException(
                  'Request aborted.',
                  'AbortError'
                )
              );
            },
            { once: true }
          );
        }
      );

      return apiFetch(
        path,
        {
          params,
          method,
          body,
          auth,
          signal,
          retry,
          retryCount:
            retryCount + 1,
        }
      );
    }

    throw error;
  }

  /*
   * Access token may expire between
   * the proactive check and the request.
   */
  if (
    response.status === 401 &&
    auth &&
    retry &&
    getRefreshToken()
  ) {
    await refreshAccessToken({
      signal,
    });

    return apiFetch(
      path,
      {
        params,
        method,
        body,
        auth,
        signal,
        retry: false,
        retryCount,
      }
    );
  }

  /*
   * No usable refresh token or the
   * retry already happened.
   */
  if (
    response.status === 401 &&
    auth
  ) {
    const message =
      await getErrorMessage(
        response
      );

    clearToken();
    emitUnauthorized();

    throw new Error(
      message
    );
  }

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response
      )
    );
  }

  if (
    response.status === 204
  ) {
    return null;
  }

  const contentType =
    response.headers.get(
      'content-type'
    ) || '';

  if (
    !contentType.includes(
      'application/json'
    )
  ) {
    return response.text();
  }

  return response.json();
}

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

export async function login(
  email,
  password,
  options = {}
) {
  const normalizedEmail =
    String(email ?? '').trim();

  if (!normalizedEmail) {
    throw new Error(
      'Email is required.'
    );
  }

  if (!password) {
    throw new Error(
      'Password is required.'
    );
  }

  throwIfAborted(
    options.signal
  );

  const response =
    await fetchWithTimeout(
      `${getBaseUrl()}/auth/login`,
      {
        method: 'POST',

        headers: {
          Accept:
            'application/json',

          'Content-Type':
            'application/json',

          'X-API-Key':
            getApiKey(),
        },

        body: JSON.stringify({
          email:
            normalizedEmail,
          password,
        }),
      },
      options.signal
    );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response
      )
    );
  }

  const data =
    await response.json();

  /*
   * Verified live API contract:
   *
   * access_token
   * refresh_token
   * expires_in
   * user
   */

  if (
    !data?.access_token
  ) {
    throw new Error(
      'Login succeeded but no access_token was returned.'
    );
  }

  setToken(
    data.access_token
  );

  if (
    data.refresh_token
  ) {
    setRefreshToken(
      data.refresh_token
    );
  }

  setTokenExpiry(
    data.expires_in
  );

  setStoredUser(
    data.user || null
  );

  return data;
}

export async function logout(
  options = {}
) {
  try {
    if (getToken()) {
      await apiFetch(
        '/auth/logout',
        {
          method: 'POST',
          auth: true,
          signal:
            options.signal,
        }
      );
    }
  } finally {
    clearToken();
  }
}

/* -------------------------------------------------------------------------- */
/* Listings                                                                   */
/* -------------------------------------------------------------------------- */

export async function getListings(
  params = {},
  options = {}
) {
  return apiFetch(
    '/v1/listings',
    {
      params:
        cleanParams(params),

      auth: true,

      signal:
        options.signal,
    }
  );
}

export async function getListing(
  id,
  options = {}
) {
  if (
    id === undefined ||
    id === null ||
    String(id).trim() === ''
  ) {
    throw new Error(
      'Listing ID is required.'
    );
  }

  /*
   * VERIFIED LIVE ENDPOINT:
   *
   * /v1/listing/{id}   -> 404
   * /v1/listings/{id}  -> 200
   *
   * Therefore the plural endpoint
   * is the only one used here.
   */
  return apiFetch(
    `/v1/listings/${encodeURIComponent(
      String(id)
    )}`,
    {
      auth: true,

      signal:
        options.signal,
    }
  );
}

/*
 * No getSimilarListings().
 *
 * Both tested similar-listing endpoints
 * returned 404, so the application must
 * not depend on this feature.
 */

/* -------------------------------------------------------------------------- */
/* Rentals                                                                    */
/* -------------------------------------------------------------------------- */

export async function getRentals(
  params = {},
  options = {}
) {
  return apiFetch(
    '/v1/rentals',
    {
      params:
        cleanParams(params),

      auth: true,

      signal:
        options.signal,
    }
  );
}

export async function getRental(
  id,
  options = {}
) {
  if (
    id === undefined ||
    id === null ||
    String(id).trim() === ''
  ) {
    throw new Error(
      'Rental ID is required.'
    );
  }

  return apiFetch(
    `/v1/rentals/${encodeURIComponent(
      String(id)
    )}`,
    {
      auth: true,

      signal:
        options.signal,
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Projects                                                                   */
/* -------------------------------------------------------------------------- */

export async function getProjects(
  params = {},
  options = {}
) {
  return apiFetch(
    '/v1/projects',
    {
      params:
        cleanParams(params),

      auth: true,

      signal:
        options.signal,
    }
  );
}

export async function getProject(
  id,
  options = {}
) {
  if (
    id === undefined ||
    id === null ||
    String(id).trim() === ''
  ) {
    throw new Error(
      'Project ID is required.'
    );
  }

  return apiFetch(
    `/v1/projects/${encodeURIComponent(
      String(id)
    )}`,
    {
      auth: true,

      signal:
        options.signal,
    }
  );
}

export async function getListingsByProject(
  projectId,
  params = {},
  options = {}
) {
  if (
    projectId === undefined ||
    projectId === null ||
    String(projectId).trim() === ''
  ) {
    throw new Error(
      'Project ID is required.'
    );
  }

  return getListings(
    {
      ...params,
      project_id:
        projectId,
    },
    options
  );
}

// ============================================================================
// FAVOURITES / SAVED LISTINGS
// ============================================================================

export async function getFavourites(options = {}) {
  /*
   * VERIFIED LIVE API:
   *
   * GET /v1/saved
   *
   * Response:
   * {
   *   count: number,
   *   results: [...]
   * }
   */

  return apiFetch('/v1/saved', {
    auth: true,
    signal: options.signal,
  });
}

export async function addFavourite(listingId, options = {}) {
  const normalizedId = String(listingId ?? '').trim();

  if (!normalizedId) {
    throw new Error('Listing ID is required.');
  }

  /*
   * VERIFIED LIVE API:
   *
   * POST /v1/saved
   *
   * Body:
   * {
   *   listing_id: "<listing_id>"
   * }
   *
   * Successful response: HTTP 201
   */

  return apiFetch('/v1/saved', {
    method: 'POST',
    auth: true,
    body: {
      listing_id: normalizedId,
    },
    signal: options.signal,
  });
}

export async function removeFavourite(listingId, options = {}) {
  const normalizedId = String(listingId ?? '').trim();

  if (!normalizedId) {
    throw new Error('Listing ID is required.');
  }

  /*
   * VERIFIED LIVE API:
   *
   * DELETE /v1/saved/{listing_id}
   *
   * Successful response: HTTP 200
   */

  return apiFetch(
    `/v1/saved/${encodeURIComponent(normalizedId)}`,
    {
      method: 'DELETE',
      auth: true,
      signal: options.signal,
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                  */
/* -------------------------------------------------------------------------- */

/*
 * IMPORTANT:
 *
 * There is no working remote analytics
 * endpoint in the verified API.
 *
 * /v1/analytics/summary -> 404
 *
 * Assignment analytics are calculated
 * locally from complete datasets.
 *
 * Therefore there is intentionally NO
 * getAnalytics() export.
 */

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

export async function getHealth(
  options = {}
) {
  return apiFetch(
    '/health',
    {
      auth: false,

      signal:
        options.signal,
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Complete pagination                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Fetch every record from a collection.
 *
 * IMPORTANT:
 *
 * The running Ivy Homes API was verified
 * to use:
 *
 *     offset + limit
 *
 * NOT:
 *
 *     page + limit
 *
 * The API's reported `total` is also
 * inconsistent with the number of records
 * that can actually be retrieved.
 *
 * Therefore:
 *
 * 1. Start at offset 0.
 * 2. Request `limit` records.
 * 3. Continue until an EMPTY page.
 * 4. Never use reported total as the
 *    termination condition.
 * 5. Deduplicate records by stable ID.
 *
 * The return value is:
 *
 * {
 *   results,
 *   total,
 *   reportedTotal
 * }
 *
 * Example:
 *
 * const data = await fetchAll(
 *   ({ offset, limit, signal }) =>
 *     getListings(
 *       { offset, limit },
 *       { signal }
 *     ),
 *   {
 *     pageSize: 50,
 *     signal,
 *     label: 'listings',
 *   }
 * );
 */
export async function fetchAll(
  loader,
  {
    pageSize = 50,
    signal,
    label = 'records',
    onProgress,
  } = {}
) {
  if (
    typeof loader !==
    'function'
  ) {
    throw new TypeError(
      'fetchAll requires a loader function.'
    );
  }

  if (
    !Number.isInteger(
      pageSize
    ) ||
    pageSize <= 0
  ) {
    throw new RangeError(
      'fetchAll pageSize must be a positive integer.'
    );
  }

  const allRecords = [];

  const seenIds = new Set();

  let offset = 0;

  let pageNumber = 1;

  let reportedTotal =
    null;

  while (true) {
    throwIfAborted(signal);

    const response =
      await loader({
        offset,
        limit: pageSize,
        signal,
      });

    if (
      !response ||
      !Array.isArray(
        response.results
      )
    ) {
      throw new Error(
        `Invalid ${label} response at offset ${offset}: expected a results array.`
      );
    }

    /*
     * Preserve the API's reported total
     * for discrepancy reporting, but NEVER
     * use it to stop pagination.
     */
    if (
      reportedTotal ===
      null
    ) {
      const numericTotal =
        Number(
          response.total
        );

      if (
        Number.isFinite(
          numericTotal
        ) &&
        numericTotal >= 0
      ) {
        reportedTotal =
          numericTotal;
      }
    }

    const results =
      response.results;

    /*
     * Empty page is the only definitive
     * pagination termination condition.
     */
    if (
      results.length === 0
    ) {
      break;
    }

    for (
      const record of results
    ) {
      if (!record) {
        continue;
      }

      const id =
        record.listing_id ??
        record.rental_id ??
        record.project_id ??
        record.id;

      /*
       * Records without IDs are retained
       * rather than silently discarded.
       *
       * This is safer for analytics because
       * silently dropping an ID-less record
       * would alter counts.
       */
      if (
        id === undefined ||
        id === null
      ) {
        allRecords.push(
          record
        );

        continue;
      }

      const normalizedId =
        String(id);

      if (
        seenIds.has(
          normalizedId
        )
      ) {
        continue;
      }

      seenIds.add(
        normalizedId
      );

      allRecords.push(
        record
      );
    }

    onProgress?.(
      pageNumber,
      reportedTotal ===
        null
        ? null
        : Math.ceil(
            reportedTotal /
              pageSize
          ),
      allRecords.length
    );

    /*
     * Always advance by the requested
     * page size because the API uses offset.
     */
    offset += pageSize;

    pageNumber += 1;
  }

  return {
    results: allRecords,

    /*
     * Actual number of unique/retrieved
     * records is authoritative for local
     * analytics.
     */
    total:
      allRecords.length,

    /*
     * API-reported value is retained only
     * for discrepancy documentation.
     */
    reportedTotal,
  };
}