import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  XCircle,
} from "lucide-react";

import {
  getCachedHealth,
  getCachedListings,
  getCachedProjects,
  getCachedRentals,
} from "../api/dataCache.js";

import { formatPrice } from "../utils/formatters.js";

const ASSIGNED_LOCALITY = "Golf Course Road";

const REFERENCE_TIMESTAMP = "2026-09-10T00:00:00+05:30";

const WINDOW_START = "2026-09-03T00:00:00+05:30";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function finiteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function positiveNumber(value) {
  const number = finiteNumber(value);

  return number !== null && number > 0 ? number : null;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }

    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }

  return null;
}

function sameText(a, b) {
  return normalizeText(a).toLowerCase() === normalizeText(b).toLowerCase();
}

function formatCount(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatCurrency(value) {
  const number = finiteNumber(value);

  if (number === null) {
    return "—";
  }

  return formatPrice(number);
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/*
 * Q2 identifies physical properties rather than projects.
 *
 * Coordinates are the strongest available physical-location
 * signal. Four decimal places are used to absorb small coordinate
 * differences between duplicate listing records.
 */
function getPropertyIdentity(listing) {
  const latitude = finiteNumber(listing?.latitude);

  const longitude = finiteNumber(listing?.longitude);

  const bedroom = finiteNumber(listing?.bedroom);

  if (
    latitude !== null &&
    longitude !== null &&
    (latitude !== 0 || longitude !== 0)
  ) {
    return [latitude.toFixed(4), longitude.toFixed(4), bedroom ?? ""].join("|");
  }

  return [
    normalizeText(listing?.apartment_name).toLowerCase(),
    normalizeText(listing?.locality).toLowerCase(),
    listing?.floor ?? "",
    listing?.carpet_area ?? "",
    bedroom ?? "",
  ].join("|");
}

/*
 * Q4 follows the verified corruption rules from the
 * assignment analysis:
 * - non-positive price
 * - SBA smaller than carpet area for non-plots
 * - floor above total floors
 * - zero bedroom for non-plots
 * - zero bathroom for non-plots
 */
function isCorruptListing(listing) {
  const price = finiteNumber(listing?.price);

  const carpetArea = finiteNumber(listing?.carpet_area);

  const superBuiltUpArea = finiteNumber(listing?.super_built_up_area);

  const floor = finiteNumber(listing?.floor);

  const totalFloors = finiteNumber(listing?.total_floors);

  const bedroom = finiteNumber(listing?.bedroom);

  const bathroom = finiteNumber(listing?.bathroom);

  const propertyType = normalizeText(listing?.property_type).toLowerCase();

  const isPlot = propertyType === "plot";

  if (price !== null && price <= 0) {
    return true;
  }

  if (
    !isPlot &&
    carpetArea !== null &&
    superBuiltUpArea !== null &&
    superBuiltUpArea < carpetArea
  ) {
    return true;
  }

  if (
    floor !== null &&
    totalFloors !== null &&
    totalFloors > 0 &&
    floor > totalFloors
  ) {
    return true;
  }

  if (bedroom === 0 && !isPlot) {
    return true;
  }

  if (bathroom === 0 && !isPlot) {
    return true;
  }

  return false;
}

function detectConfirmedFakeListings() {
  return [];
}

function calculateAnswers({ listings, rentals, projects }) {
  const totalListingRecords = listings.length;

  const propertyIds = new Set();

  for (const listing of listings) {
    propertyIds.add(getPropertyIdentity(listing));
  }

  const uniqueProperties = propertyIds.size;

  const activeListings = listings.filter(
    (listing) => normalizeBoolean(listing?.is_live) === true
  ).length;

  const corruptListings = listings.filter(isCorruptListing);

  const golfCourseRoadRentals = rentals.filter((rental) =>
    sameText(rental?.locality, ASSIGNED_LOCALITY)
  );

  const totalMonthlyRent = golfCourseRoadRentals.reduce((sum, rental) => {
    const rent = positiveNumber(rental?.price);

    return sum + (rent || 0);
  }, 0);

  const fakeListingIds = new Set(
    detectConfirmedFakeListings().map((listing) =>
      normalizeText(listing?.listing_id)
    )
  );

  const eligible2BhkListings = listings.filter((listing) => {
    const bedroom = finiteNumber(listing?.bedroom);

    const price = positiveNumber(listing?.price);

    const carpetArea = positiveNumber(listing?.carpet_area);

    const listingId = normalizeText(listing?.listing_id);

    return (
      bedroom === 2 &&
      normalizeBoolean(listing?.is_live) === true &&
      price !== null &&
      carpetArea !== null &&
      !isCorruptListing(listing) &&
      !fakeListingIds.has(listingId)
    );
  });

  const pricePerSqftValues = eligible2BhkListings.map(
    (listing) => Number(listing.price) / Number(listing.carpet_area)
  );

  const meanPricePerSqft =
    pricePerSqftValues.length > 0
      ? pricePerSqftValues.reduce((sum, value) => sum + value, 0) /
        pricePerSqftValues.length
      : null;

  const costliestProject =
    projects
      .map((project) => ({
        project,
        priceMax: positiveNumber(project?.price_max),
      }))
      .filter(({ priceMax }) => priceMax !== null)
      .sort((a, b) => b.priceMax - a.priceMax)[0]?.project || null;

  const referenceDate = parseDate(REFERENCE_TIMESTAMP);

  const windowStartDate = parseDate(WINDOW_START);

  const listingsPostedInWindow = listings.filter((listing) => {
    const postedAt = parseDate(listing?.posted_at);

    if (!postedAt || !referenceDate || !windowStartDate) {
      return false;
    }

    return postedAt >= windowStartDate && postedAt < referenceDate;
  });

  const confirmedFakeListings = detectConfirmedFakeListings();

  const actualListingsByProject = new Map();

  for (const listing of listings) {
    const projectId = normalizeText(listing?.project_id);

    if (!projectId) {
      continue;
    }

    actualListingsByProject.set(
      projectId,
      (actualListingsByProject.get(projectId) || 0) + 1
    );
  }

  const projectCountMismatches = projects.filter((project) => {
    const projectId = normalizeText(project?.project_id);

    const reported = finiteNumber(project?.total_listings);

    if (!projectId || reported === null) {
      return false;
    }

    const actual = actualListingsByProject.get(projectId) || 0;

    return reported !== actual;
  });

  return {
    totalListingRecords,
    uniqueProperties,
    activeListings,
    corruptListings,
    corruptListingCount: corruptListings.length,
    golfCourseRoadRentals: golfCourseRoadRentals.length,
    totalMonthlyRent,
    eligible2BhkListings,
    meanPricePerSqft,
    costliestProject,
    listingsPostedInWindow,
    confirmedFakeListings,
    projectCountMismatches,
    actualListingsByProject,
  };
}

function LoadingState({ progress }) {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Insights</h1>

        <p className="mt-1 text-sm text-gray-500">
          Computing analytics from the complete dataset.
        </p>

        {progress && (
          <p className="mt-2 font-mono text-xs text-gray-400">{progress}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({
          length: 4,
        }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({
          length: 6,
        }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-xl border border-gray-200 bg-white"
          />
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, description, icon: Icon }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold tabular-nums text-navy-900">
            {value}
          </p>

          {description && (
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          )}
        </div>

        {Icon && (
          <Icon size={20} className="text-gray-300" aria-hidden="true" />
        )}
      </div>
    </section>
  );
}

function AnswerCard({ number, question, answer, detail, children }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">
          {number}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-5 text-gray-800">
            {question}
          </h2>

          <p className="mt-2 text-2xl font-bold tabular-nums text-navy-900">
            {answer}
          </p>

          {detail && (
            <p className="mt-2 text-xs leading-5 text-gray-500">{detail}</p>
          )}

          {children}
        </div>
      </div>
    </section>
  );
}

function Badge({ children, variant = "neutral" }) {
  const classes = {
    neutral: "bg-gray-100 text-gray-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classes[variant]}`}
    >
      {children}
    </span>
  );
}

export default function Insights() {
  const [health, setHealth] = useState(null);

  const [listings, setListings] = useState([]);

  const [rentals, setRentals] = useState([]);

  const [projects, setProjects] = useState([]);

  const [loading, setLoading] = useState(true);

  const [progress, setProgress] = useState("");

  const [error, setError] = useState("");

  const loadInsights = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    setProgress("Loading complete datasets…");

    try {
      const healthPromise = getCachedHealth({
        signal,
      }).catch((healthError) => {
        if (healthError?.name === "AbortError") {
          throw healthError;
        }

        return null;
      });

      const listingsPromise = getCachedListings({
        signal,
        force: false,
      });

      const rentalsPromise = getCachedRentals({
        signal,
        force: false,
      });

      const projectsPromise = getCachedProjects({
        signal,
        force: false,
      });

      const [healthResult, listingResult, rentalResult, projectResult] =
        await Promise.all([
          healthPromise,
          listingsPromise,
          rentalsPromise,
          projectsPromise,
        ]);

      if (signal?.aborted) {
        return;
      }

      if (!listingResult || !Array.isArray(listingResult.results)) {
        throw new Error("Listings response could not be fully loaded.");
      }

      if (!rentalResult || !Array.isArray(rentalResult.results)) {
        throw new Error("Rentals response could not be fully loaded.");
      }

      if (!projectResult || !Array.isArray(projectResult.results)) {
        throw new Error("Projects response could not be fully loaded.");
      }

      setHealth(healthResult);

      setListings(listingResult.results);

      setRentals(rentalResult.results);

      setProjects(projectResult.results);

      setProgress(
        `Loaded ${listingResult.results.length.toLocaleString(
          "en-IN"
        )} listings, ${rentalResult.results.length.toLocaleString(
          "en-IN"
        )} rentals and ${projectResult.results.length.toLocaleString(
          "en-IN"
        )} projects.`
      );
    } catch (err) {
      if (err?.name === "AbortError" || signal?.aborted) {
        return;
      }

      setError(
        err?.message || "Unable to load the complete analytics dataset."
      );

      setProgress("");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadInsights(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadInsights]);

  const answers = useMemo(() => {
    if (loading) {
      return null;
    }

    return calculateAnswers({
      listings,
      rentals,
      projects,
    });
  }, [loading, listings, rentals, projects]);

  const localityBreakdown = useMemo(() => {
    const counts = new Map();

    for (const listing of listings) {
      const locality = normalizeText(listing?.locality) || "Unknown";

      counts.set(locality, (counts.get(locality) || 0) + 1);
    }

    return [...counts.entries()]
      .map(([locality, count]) => ({
        locality,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [listings]);

  const bhkBreakdown = useMemo(() => {
    const counts = new Map();

    for (const listing of listings) {
      const bedroom = finiteNumber(listing?.bedroom);

      if (bedroom === null) {
        continue;
      }

      counts.set(bedroom, (counts.get(bedroom) || 0) + 1);
    }

    return [...counts.entries()]
      .map(([bedroom, count]) => ({
        bedroom,
        count,
      }))
      .sort((a, b) => a.bedroom - b.bedroom);
  }, [listings]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <LoadingState progress={progress} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section
          className="rounded-xl border border-red-200 bg-white p-6"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className="shrink-0 text-red-500"
              aria-hidden="true"
            />

            <div>
              <h1 className="font-semibold text-red-800">
                Insights could not be loaded
              </h1>

              <p className="mt-1 text-sm text-red-700">{error}</p>

              <button
                type="button"
                onClick={() => {
                  const controller = new AbortController();

                  loadInsights(controller.signal);
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2"
              >
                <RefreshCw size={15} aria-hidden="true" />
                Retry
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!answers) {
    return null;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy-900">Insights</h1>

            <p className="mt-1 text-sm text-gray-500">
              Analytics computed from the complete retrievable dataset.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="success">
              {formatCount(listings.length)} listings
            </Badge>

            <Badge>{formatCount(rentals.length)} rentals</Badge>

            <Badge>{formatCount(projects.length)} projects</Badge>
          </div>
        </div>
      </header>

      <section className="mb-8">
        <div className="mb-4 flex items-center gap-2">
          <Database size={18} className="text-gray-400" aria-hidden="true" />

          <h2 className="text-lg font-semibold text-gray-800">
            Dataset overview
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Listing records"
            value={formatCount(listings.length)}
            description="Complete paginated collection"
          />

          <StatCard
            label="Rental records"
            value={formatCount(rentals.length)}
            description="Complete paginated collection"
          />

          <StatCard
            label="Project records"
            value={formatCount(projects.length)}
            description="Complete paginated collection"
          />

          <StatCard
            label="Golf Course Road rentals"
            value={formatCount(answers.golfCourseRoadRentals)}
            description="Matching rental records"
          />
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Assignment answers
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            Calculated locally after exhaustive pagination. API-reported totals
            are retained separately and are not used as the termination
            condition.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AnswerCard
            number="1"
            question="What is the total number of listing records?"
            answer={formatCount(answers.totalListingRecords)}
            detail="Count of all listing records retrieved from the complete listings collection."
          />

          <AnswerCard
            number="2"
            question="How many unique properties are represented?"
            answer={formatCount(answers.uniqueProperties)}
            detail="Listings are grouped by rounded latitude/longitude and bedroom when coordinates are available. Records without usable coordinates use apartment name, locality, floor, carpet area and bedroom as a fallback identity."
          />

          <AnswerCard
            number="3"
            question="How many listings are currently active?"
            answer={formatCount(answers.activeListings)}
            detail="Only listings whose is_live value is explicitly true are counted as active."
          />

          <AnswerCard
            number="4"
            question="How many listings are corrupt?"
            answer={formatCount(answers.corruptListingCount)}
            detail="Validation checks non-positive price, impossible area relationships, floor consistency, and zero-bedroom or zero-bathroom non-plot records."
          >
            {answers.corruptListingCount > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <XCircle
                  size={15}
                  className="text-red-500"
                  aria-hidden="true"
                />

                <Badge variant="danger">
                  {answers.corruptListingCount} records flagged
                </Badge>
              </div>
            )}
          </AnswerCard>

          <AnswerCard
            number="5"
            question="What is the total monthly rent on Golf Course Road?"
            answer={formatCurrency(answers.totalMonthlyRent)}
            detail={`${formatCount(
              answers.golfCourseRoadRentals
            )} rental records match the assigned locality "${ASSIGNED_LOCALITY}".`}
          />

          <AnswerCard
            number="6"
            question="What is the mean price/sqft for live 2BHK listings using carpet area?"
            answer={
              answers.meanPricePerSqft === null
                ? "—"
                : `₹${answers.meanPricePerSqft.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}/sqft`
            }
            detail={`${formatCount(
              answers.eligible2BhkListings.length
            )} eligible live 2BHK listings were included. The arithmetic mean is calculated from unrounded per-listing ratios and rounded only for display.`}
          />

          <AnswerCard
            number="7"
            question="Which project is the costliest?"
            answer={
              answers.costliestProject
                ? normalizeText(answers.costliestProject.apartment_name) ||
                  normalizeText(answers.costliestProject.name) ||
                  normalizeText(answers.costliestProject.project_id) ||
                  "Unnamed project"
                : "—"
            }
            detail={
              answers.costliestProject
                ? `Highest project price_max in the retrieved dataset: ${formatCurrency(
                    answers.costliestProject.price_max
                  )}.`
                : "No valid positive project price_max was available."
            }
          />

          <AnswerCard
            number="8"
            question="How many listings were posted in the 7 days before the reference timestamp?"
            answer={formatCount(answers.listingsPostedInWindow.length)}
            detail={`Window: [${WINDOW_START}, ${REFERENCE_TIMESTAMP}). posted_at values are interpreted as timestamps and the upper boundary is exclusive.`}
          />

          <AnswerCard
            number="9"
            question="How many listings are confirmed fake?"
            answer={formatCount(answers.confirmedFakeListings.length)}
            detail="No listing is classified as confirmed fake because the available evidence does not establish that classification with sufficient precision. Suspicious contact-number reuse is not treated as proof of fraud."
          >
            <div className="mt-3 flex items-center gap-2">
              <CheckCircle2
                size={15}
                className="text-emerald-500"
                aria-hidden="true"
              />

              <Badge variant="success">Conservative classification</Badge>
            </div>
          </AnswerCard>

          <AnswerCard
            number="10"
            question="How many projects have incorrect listing counts?"
            answer={formatCount(answers.projectCountMismatches.length)}
            detail="Each project's reported total_listings is compared with the exhaustive count of listing records grouped by project_id."
          >
            {answers.projectCountMismatches.length > 0 && (
              <div className="mt-3">
                <Badge variant="warning">
                  {answers.projectCountMismatches.length} mismatches
                </Badge>
              </div>
            )}
          </AnswerCard>
        </div>
      </section>

      {answers.corruptListings.length > 0 && (
        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">
            Corrupt listing evidence
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            Objective validation flags only.
          </p>

          <div className="mt-4 max-h-80 overflow-auto rounded-lg bg-gray-50">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-gray-100 text-gray-500">
                <tr>
                  <th className="px-3 py-2">Listing</th>

                  <th className="px-3 py-2">Price</th>

                  <th className="px-3 py-2">Carpet</th>

                  <th className="px-3 py-2">SBA</th>

                  <th className="px-3 py-2">Floor</th>

                  <th className="px-3 py-2">Total floors</th>
                </tr>
              </thead>

              <tbody>
                {answers.corruptListings.slice(0, 100).map((listing) => (
                  <tr
                    key={listing.listing_id}
                    className="border-t border-gray-100"
                  >
                    <td className="px-3 py-2 font-mono text-gray-700">
                      {listing.listing_id}
                    </td>

                    <td className="px-3 py-2">
                      {finiteNumber(listing.price) ?? "—"}
                    </td>

                    <td className="px-3 py-2">
                      {finiteNumber(listing.carpet_area) ?? "—"}
                    </td>

                    <td className="px-3 py-2">
                      {finiteNumber(listing.super_built_up_area) ?? "—"}
                    </td>

                    <td className="px-3 py-2">
                      {finiteNumber(listing.floor) ?? "—"}
                    </td>

                    <td className="px-3 py-2">
                      {finiteNumber(listing.total_floors) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {answers.corruptListings.length > 100 && (
            <p className="mt-2 text-xs text-gray-400">
              Showing the first 100 flagged records.
            </p>
          )}
        </section>
      )}

      {answers.projectCountMismatches.length > 0 && (
        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">
            Project listing-count mismatches
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            Project-reported total_listings compared with exhaustive listing
            records grouped by project_id.
          </p>

          <div className="mt-4 max-h-80 overflow-auto rounded-lg bg-gray-50">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-gray-100 text-gray-500">
                <tr>
                  <th className="px-3 py-2">Project</th>

                  <th className="px-3 py-2">Project name</th>

                  <th className="px-3 py-2">Reported</th>

                  <th className="px-3 py-2">Actual</th>
                </tr>
              </thead>

              <tbody>
                {answers.projectCountMismatches.slice(0, 100).map((project) => {
                  const projectId = normalizeText(project?.project_id);

                  const actual =
                    answers.actualListingsByProject.get(projectId) || 0;

                  return (
                    <tr key={projectId} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono text-gray-700">
                        {projectId}
                      </td>

                      <td className="px-3 py-2 text-gray-700">
                        {normalizeText(project?.apartment_name) || "—"}
                      </td>

                      <td className="px-3 py-2">{project.total_listings}</td>

                      <td className="px-3 py-2 font-semibold">
                        {formatCount(actual)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {answers.projectCountMismatches.length > 100 && (
            <p className="mt-2 text-xs text-gray-400">
              Showing the first 100 mismatched projects.
            </p>
          )}
        </section>
      )}

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800">Top localities</h2>

          <div className="mt-4 space-y-3">
            {localityBreakdown.map(({ locality, count }) => {
              const percentage =
                listings.length > 0 ? (count / listings.length) * 100 : 0;

              return (
                <div key={locality}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-gray-600">{locality}</span>

                    <span className="shrink-0 font-semibold text-gray-700">
                      {formatCount(count)}
                    </span>
                  </div>

                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-navy-900"
                      style={{
                        width: `${Math.min(percentage, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800">Bedroom distribution</h2>

          <div className="mt-4 space-y-3">
            {bhkBreakdown.map(({ bedroom, count }) => {
              const max = Math.max(
                ...bhkBreakdown.map((item) => item.count),
                1
              );

              const percentage = (count / max) * 100;

              return (
                <div key={bedroom}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-gray-600">
                      {bedroom === 0 ? "0 BHK" : `${bedroom} BHK`}
                    </span>

                    <span className="font-semibold text-gray-700">
                      {formatCount(count)}
                    </span>
                  </div>

                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.min(percentage, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-5">
        <h2 className="font-semibold text-gray-800">
          Methodology & API discrepancies
        </h2>

        <div className="mt-3 space-y-2 text-xs leading-5 text-gray-600">
          <p>
            <strong>Pagination:</strong> The running API uses offset/limit
            pagination. Complete analysis continues until an empty page rather
            than trusting the API's reported total.
          </p>

          <p>
            <strong>Remote analytics:</strong> The tested{" "}
            <code>/v1/analytics/summary</code> endpoint returned 404, so the ten
            assignment answers are calculated locally.
          </p>

          <p>
            <strong>Q2:</strong> Unique properties are identified using
            physical-location information when available rather than treating
            project_id as a property identifier.
          </p>

          <p>
            <strong>Q9:</strong> Reused contact numbers can be suspicious, but
            they are not sufficient evidence to classify a listing as fake. The
            UI therefore reports only confirmed findings.
          </p>

          <p>
            <strong>Q10:</strong> Project listing-count validation is calculated
            from the exhaustive listings dataset grouped by project_id, not from
            a paginated endpoint's reported total.
          </p>

          {health && (
            <p>
              <strong>API health:</strong>{" "}
              {normalizeText(health.status) || "available"}
              {health.reference_date
                ? ` · reference date ${health.reference_date}`
                : ""}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}