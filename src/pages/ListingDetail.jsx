import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Heart,
  MapPin,
  Phone,
  Shield,
} from "lucide-react";

import {
  addFavourite,
  getFavourites,
  getListing,
  removeFavourite,
} from "../api/client.js";

import { useAuth } from "../context/AuthContext.jsx";

import {
  formatArea,
  formatDate,
  formatPrice,
  formatPricePerSqft,
  formatRelative,
  titleCase,
} from "../utils/formatters.js";

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function normalizeBoolean(value, fallback = null) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

function Stat({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-2.5 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>

      <span className="text-right text-sm font-medium text-gray-900">
        {hasValue(value) ? value : "—"}
      </span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse px-4 py-8">
      <div className="mb-6 h-6 w-32 rounded bg-gray-200" />

      <div className="space-y-4 rounded-xl bg-white p-6">
        <div className="h-8 w-3/4 rounded bg-gray-200" />
        <div className="h-4 w-1/2 rounded bg-gray-100" />
        <div className="mt-4 h-12 w-1/3 rounded bg-gray-200" />
      </div>
    </div>
  );
}

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { isAuthenticated } = useAuth();

  const [listing, setListing] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [saved, setSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadListing() {
      setLoading(true);
      setError("");
      setSaveError("");
      setSaved(false);

      try {
        if (!id) {
          throw new Error("Listing ID is missing.");
        }

        const data = await getListing(id);

        if (cancelled) {
          return;
        }

        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("Invalid listing response from the API.");
        }

        setListing(data);

        if (isAuthenticated) {
          try {
            const favourites = await getFavourites();

            if (cancelled) {
              return;
            }

            const results = Array.isArray(favourites?.results)
              ? favourites.results
              : Array.isArray(favourites)
              ? favourites
              : [];

            const isSaved = results.some(
              (item) =>
                String(item?.listing_id ?? item?.id ?? "") === String(id)
            );

            setSaved(isSaved);
          } catch {
            if (!cancelled) {
              setSaved(false);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setListing(null);
          setError(err?.message || "Could not load this listing.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadListing();

    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated]);

  const toggleSave = async () => {
    if (saveLoading) {
      return;
    }

    if (!isAuthenticated) {
      navigate("/login", {
        state: {
          from:
            `${location.pathname}` + `${location.search}` + `${location.hash}`,
        },
      });

      return;
    }

    if (!id) {
      setSaveError("Listing ID is missing.");
      return;
    }

    setSaveLoading(true);
    setSaveError("");

    const normalizedId = String(id);

    try {
      if (saved) {
        await removeFavourite(normalizedId);
        setSaved(false);
      } else {
        await addFavourite(normalizedId);
        setSaved(true);
      }
    } catch (err) {
      setSaveError(err?.message || "Could not update saved listings.");
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (error || !listing) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1 rounded text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to listings
        </Link>

        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700"
        >
          <AlertTriangle
            size={24}
            aria-hidden="true"
            className="mx-auto mb-2"
          />

          <p className="font-medium">Could not load listing</p>

          <p className="mt-1 text-sm">{error || "Listing not found."}</p>
        </div>
      </div>
    );
  }

  const {
    listing_id,
    listing_url,
    website,
    apartment_name,
    locality,
    property_type,
    bedroom,
    bathroom,
    balcony,
    floor,
    total_floors,
    furnishing,
    facing_direction,
    covered_parking,
    price,
    carpet_area,
    super_built_up_area,
    latitude,
    longitude,
    posted_by,
    posted_by_name,
    posted_by_contact,
    project_id,
    description,
    posted_at,
    is_verified,
    is_live,
  } = listing;

  const liveStatus = normalizeBoolean(is_live, true);

  const isLive = liveStatus === true;

  const latitudeNumber = toFiniteNumber(latitude);

  const longitudeNumber = toFiniteNumber(longitude);

  const hasCoordinates = latitudeNumber !== null && longitudeNumber !== null;

  const normalizedListingId = String(listing_id ?? id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 rounded text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to listings
      </Link>

      {!isLive && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle size={16} aria-hidden="true" />
          This listing is currently inactive.
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {saveError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-navy-900">
                  {apartment_name || "Unnamed property"}
                </h1>

                <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                  <MapPin size={13} aria-hidden="true" />

                  {titleCase(locality) || "Locality unavailable"}

                  {hasValue(floor) && hasValue(total_floors) && (
                    <>
                      {" · "}
                      Floor {floor} of {total_floors}
                    </>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                {Boolean(is_verified) && (
                  <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                    <Shield size={12} aria-hidden="true" />
                    Verified
                  </span>
                )}

                <button
                  type="button"
                  onClick={toggleSave}
                  disabled={saveLoading}
                  aria-pressed={saved}
                  aria-label={
                    saved
                      ? "Remove listing from saved listings"
                      : "Save listing"
                  }
                  className={[
                    "flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-emerald-400",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    saved
                      ? "border-red-200 bg-red-50 text-red-500"
                      : "border-gray-200 text-gray-500 hover:border-gray-400",
                  ].join(" ")}
                >
                  <Heart
                    size={13}
                    aria-hidden="true"
                    fill={saved ? "currentColor" : "none"}
                  />

                  {saveLoading ? "Saving…" : saved ? "Saved" : "Save"}
                </button>
              </div>
            </div>

            <div className="mt-5 border-t border-gray-100 pt-5">
              <p className="tabular-nums text-3xl font-bold text-navy-900">
                {formatPrice(price)}
              </p>

              <p className="mt-1 text-sm text-gray-400">
                {formatPricePerSqft(price, carpet_area)}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Bedrooms",
                  value: bedroom,
                },
                {
                  label: "Bathrooms",
                  value: bathroom,
                },
                {
                  label: "Balconies",
                  value: balcony,
                },
                {
                  label: "Parking",
                  value: covered_parking,
                },
              ].map(({ label, value }) =>
                hasValue(value) ? (
                  <div
                    key={label}
                    className="rounded-lg bg-gray-50 p-3 text-center"
                  >
                    <p className="tabular-nums text-lg font-bold text-navy-900">
                      {value}
                    </p>

                    <p className="mt-0.5 text-xs text-gray-400">{label}</p>
                  </div>
                ) : null
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold text-gray-800">
              Property details
            </h2>

            <Stat label="Property type" value={titleCase(property_type)} />

            <Stat label="Carpet area" value={formatArea(carpet_area)} />

            <Stat
              label="Super built-up area"
              value={formatArea(super_built_up_area)}
            />

            <Stat label="Furnishing" value={titleCase(furnishing)} />

            <Stat label="Facing" value={titleCase(facing_direction)} />

            <Stat
              label="Floor"
              value={
                hasValue(floor) && hasValue(total_floors)
                  ? `${floor} / ${total_floors}`
                  : floor
              }
            />

            {hasValue(project_id) && (
              <Stat
                label="Project"
                value={
                  <Link
                    to={`/projects/${encodeURIComponent(String(project_id))}`}
                    className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {project_id}
                  </Link>
                }
              />
            )}

            <Stat label="Listed on" value={formatDate(posted_at)} />
          </div>

          {hasValue(description) && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-3 font-semibold text-gray-800">Description</h2>

              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
                {String(description)}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-800">
              Contact
            </h2>

            <p className="text-sm font-medium">{posted_by_name || "—"}</p>

            {hasValue(posted_by) && (
              <p className="mt-0.5 text-xs capitalize text-gray-500">
                {posted_by}
              </p>
            )}

            {hasValue(posted_by_contact) && (
              <a
                href={`tel:${String(posted_by_contact)}`}
                className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <Phone size={15} aria-hidden="true" />

                {posted_by_contact}
              </a>
            )}
          </div>

          {hasCoordinates && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <a
                href={`https://maps.google.com/?q=${latitudeNumber},${longitudeNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 text-sm text-blue-600 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden="true" />
                  View on Google Maps
                </span>

                <ExternalLink size={13} aria-hidden="true" />
              </a>

              <div className="px-4 pb-3 text-xs text-gray-400">
                {latitudeNumber.toFixed(5)}
                {", "}
                {longitudeNumber.toFixed(5)}
              </div>
            </div>
          )}

          {hasValue(listing_url) && (
            <a
              href={String(listing_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <span>View on {website || "original source"}</span>

              <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}

          <div className="rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-500">
            Posted {formatRelative(posted_at)}
            {" · "}
            {formatDate(posted_at)}
          </div>
        </div>
      </div>
    </div>
  );
}