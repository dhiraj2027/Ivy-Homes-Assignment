#!/usr/bin/env node

/**
 * Ivy Homes Analytics Analyzer
 *
 * Computes Q1-Q10 from the complete datasets produced by fetch_data.mjs.
 *
 * Important:
 * - Never trusts API `total` as the dataset size.
 * - Requires complete, duplicate-free local caches.
 * - Uses the fixed assignment reference timestamp.
 * - Uses carpet_area for Q6.
 * - Excludes objectively corrupt records before Q6.
 * - Does not classify weak signals as proof of fake listings.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");

const FILES = {
  listings: path.join(DATA_DIR, "listings.json"),
  rentals: path.join(DATA_DIR, "rentals.json"),
  projects: path.join(DATA_DIR, "projects.json"),
};

const REFERENCE_DATE = "2026-09-10T00:00:00+05:30";
const WINDOW_START = "2026-09-03T00:00:00+05:30";
const WINDOW_END = "2026-09-10T00:00:00+05:30";

async function readJson(filePath) {
  let raw;

  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(`Cannot read ${filePath}: ${error.message}`);
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${filePath}: invalid JSON`);
  }
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function string(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value) {
  return string(value).toLowerCase();
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;

  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatINR(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function listingId(record) {
  return string(record?.listing_id ?? record?.id);
}

function rentalId(record) {
  return string(record?.listing_id ?? record?.id);
}

function projectId(record) {
  return string(record?.project_id ?? record?.id);
}

function validateCollection(dataset, name, idGetter) {
  if (!dataset || !Array.isArray(dataset.results)) {
    throw new Error(`${name}: results[] is missing`);
  }

  const results = dataset.results;

  if (results.length === 0) {
    throw new Error(`${name}: dataset is empty`);
  }

  const ids = new Set();

  for (const [index, record] of results.entries()) {
    const id = idGetter(record);

    if (!id) {
      throw new Error(`${name}: record ${index} has no stable ID`);
    }

    if (ids.has(id)) {
      throw new Error(`${name}: duplicate ID detected: ${id}`);
    }

    ids.add(id);
  }

  if (typeof dataset.total !== "number" || dataset.total !== results.length) {
    throw new Error(
      `${name}: cache metadata mismatch. ` +
        `total=${dataset.total}, results=${results.length}`
    );
  }

  return {
    records: results,
    ids,
    reportedTotal:
      typeof dataset.reported_total === "number"
        ? dataset.reported_total
        : null,
    actualTotal: results.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Q4 — Corruption                                                            */
/* -------------------------------------------------------------------------- */

function getCorruptionReasons(record) {
  const reasons = [];

  const price = number(record.price);
  const carpet = number(record.carpet_area);
  const superBuilt = number(record.super_built_up_area);
  const bedroom = number(record.bedroom);
  const bathroom = number(record.bathroom);
  const floor = number(record.floor);
  const totalFloors = number(record.total_floors);

  if (price !== null && price <= 0) {
    reasons.push("non_positive_price");
  }

  if (
    normalize(record.property_type) !== "plot" &&
    carpet !== null &&
    superBuilt !== null &&
    superBuilt < carpet
  ) {
    reasons.push("super_built_up_area_less_than_carpet_area");
  }

  if (
    floor !== null &&
    totalFloors !== null &&
    totalFloors > 0 &&
    floor > totalFloors
  ) {
    reasons.push("floor_exceeds_total_floors");
  }

  if (bedroom === 0 && normalize(record.property_type) !== "plot") {
    reasons.push("zero_bedroom_non_plot_property");
  }

  if (bathroom === 0 && normalize(record.property_type) !== "plot") {
    reasons.push("zero_bathroom_non_plot_property");
  }

  return reasons;
}

function analyzeCorruption(listings) {
  return listings
    .map((listing) => ({
      listing_id: listing.listing_id,
      reasons: getCorruptionReasons(listing),
    }))
    .filter((item) => item.reasons.length > 0);
}

/* -------------------------------------------------------------------------- */
/* Q2 — Property identity                                                     */
/* -------------------------------------------------------------------------- */

function propertyFingerprint(record) {
  const latitude = number(record.latitude);
  const longitude = number(record.longitude);
  const bedroom = number(record.bedroom);

  if (latitude !== null && longitude !== null && bedroom !== null) {
    return JSON.stringify([latitude.toFixed(4), longitude.toFixed(4), bedroom]);
  }

  return JSON.stringify([
    normalize(record.apartment_name),
    normalize(record.locality),
    number(record.floor),
    number(record.carpet_area),
    bedroom,
  ]);
}

function analyzeUniqueProperties(listings) {
  const fingerprints = new Map();

  for (const listing of listings) {
    const fingerprint = propertyFingerprint(listing);

    if (!fingerprints.has(fingerprint)) {
      fingerprints.set(fingerprint, []);
    }

    fingerprints.get(fingerprint).push(listing.listing_id);
  }

  const duplicateGroups = [...fingerprints.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([fingerprint, ids]) => ({
      fingerprint,
      listing_ids: ids,
    }));

  return {
    unique_count: fingerprints.size,

    duplicate_groups: duplicateGroups,

    duplicate_listing_count: duplicateGroups.reduce(
      (sum, group) => sum + group.listing_ids.length,
      0
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Q8 — Dates                                                                 */
/* -------------------------------------------------------------------------- */

function parseListingDate(value) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}T/.test(raw) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
    return new Date(`${raw}+05:30`);
  }

  const date = new Date(raw);

  return Number.isNaN(date.getTime()) ? null : date;
}

/* -------------------------------------------------------------------------- */
/* Q9 — Fake listing investigation                                            */
/* -------------------------------------------------------------------------- */

function analyzeFakeCandidates(listings) {
  const contactNames = new Map();

  for (const listing of listings) {
    const contact = string(listing.posted_by_contact);

    const name = string(listing.posted_by_name);

    if (!contact || !name) {
      continue;
    }

    if (!contactNames.has(contact)) {
      contactNames.set(contact, new Set());
    }

    contactNames.get(contact).add(name);
  }

  const suspiciousContacts = new Map();

  for (const [contact, names] of contactNames) {
    if (names.size > 1) {
      suspiciousContacts.set(contact, [...names].sort());
    }
  }

  const candidates = [];

  for (const listing of listings) {
    const contact = string(listing.posted_by_contact);

    const names = suspiciousContacts.get(contact);

    if (!names) {
      continue;
    }

    candidates.push({
      listing_id: listing.listing_id,
      contact,
      listing_name: listing.posted_by_name,
      other_names: names.filter((name) => name !== listing.posted_by_name),
      reason: "same_contact_associated_with_multiple_names",
    });
  }

  return {
    suspiciousContacts: [...suspiciousContacts.entries()].map(
      ([contact, names]) => ({
        contact,
        names,
      })
    ),

    candidates,
  };
}

/* -------------------------------------------------------------------------- */
/* Findings                                                                   */
/* -------------------------------------------------------------------------- */

function buildFindings({
  listingsCollection,
  rentalsCollection,
  projectsCollection,
  propertyAnalysis,
  q10,
}) {
  const findings = [];

  const collections = [
    ["/v1/listings", listingsCollection],
    ["/v1/rentals", rentalsCollection],
    ["/v1/projects", projectsCollection],
  ];

  for (const [endpoint, collection] of collections) {
    if (
      collection.reportedTotal !== null &&
      collection.reportedTotal !== collection.actualTotal
    ) {
      findings.push({
        endpoint,

        category: "completeness",

        documented: "The collection total represents the available records.",

        actual:
          `The API reported total ` +
          `${collection.reportedTotal}, but complete ` +
          `offset pagination returned ` +
          `${collection.actualTotal} unique records.`,

        how_found:
          "Fetched the complete collection with offset pagination until an empty page and compared the unique record count with the API-reported total.",

        impact:
          "Using the API total as the dataset size can undercount records and produce incorrect analytics or pagination.",

        evidence: [],
      });
    }
  }

  findings.push({
    endpoint: "/v1/listings",

    category: "pagination",

    documented:
      "Collection pagination is documented with page/limit parameters.",

    actual:
      "The running API is reliably retrieved with offset/limit; page/skip behavior is not reliable and responses are capped at 50 records.",

    how_found:
      "Compared documented pagination with live API behavior while fetching the complete collection.",

    impact:
      "A client using page-based pagination can miss records or stop before the complete dataset is retrieved.",

    evidence: [],
  });

  findings.push({
    endpoint: "/auth/login",

    category: "auth",

    documented: "The login response documentation describes a token field.",

    actual: "The running API returns access_token and refresh_token fields.",

    how_found: "Verified the live login response used by the fetcher.",

    impact:
      "Reading token instead of access_token prevents authentication from working against the running API.",

    evidence: [],
  });

  findings.push({
    endpoint: "/v1/listings/{listing_id}",

    category: "undocumented_endpoint",

    documented:
      "The documented listing detail route differs from the running route.",

    actual:
      "The running API serves listing details from the plural /v1/listings/{listing_id} route.",

    how_found: "Verified the detail route against the running API.",

    impact: "Using the wrong route causes listing detail requests to fail.",

    evidence: [],
  });

  findings.push({
    endpoint: "/v1/saved",

    category: "undocumented_endpoint",

    documented:
      "Saved/favourite endpoint documentation differs from the running API contract.",

    actual:
      "The running API uses GET /v1/saved, POST /v1/saved with listing_id, and DELETE /v1/saved/{id}.",

    how_found:
      "Verified the live saved-listing endpoints used by the frontend client.",

    impact:
      "Using the documented contract can break saved-listing persistence.",

    evidence: [],
  });

  findings.push({
    endpoint: "/v1/analytics/summary",

    category: "missing_endpoint",

    documented: "Analytics summary is documented as an available endpoint.",

    actual:
      "The running API returned 404 for /v1/analytics/summary, so the assignment analytics are computed locally from the complete datasets.",

    how_found:
      "Requested the documented endpoint against the running API and received HTTP 404.",

    impact:
      "The frontend cannot depend on the documented analytics endpoint and needs a local analytics implementation.",

    evidence: [],
  });

  if (propertyAnalysis.duplicate_groups.length > 0) {
    findings.push({
      endpoint: "/v1/listings",

      category: "duplicates",

      documented: "Not specified.",

      actual:
        `${propertyAnalysis.duplicate_groups.length} ` +
        `duplicate property fingerprint groups were found ` +
        `across ${propertyAnalysis.duplicate_listing_count} ` +
        `listing records.`,

      how_found:
        "Constructed the assignment property fingerprint and grouped listings by property identity rather than listing_id.",

      impact:
        "Treating every listing_id as a unique property can overcount inventory in property-level analytics.",

      evidence: propertyAnalysis.duplicate_groups
        .slice(0, 20)
        .flatMap((group) => group.listing_ids),
    });
  }

  if (q10.length > 0) {
    findings.push({
      endpoint: "/v1/projects",

      category: "consistency",

      documented:
        "Project total_listings is expected to agree with the listings associated with the project.",

      actual:
        `${q10.length} projects have total_listings ` +
        `values that disagree with the actual listing count ` +
        `computed from the complete listings dataset.`,

      how_found:
        "Grouped all fetched listings by project_id and compared each count with projects.total_listings.",

      impact: "Project inventory counts shown in the UI can be incorrect.",

      evidence: q10.slice(0, 20).map((project) => project.project_id),
    });
  }

  return findings;
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  console.log("\n🏠 Ivy Homes Analytics Analyzer");

  console.log(`Reference date: ${REFERENCE_DATE}`);

  console.log(`Window: ${WINDOW_START} → ${WINDOW_END}`);

  const [listingsData, rentalsData, projectsData] = await Promise.all([
    readJson(FILES.listings),
    readJson(FILES.rentals),
    readJson(FILES.projects),
  ]);

  const listingsCollection = validateCollection(
    listingsData,
    "listings",
    listingId
  );

  const rentalsCollection = validateCollection(
    rentalsData,
    "rentals",
    rentalId
  );

  const projectsCollection = validateCollection(
    projectsData,
    "projects",
    projectId
  );

  const listings = listingsCollection.records;

  const rentals = rentalsCollection.records;

  const projects = projectsCollection.records;

  console.log("\n─── Dataset validation ───");

  console.log(`Listings : ${listings.length} unique`);

  console.log(`Rentals  : ${rentals.length} unique`);

  console.log(`Projects : ${projects.length} unique`);

  if (
    listingsCollection.reportedTotal !== null &&
    listingsCollection.reportedTotal !== listings.length
  ) {
    console.log(
      `⚠ Listings API total mismatch: ` +
        `${listingsCollection.reportedTotal} → ` +
        `${listings.length}`
    );
  }

  if (
    rentalsCollection.reportedTotal !== null &&
    rentalsCollection.reportedTotal !== rentals.length
  ) {
    console.log(
      `⚠ Rentals API total mismatch: ` +
        `${rentalsCollection.reportedTotal} → ` +
        `${rentals.length}`
    );
  }

  if (
    projectsCollection.reportedTotal !== null &&
    projectsCollection.reportedTotal !== projects.length
  ) {
    console.log(
      `⚠ Projects API total mismatch: ` +
        `${projectsCollection.reportedTotal} → ` +
        `${projects.length}`
    );
  }

  /* Q1 */

  const q1 = listings.length;

  /* Q2 */

  const propertyAnalysis = analyzeUniqueProperties(listings);

  const q2 = propertyAnalysis.unique_count;

  /* Q3 */

  const activeListings = listings.filter((listing) => listing.is_live === true);

  const q3 = activeListings.length;

  /* Q4 */

  const corrupt = analyzeCorruption(listings);

  const corruptIds = new Set(corrupt.map((item) => item.listing_id));

  const q4 = corrupt.length;

  /* Q5 */

  const golfCourseRentals = rentals.filter(
    (rental) => normalize(rental.locality) === "golf course road"
  );

  const q5 = golfCourseRentals.reduce(
    (sum, rental) => sum + (number(rental.price) ?? 0),
    0
  );

  /* Q6 */

  const q6Candidates = activeListings.filter(
    (listing) =>
      listing.bedroom === 2 &&
      !corruptIds.has(listing.listing_id) &&
      number(listing.carpet_area) !== null &&
      listing.carpet_area > 0 &&
      number(listing.price) !== null &&
      listing.price > 0
  );

  const pricePerSqft = q6Candidates.map(
    (listing) => listing.price / listing.carpet_area
  );

  const q6Sum = pricePerSqft.reduce((sum, value) => sum + value, 0);

  const q6 =
    pricePerSqft.length === 0 ? null : round(q6Sum / pricePerSqft.length, 2);

  /* Q7 */

  const projectPriceRanking = projects
    .map((project) => ({
      project_id: project.project_id,

      apartment_name: project.apartment_name,

      locality: project.locality,

      price_max: number(project.price_max),

      price_min: number(project.price_min),
    }))
    .filter((project) => project.price_max !== null)
    .sort((a, b) => b.price_max - a.price_max);

  const costliestProject = projectPriceRanking[0] ?? null;

  /* Q8 */

  const start = new Date(WINDOW_START);

  const end = new Date(WINDOW_END);

  const postedInSevenDays = listings.filter((listing) => {
    const date = parseListingDate(listing.posted_at);

    return date !== null && date >= start && date < end;
  });

  const q8 = postedInSevenDays.length;

  /* Q9 */

  const fakeAnalysis = analyzeFakeCandidates(listings);

  const q9 = {
    confirmed_fake_listing_ids: [],

    suspicious_candidates: fakeAnalysis.candidates,

    methodology:
      "No listing is classified as fake solely from weak signals. " +
      "Repeated contacts associated with multiple names are reported " +
      "as suspicious evidence requiring corroboration.",
  };

  /* Q10 */

  const listingsByProject = new Map();

  for (const listing of listings) {
    const project = string(listing.project_id);

    if (!project) {
      continue;
    }

    listingsByProject.set(project, (listingsByProject.get(project) ?? 0) + 1);
  }

  const q10 = [];

  for (const project of projects) {
    const actual = listingsByProject.get(project.project_id) ?? 0;

    const reported = number(project.total_listings);

    if (reported === null || reported !== actual) {
      q10.push({
        project_id: project.project_id,

        apartment_name: project.apartment_name,

        reported_total_listings: reported,

        actual_listing_count: actual,

        difference: actual - (reported ?? 0),
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Print                                                                   */
  /* ---------------------------------------------------------------------- */

  console.log("\n════════════════════════════════════");

  console.log("             Q1 – Q10");

  console.log("════════════════════════════════════");

  console.log(`Q1 Total listing records : ${q1}`);

  console.log(`Q2 Unique properties     : ${q2}`);

  console.log(
    `   Duplicate fingerprint groups : ` +
      `${propertyAnalysis.duplicate_groups.length}`
  );

  console.log(`Q3 Active listings       : ${q3}`);

  console.log(`Q4 Corrupt listings      : ${q4}`);

  console.log(`Q5 Monthly Golf Course Road rent : ` + `${formatINR(q5)}`);

  console.log(`Q6 Mean live 2BHK price/sqft : ₹${q6}`);

  console.log(`   Q6 eligible records : ` + `${q6Candidates.length}`);

  console.log(`   Q6 arithmetic sum   : ${q6Sum}`);

  if (costliestProject) {
    console.log(
      `Q7 Costliest project : ` +
        `${costliestProject.project_id} ` +
        `(${costliestProject.apartment_name}) ` +
        `price_max=${costliestProject.price_max}`
    );
  } else {
    console.log("Q7 Costliest project : unavailable");
  }

  console.log(`Q8 Listings posted in 7-day window : ${q8}`);

  console.log(
    `Q9 Confirmed fake listings : ` + `${q9.confirmed_fake_listing_ids.length}`
  );

  console.log(
    `Q9 Suspicious candidates : ` + `${q9.suspicious_candidates.length}`
  );

  console.log(`Q10 Incorrect project listing counts : ` + `${q10.length}`);

  /* Q7 ranking audit */

  console.log("\n─── Q7 Top 10 projects ───");

  for (const [index, project] of projectPriceRanking.slice(0, 10).entries()) {
    console.log(
      `  ${index + 1}. ` +
        `${project.project_id} ` +
        `${project.apartment_name} ` +
        `price_max=${project.price_max}`
    );
  }

  /* Q4 */

  console.log("\n─── Q4 Corrupt IDs ───");

  for (const item of corrupt) {
    console.log(`  ${item.listing_id} → ` + item.reasons.join(", "));
  }

  /* Q10 */

  console.log("\n─── Q10 Project mismatches ───");

  for (const item of q10) {
    console.log(
      `  ${item.project_id} ` +
        `${item.apartment_name}: ` +
        `reported=${item.reported_total_listings}, ` +
        `actual=${item.actual_listing_count}`
    );
  }

  /* ---------------------------------------------------------------------- */
  /* JSON                                                                    */
  /* ---------------------------------------------------------------------- */

  const findings = buildFindings({
    listingsCollection,
    rentalsCollection,
    projectsCollection,
    propertyAnalysis,
    q10,
  });

  const output = {
    generated_at: new Date().toISOString(),

    reference_date: REFERENCE_DATE,

    window: {
      start: WINDOW_START,
      end: WINDOW_END,
    },

    dataset: {
      listings: {
        reported_total: listingsCollection.reportedTotal,

        actual_total: listingsCollection.actualTotal,
      },

      rentals: {
        reported_total: rentalsCollection.reportedTotal,

        actual_total: rentalsCollection.actualTotal,
      },

      projects: {
        reported_total: projectsCollection.reportedTotal,

        actual_total: projectsCollection.actualTotal,
      },
    },

    answers: {
      q1_total_listing_records: q1,

      q2_unique_properties: {
        count: q2,

        duplicate_fingerprint_groups: propertyAnalysis.duplicate_groups,

        duplicate_listing_count: propertyAnalysis.duplicate_listing_count,
      },

      q3_active_listings: q3,

      q4_corrupt_listings: {
        count: q4,

        ids: corrupt.map((item) => item.listing_id),

        details: corrupt,
      },

      q5_total_monthly_rent_golf_course_road: {
        count: golfCourseRentals.length,

        total_inr: q5,
      },

      q6_mean_live_2bhk_price_per_sqft: {
        eligible_records: q6Candidates.length,

        arithmetic_sum: q6Sum,

        mean_inr_per_sqft: q6,

        calculation:
          "For every live, exactly-2-BHK, non-corrupt listing with positive price and carpet area, calculate price/carpet_area; then take the arithmetic mean and round the final mean to 2 decimals.",
      },

      q7_costliest_project: {
        winner: costliestProject,

        top_10: projectPriceRanking.slice(0, 10),

        unit: "Raw project price_max units as supplied by the dataset; no unsupported currency conversion is applied.",
      },

      q8_listings_posted_in_previous_7_days: {
        count: q8,

        start: WINDOW_START,

        end: WINDOW_END,

        listing_ids: postedInSevenDays.map((listing) => listing.listing_id),
      },

      q9_fake_listings: q9,

      q10_incorrect_project_listing_counts: {
        count: q10.length,

        projects: q10,
      },
    },

    methodology: {
      pagination:
        "Offset pagination until an empty results page. API reported totals are advisory because live API totals do not match retrievable unique records.",

      q2: "A property fingerprint is constructed from physical/property attributes. listing_id is not used as identity. Duplicate fingerprint groups are explicitly reported.",

      q4: "Only objectively impossible structural/numeric records are classified as corrupt.",

      q6: "Live listings, exactly 2 BHK, non-corrupt, positive price and positive carpet area. Price per sqft is calculated per listing before taking the arithmetic mean.",

      q7: "Projects are ranked by raw numeric price_max. No unsupported unit conversion is performed.",

      q8: "Seven-day half-open interval [2026-09-03T00:00:00+05:30, 2026-09-10T00:00:00+05:30). Bare listing timestamps are interpreted in Asia/Kolkata.",

      q9: "No weak heuristic is treated as proof of a fake listing.",

      q10: "Actual listing count is computed from the complete listings dataset grouped by project_id and compared with projects.total_listings.",
    },

    findings,
  };

  const outputPath = path.join(DATA_DIR, "analysis.json");

  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");

  console.log(`\n✓ Analysis written to ${outputPath}`);
}

main().catch((error) => {
  console.error("\n❌ Analysis failed");

  console.error(`   ${error.message}`);

  process.exit(1);
});