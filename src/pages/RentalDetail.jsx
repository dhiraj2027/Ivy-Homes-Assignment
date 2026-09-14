import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bath,
  Bed,
  Building2,
  CalendarDays,
  Car,
  CheckCircle2,
  Home,
  MapPin,
  Maximize2,
  User,
} from "lucide-react";

import { getRental } from "../api/client.js";

import {
  formatArea,
  formatPrice,
  formatRelative,
  formatRent,
  titleCase,
} from "../utils/formatters.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function isPositiveNumber(value) {
  const number = toNumber(value);

  return number !== null && number > 0;
}

function isNonNegativeNumber(value) {
  const number = toNumber(value);

  return number !== null && number >= 0;
}

function isCount(value) {
  const number = toNumber(value);

  return number !== null && Number.isInteger(number) && number >= 0;
}

function formatFloor(floor, totalFloors) {
  if (!isNonNegativeNumber(floor) || !isNonNegativeNumber(totalFloors)) {
    return null;
  }

  if (Number(totalFloors) === 0) {
    return null;
  }

  return `Floor ${Number(floor)}/${Number(totalFloors)}`;
}

function DetailStat({ icon: Icon, label, value }) {
  if (!value) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-gray-400">
        <Icon size={16} aria-hidden="true" />

        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>

      <p className="font-semibold text-navy-900">{value}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="animate-pulse">
        <div className="mb-6 h-5 w-24 rounded bg-gray-200" />

        <div className="mb-4 h-9 w-2/3 rounded bg-gray-200" />

        <div className="mb-8 h-5 w-1/3 rounded bg-gray-100" />

        <div className="mb-6 h-32 rounded-2xl bg-gray-200" />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({
            length: 8,
          }).map((_, index) => (
            <div key={index} className="h-24 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
      >
        <h1 className="text-lg font-semibold text-red-800">
          Could not load rental
        </h1>

        <p className="mt-2 text-sm text-red-700">{message}</p>

        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2"
          >
            Retry
          </button>

          <Link
            to="/rentals"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2"
          >
            Back to rentals
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RentalDetail() {
  const { id } = useParams();

  const navigate = useNavigate();

  const [rental, setRental] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadRental() {
      const rentalId = normalizeText(id);

      if (!rentalId) {
        setError("Rental ID is missing from the URL.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setRental(null);

      try {
        const response = await getRental(rentalId, {
          signal: controller.signal,
        });

        if (!response || typeof response !== "object") {
          throw new Error("Invalid rental response from the API.");
        }

        setRental(response);
      } catch (err) {
        if (err?.name === "AbortError") {
          return;
        }

        setError(err?.message || "Could not load rental.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadRental();

    return () => {
      controller.abort();
    };
  }, [id]);

  if (loading) {
    return <Skeleton />;
  }

  if (error || !rental) {
    return (
      <ErrorState
        message={error || "Rental could not be found."}
        onRetry={() => {
          navigate(0);
        }}
      />
    );
  }

  const rentalId =
    normalizeText(rental.rental_id) ||
    normalizeText(rental.id) ||
    normalizeText(rental.listing_id) ||
    normalizeText(id);

  const apartmentName = normalizeText(rental.apartment_name);

  const locality = normalizeText(rental.locality);

  const propertyType = normalizeText(rental.property_type);

  const furnishing = normalizeText(rental.furnishing);

  const postedBy = normalizeText(rental.posted_by);

  const postedByName = normalizeText(rental.posted_by_name);

  const description = normalizeText(rental.description);

  const price = rental.price;

  const deposit = rental.deposit;

  const maintenance = rental.maintenance;

  const bedroom = rental.bedroom;

  const bathroom = rental.bathroom;

  const carpetArea = rental.carpet_area;

  const superBuiltUpArea = rental.super_built_up_area;

  const floor = rental.floor;

  const totalFloors = rental.total_floors;

  const coveredParking = rental.covered_parking;

  const postedAt = rental.posted_at;

  const isVerified = rental.is_verified === true;

  const isLive = rental.is_live !== false;

  const floorLabel = formatFloor(floor, totalFloors);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back
      </button>

      {/* Header */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {isLive && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  Live
                </span>
              )}

              {isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  <CheckCircle2 size={12} aria-hidden="true" />
                  Verified
                </span>
              )}

              {propertyType && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {titleCase(propertyType)}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
              {apartmentName || "Rental property"}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
              {locality && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={15} aria-hidden="true" />

                  {titleCase(locality)}
                </span>
              )}

              {floorLabel && <span>{floorLabel}</span>}

              {postedAt && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} aria-hidden="true" />

                  {formatRelative(postedAt)}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 lg:text-right">
            <p className="text-3xl font-bold tabular-nums text-navy-900">
              {isPositiveNumber(price) ? formatRent(price) : "Rent unavailable"}
            </p>

            <p className="mt-1 text-xs text-gray-400">Monthly rent</p>
          </div>
        </div>
      </section>

      {/* Main details */}
      <section className="mt-6">
        <h2 className="mb-4 text-lg font-semibold text-navy-900">
          Property details
        </h2>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <DetailStat
            icon={Bed}
            label="Bedrooms"
            value={
              isCount(bedroom)
                ? `${Number(bedroom)} ${
                    Number(bedroom) === 1 ? "Bedroom" : "Bedrooms"
                  }`
                : null
            }
          />

          <DetailStat
            icon={Bath}
            label="Bathrooms"
            value={
              isCount(bathroom)
                ? `${Number(bathroom)} ${
                    Number(bathroom) === 1 ? "Bathroom" : "Bathrooms"
                  }`
                : null
            }
          />

          <DetailStat
            icon={Maximize2}
            label="Carpet area"
            value={isPositiveNumber(carpetArea) ? formatArea(carpetArea) : null}
          />

          <DetailStat
            icon={Maximize2}
            label="Built-up area"
            value={
              isPositiveNumber(superBuiltUpArea)
                ? formatArea(superBuiltUpArea)
                : null
            }
          />

          <DetailStat
            icon={Home}
            label="Furnishing"
            value={furnishing ? titleCase(furnishing) : null}
          />

          <DetailStat icon={Building2} label="Floor" value={floorLabel} />

          <DetailStat
            icon={Car}
            label="Parking"
            value={
              isCount(coveredParking)
                ? `${Number(coveredParking)} ${
                    Number(coveredParking) === 1
                      ? "covered space"
                      : "covered spaces"
                  }`
                : null
            }
          />

          <DetailStat
            icon={Building2}
            label="Property type"
            value={propertyType ? titleCase(propertyType) : null}
          />
        </div>
      </section>

      {/* Financial details */}
      {(isNonNegativeNumber(deposit) || isNonNegativeNumber(maintenance)) && (
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-navy-900">
            Rental costs
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {isNonNegativeNumber(deposit) && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">Security deposit</p>

                <p className="mt-1 text-xl font-semibold text-navy-900">
                  {formatPrice(deposit)}
                </p>
              </div>
            )}

            {isNonNegativeNumber(maintenance) && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">Maintenance</p>

                <p className="mt-1 text-xl font-semibold text-navy-900">
                  {formatRent(maintenance)}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Description */}
      {description && (
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-navy-900">
            Description
          </h2>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="whitespace-pre-line text-sm leading-7 text-gray-600">
              {description}
            </p>
          </div>
        </section>
      )}

      {/* Posted by */}
      {(postedBy || postedByName) && (
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-navy-900">
            Listed by
          </h2>

          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <User size={18} className="text-gray-500" aria-hidden="true" />
            </div>

            <div>
              {postedByName && (
                <p className="font-medium text-navy-900">{postedByName}</p>
              )}

              {postedBy && (
                <p className="text-sm text-gray-500">{titleCase(postedBy)}</p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}