/**
 * Short-lived in-memory cache for API-backed collections.
 *
 * List pages perform all filtering/pagination in the browser, so remounting
 * a route must not re-download the same complete dataset. Requests are also
 * deduplicated so two routes mounting at the same time share one fetch.
 */

import {
  fetchAll,
  getHealth,
  getListings,
  getProjects,
  getRentals,
} from "./client.js";

const CACHE_TTL_MS = 15 * 60 * 1000;

const cache = new Map();
const inFlight = new Map();

function abortError() {
  return new DOMException("Request aborted.", "AbortError");
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

/**
 * Abort only this consumer's wait. The shared request continues and can
 * populate the cache for the next route, which avoids duplicate downloads
 * during rapid navigation.
 */
function waitForResult(promise, signal) {
  if (!signal) return promise;

  throwIfAborted(signal);

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => signal.removeEventListener("abort", onAbort);

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(abortError());
    };

    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      }
    );
  });
}

function isFresh(entry) {
  return Boolean(entry) && Date.now() - entry.timestamp < CACHE_TTL_MS;
}

function startRequest(key, request) {
  const controller = new AbortController();

  const promise = request(controller.signal)
    .then((value) => {
      cache.set(key, {
        value,
        timestamp: Date.now(),
      });

      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, { promise, controller });

  return promise;
}

async function getCached(key, request, { signal, force = false } = {}) {
  if (force) cache.delete(key);

  const cached = cache.get(key);

  if (!force && isFresh(cached)) {
    return waitForResult(Promise.resolve(cached.value), signal);
  }

  const existing = inFlight.get(key);

  const promise =
    existing?.promise ||
    startRequest(key, (requestSignal) => request(requestSignal));

  return waitForResult(promise, signal);
}

function loadCollection(loader, label) {
  return (signal) =>
    fetchAll(loader, {
      pageSize: 50, // Ivy Homes API caps collection responses at 50.
      signal,
      label,
    });
}

export function getCachedListings(options = {}) {
  return getCached(
    "listings",
    loadCollection(
      ({ offset, limit, signal }) => getListings({ offset, limit }, { signal }),
      "listings"
    ),
    options
  );
}

export function getCachedRentals(options = {}) {
  return getCached(
    "rentals",
    loadCollection(
      ({ offset, limit, signal }) => getRentals({ offset, limit }, { signal }),
      "rentals"
    ),
    options
  );
}

export function getCachedProjects(options = {}) {
  return getCached(
    "projects",
    loadCollection(
      ({ offset, limit, signal }) => getProjects({ offset, limit }, { signal }),
      "projects"
    ),
    options
  );
}

export function getCachedHealth(options = {}) {
  return getCached("health", (signal) => getHealth({ signal }), options);
}

export function invalidateCollectionCache(key) {
  if (key) {
    cache.delete(key);
    return;
  }

  cache.clear();
}

export function clearCollectionCache() {
  cache.clear();
}