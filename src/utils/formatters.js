/* -------------------------------------------------------------------------- */
/* Numeric helpers                                                            */
/* -------------------------------------------------------------------------- */

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

/* -------------------------------------------------------------------------- */
/* Currency                                                                   */
/* -------------------------------------------------------------------------- */

export function formatPrice(rupees) {
  const value = toFiniteNumber(rupees);

  /*
   * Non-positive prices exist in the raw dataset and are handled as
   * invalid/corrupt data by the analytics layer.
   *
   * Do not present them as legitimate property prices.
   */
  if (value === null || value <= 0) {
    return "—";
  }

  if (value >= 1_00_00_000) {
    return `₹${(value / 1_00_00_000).toFixed(2)} Cr`;
  }

  if (value >= 1_00_000) {
    return `₹${(value / 1_00_000).toFixed(2)} L`;
  }

  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function formatRent(rupees) {
  const value = toFiniteNumber(rupees);

  if (value === null || value < 0) {
    return "—";
  }

  return `₹${Math.round(value).toLocaleString("en-IN")}/mo`;
}

/* -------------------------------------------------------------------------- */
/* Area                                                                       */
/* -------------------------------------------------------------------------- */

export function formatArea(sqft) {
  const value = toFiniteNumber(sqft);

  if (value === null || value <= 0) {
    return "—";
  }

  return `${Math.round(value).toLocaleString("en-IN")} sqft`;
}

/* -------------------------------------------------------------------------- */
/* Price per square foot                                                      */
/* -------------------------------------------------------------------------- */

/*
 * Returns the raw ratio.
 *
 * IMPORTANT:
 * Q6 requires:
 *
 *     mean(price / carpet_area)
 *
 * and not:
 *
 *     mean(rounded price / carpet_area)
 *
 * Therefore this function intentionally returns the unrounded
 * numerical ratio.
 */
export function pricePerSqft(price, area) {
  const priceValue = toFiniteNumber(price);

  const areaValue = toFiniteNumber(area);

  if (
    priceValue === null ||
    priceValue <= 0 ||
    areaValue === null ||
    areaValue <= 0
  ) {
    return null;
  }

  return priceValue / areaValue;
}

export function formatPricePerSqft(price, area) {
  const value = pricePerSqft(price, area);

  if (value === null) {
    return "—";
  }

  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}/sqft`;
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

export function formatDate(iso) {
  if (!iso) {
    return "—";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRelative(iso) {
  if (!iso) {
    return "—";
  }

  const timestamp = new Date(iso).getTime();

  if (Number.isNaN(timestamp)) {
    return "—";
  }

  const diff = Date.now() - timestamp;

  /*
   * A future timestamp should not be displayed
   * as a negative relative duration.
   */
  if (diff < 0) {
    return "Recently";
  }

  const days = Math.floor(diff / 86_400_000);

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "Yesterday";
  }

  if (days < 30) {
    return `${days}d ago`;
  }

  if (days < 365) {
    return `${Math.floor(days / 30)}mo ago`;
  }

  return `${Math.floor(days / 365)}yr ago`;
}

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

export function capitalize(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function titleCase(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "";
  }

  return value.trim().split(/\s+/).map(capitalize).join(" ");
}

/* -------------------------------------------------------------------------- */
/* BHK                                                                        */
/* -------------------------------------------------------------------------- */

export function bhkLabel(bedrooms) {
  const value = toFiniteNumber(bedrooms);

  if (value === null || value <= 0) {
    return "—";
  }

  return `${value} BHK`;
}