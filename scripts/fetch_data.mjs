#!/usr/bin/env node

/**
 * fetch_data.mjs
 *
 * Fetches the complete Ivy Homes dataset used by the assignment.
 *
 * Important API behavior verified against the running API:
 *
 * 1. Collection pagination uses `offset`.
 * 2. `page` / `skip` are not reliable for this API.
 * 3. The server currently caps collection responses at 50 records.
 * 4. Collection `total` can be incorrect.
 * 5. Therefore `total` is recorded as reported metadata only.
 * 6. Pagination continues until the API returns an empty result page.
 * 7. Every fetched record must have a stable unique ID.
 *
 * Usage:
 *
 *   VITE_API_KEY=... IVY_EMAIL=... IVY_PASSWORD=... \
 *   node scripts/fetch_data.mjs
 *
 * Optional:
 *
 *   VITE_BASE_URL=https://solve.ivy.homes
 *
 * The API key and password are NEVER written to dataset files.
 */

import { mkdirSync, renameSync, writeFileSync, existsSync } from "node:fs";

import { join, dirname } from "node:path";

import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, "data");

mkdirSync(DATA_DIR, { recursive: true });

const BASE_URL = (
  process.env.VITE_BASE_URL || "https://solve.ivy.homes"
).replace(/\/+$/, "");

const API_KEY = String(process.env.VITE_API_KEY || "").trim();

const EMAIL = String(process.env.IVY_EMAIL || "").trim();

const PASSWORD = String(process.env.IVY_PASSWORD || "");

const PAGE_SIZE = 50;

const REQUEST_DELAY_MS = 150;

const MAX_RETRIES = 3;

const REQUEST_TIMEOUT_MS = 20_000;

const MAX_PAGES = 10_000;

let ACCESS_TOKEN = null;

let REFRESH_TOKEN = null;

function requireConfiguration() {
  const missing = [];

  if (!API_KEY) {
    missing.push("VITE_API_KEY");
  }

  if (!EMAIL) {
    missing.push("IVY_EMAIL");
  }

  if (!PASSWORD) {
    missing.push("IVY_PASSWORD");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}`
    );
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function sanitizeErrorMessage(message) {
  return String(message).replace(/\s+/g, " ").slice(0, 500);
}

function atomicWriteJson(filePath, data) {
  const tempPath = `${filePath}.tmp`;

  writeFileSync(tempPath, JSON.stringify(data, null, 2) + "\n", "utf8");

  renameSync(tempPath, filePath);
}

function writeDataset(filename, dataset) {
  const filePath = join(DATA_DIR, filename);

  atomicWriteJson(filePath, dataset);

  return filePath;
}

function recordIdentity(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const id =
    record.listing_id ?? record.project_id ?? record.rental_id ?? record.id;

  if (id === undefined || id === null || String(id).trim() === "") {
    return null;
  }

  return String(id).trim();
}

function parseCollectionResponse(data, endpoint) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${endpoint}: expected an object response`);
  }

  if (!Array.isArray(data.results)) {
    throw new Error(`${endpoint}: response.results is not an array`);
  }

  const reportedTotal = Number(data.total);

  if (!Number.isInteger(reportedTotal) || reportedTotal < 0) {
    throw new Error(`${endpoint}: invalid response.total`);
  }

  return {
    reportedTotal,
    results: data.results,
  };
}

async function request(
  path,
  { method = "GET", params = {}, body = undefined, retryAuth = true } = {}
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }

  const url =
    query.size > 0
      ? `${BASE_URL}${path}?${query.toString()}`
      : `${BASE_URL}${path}`;

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();

    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers = {
        Accept: "application/json",

        "X-API-Key": API_KEY,
      };

      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      if (ACCESS_TOKEN) {
        headers.Authorization = `Bearer ${ACCESS_TOKEN}`;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 401 && retryAuth && REFRESH_TOKEN) {
        await refreshAccessToken();

        return request(path, {
          method,
          params,
          body,
          retryAuth: false,
        });
      }

      const text = await response.text();

      let data = null;

      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          if (response.ok) {
            throw new Error(`${path}: API returned invalid JSON`);
          }
        }
      }

      if (response.ok) {
        return data;
      }

      const statusMessage = `${response.status} ${response.statusText}`.trim();

      const error = new Error(`${path}: HTTP ${statusMessage}`);

      if (isTransientStatus(response.status) && attempt < MAX_RETRIES) {
        lastError = error;

        const delay = REQUEST_DELAY_MS * 2 ** attempt;

        console.warn(
          `  Retry ${attempt + 1}/${MAX_RETRIES} ` +
            `after HTTP ${response.status} ` +
            `(${delay}ms)`
        );

        await sleep(delay);

        continue;
      }

      throw error;
    } catch (error) {
      clearTimeout(timeout);

      if (error?.name === "AbortError") {
        lastError = new Error(
          `${path}: request timed out after ${REQUEST_TIMEOUT_MS}ms`
        );
      } else {
        lastError = error;
      }

      if (
        attempt < MAX_RETRIES &&
        (lastError?.name === "TypeError" ||
          lastError?.name === "FetchError" ||
          lastError?.message?.includes("timed out"))
      ) {
        const delay = REQUEST_DELAY_MS * 2 ** attempt;

        console.warn(
          `  Retry ${attempt + 1}/${MAX_RETRIES} ` +
            `after network/timeout failure (${delay}ms)`
        );

        await sleep(delay);

        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error(`${path}: request failed`);
}

async function login() {
  console.log("\n─── Authentication ───");

  const data = await request("/auth/login", {
    method: "POST",

    body: {
      email: EMAIL,
      password: PASSWORD,
    },

    retryAuth: false,
  });

  if (!data || typeof data !== "object" || !data.access_token) {
    throw new Error("Login succeeded but access_token was not returned.");
  }

  ACCESS_TOKEN = String(data.access_token);

  REFRESH_TOKEN = data.refresh_token ? String(data.refresh_token) : null;

  console.log("  Login → 200 ✓");

  if (data.user?.email) {
    console.log(`  User  : ${data.user.email}`);
  }

  console.log("  Access token received ✓");

  console.log(
    `  Refresh token : ${REFRESH_TOKEN ? "available" : "not returned"}`
  );
}

async function refreshAccessToken() {
  if (!REFRESH_TOKEN) {
    throw new Error("Access token expired and no refresh token is available.");
  }

  const data = await request("/auth/refresh", {
    method: "POST",

    body: {
      refresh_token: REFRESH_TOKEN,
    },

    retryAuth: false,
  });

  if (!data || typeof data !== "object" || !data.access_token) {
    throw new Error(
      "Token refresh succeeded but access_token was not returned."
    );
  }

  ACCESS_TOKEN = String(data.access_token);

  if (data.refresh_token) {
    REFRESH_TOKEN = String(data.refresh_token);
  }

  console.log("  Access token refreshed ✓");
}

async function fetchAll(endpoint, { label = endpoint, params = {} } = {}) {
  const results = [];

  const seenIds = new Set();

  let offset = 0;

  let reportedTotal = null;

  let pageCount = 0;

  let lastNonEmptyOffset = null;

  console.log(`\n─── Fetching ${label} ───`);

  while (true) {
    pageCount++;

    if (pageCount > MAX_PAGES) {
      throw new Error(
        `${endpoint}: exceeded MAX_PAGES=${MAX_PAGES}; ` +
          "pagination may be looping."
      );
    }

    const data = await request(endpoint, {
      params: {
        ...params,
        offset,
        limit: PAGE_SIZE,
      },
    });

    const collection = parseCollectionResponse(data, endpoint);

    if (reportedTotal === null) {
      reportedTotal = collection.reportedTotal;

      console.log(`  API reported total : ${reportedTotal}`);
    } else if (collection.reportedTotal !== reportedTotal) {
      throw new Error(
        `${endpoint}: API total changed during pagination ` +
          `(${reportedTotal} → ${collection.reportedTotal})`
      );
    }

    const page = collection.results;

    if (page.length === 0) {
      console.log(`  Offset ${offset} : 0 records → end`);

      break;
    }

    console.log(
      `  Offset ${String(offset).padStart(4)} : ` + `${page.length} records`
    );

    for (const record of page) {
      const id = recordIdentity(record);

      if (!id) {
        throw new Error(
          `${endpoint}: record at offset ${offset} ` +
            "does not contain a stable ID"
        );
      }

      if (seenIds.has(id)) {
        throw new Error(`${endpoint}: duplicate ID "${id}" encountered`);
      }

      seenIds.add(id);

      results.push(record);
    }

    lastNonEmptyOffset = offset;

    offset += page.length;

    await sleep(REQUEST_DELAY_MS);
  }

  const actualTotal = results.length;

  if (seenIds.size !== actualTotal) {
    throw new Error(`${endpoint}: uniqueness validation failed`);
  }

  if (lastNonEmptyOffset === null) {
    if (actualTotal !== 0) {
      throw new Error(`${endpoint}: inconsistent empty collection state`);
    }
  }

  const totalMatches = reportedTotal === actualTotal;

  if (totalMatches) {
    console.log(`  ✓ API total matches actual count`);
  } else {
    console.warn(
      `  ⚠ API total mismatch: ` +
        `${reportedTotal} reported vs ${actualTotal} fetched`
    );
  }

  console.log(`  ✓ Unique IDs : ${seenIds.size}`);

  console.log(`  ✓ Complete collection : ${actualTotal} records`);

  return {
    reported_total: reportedTotal,

    total: actualTotal,

    results,

    pagination: {
      strategy: "offset",

      page_size_requested: PAGE_SIZE,

      termination: "empty_results",

      pages_fetched: pageCount,

      final_offset: offset,

      total_matches_reported_total: totalMatches,
    },
  };
}

async function fetchHealth() {
  console.log("\n─── Health check ───");

  try {
    const health = await request("/health");

    if (!health || typeof health !== "object") {
      throw new Error("/health returned an invalid response");
    }

    console.log(`  Status : ${health.status || "unknown"}`);

    if (health.server_time) {
      console.log(`  Server time : ${health.server_time}`);
    }

    if (health.reference_date) {
      console.log(`  Reference date : ${health.reference_date}`);
    }

    return health;
  } catch (error) {
    console.warn(
      `  /health unavailable: ` + `${sanitizeErrorMessage(error.message)}`
    );

    return null;
  }
}

function buildMetadata({ health, listings, rentals, projects }) {
  return {
    source: "Ivy Homes API",

    base_url: BASE_URL,

    fetched_at: new Date().toISOString(),

    pagination: {
      strategy: "offset",

      requested_page_size: PAGE_SIZE,

      termination_condition: "empty_results",

      note: "API-reported totals are retained as metadata and are not used as the pagination termination condition.",
    },

    health: health
      ? {
          status: health.status ?? null,

          server_time: health.server_time ?? null,

          timezone: health.timezone ?? null,

          reference_date: health.reference_date ?? null,
        }
      : null,

    collections: {
      listings: {
        reported_total: listings.reported_total,

        actual_total: listings.total,
      },

      rentals: {
        reported_total: rentals.reported_total,

        actual_total: rentals.total,
      },

      projects: {
        reported_total: projects.reported_total,

        actual_total: projects.total,
      },
    },
  };
}

async function main() {
  console.log("\n🏠 Ivy Homes Data Fetcher");

  console.log(`  BASE_URL : ${BASE_URL}`);

  console.log(`  USER     : ${EMAIL}`);

  console.log(`  PAGE_SIZE: ${PAGE_SIZE}`);

  requireConfiguration();

  await login();

  const health = await fetchHealth();

  const listings = await fetchAll("/v1/listings", {
    label: "listings",
  });

  const rentals = await fetchAll("/v1/rentals", {
    label: "rentals",
  });

  const projects = await fetchAll("/v1/projects", {
    label: "projects",
  });

  const metadata = buildMetadata({
    health,
    listings,
    rentals,
    projects,
  });

  const listingPath = writeDataset("listings.json", listings);

  const rentalPath = writeDataset("rentals.json", rentals);

  const projectPath = writeDataset("projects.json", projects);

  const metadataPath = writeDataset("fetch_metadata.json", metadata);

  if (health) {
    writeDataset("health.json", health);
  }

  console.log("\n─── Fetch complete ───");

  console.log(
    `  listings : ${listings.total} ` +
      `(API reported ${listings.reported_total})`
  );

  console.log(
    `  rentals  : ${rentals.total} ` +
      `(API reported ${rentals.reported_total})`
  );

  console.log(
    `  projects : ${projects.total} ` +
      `(API reported ${projects.reported_total})`
  );

  console.log("\nWritten:");

  console.log(`  ${listingPath}`);

  console.log(`  ${rentalPath}`);

  console.log(`  ${projectPath}`);

  console.log(`  ${metadataPath}`);

  console.log("\n✅ Complete dataset fetched and written successfully.");
}

main().catch((error) => {
  console.error("\n❌ Fetch failed");

  console.error(`   ${sanitizeErrorMessage(error?.message || error)}`);

  console.error("\nNo new dataset was accepted.");

  process.exitCode = 1;
});