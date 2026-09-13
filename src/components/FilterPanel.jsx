import { useEffect, useState } from 'react';
import {
  SlidersHorizontal,
  X,
} from 'lucide-react';

const DEFAULT_LOCALITY =
  'Golf Course Road';

const BHK_OPTIONS = [
  1,
  2,
  3,
  4,
];

const FURNISHING_OPTIONS = [
  'unfurnished',
  'semi-furnished',
  'fully-furnished',
];

const PROPERTY_TYPES = [
  'apartment',
  'villa',
  'independent house',
  'plot',
  'builder floor',
];

function normalizeText(value) {
  return String(value ?? '').trim();
}

function Label({ children }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
      {children}
    </p>
  );
}

function Pill({
  active,
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-emerald-400',
        active
          ? 'border-navy-900 bg-navy-900 text-white'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function RadioOption({
  name,
  value,
  checked,
  onChange,
  children,
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded py-0.5">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="h-4 w-4 accent-navy-900 focus:ring-2 focus:ring-emerald-400"
      />

      <span className="text-sm capitalize text-gray-600">
        {children}
      </span>
    </label>
  );
}

function formatOptionLabel(value) {
  return value
    .split('-')
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join('-');
}

export default function FilterPanel({
  filters,
  onChange,
  onReset,
  className = '',
}) {
  const selectedBhk =
    normalizeText(filters.bhk);

  const selectedFurnishing =
    normalizeText(
      filters.furnishing
    );

  const selectedPropertyType =
    normalizeText(
      filters.property_type
    );

  const [
    localityInput,
    setLocalityInput,
  ] = useState(
    normalizeText(
      filters.locality
    ) || DEFAULT_LOCALITY
  );

  const [
    minPriceInput,
    setMinPriceInput,
  ] = useState(
    normalizeText(
      filters.min_price
    )
  );

  const [
    maxPriceInput,
    setMaxPriceInput,
  ] = useState(
    normalizeText(
      filters.max_price
    )
  );

  useEffect(() => {
    setLocalityInput(
      normalizeText(
        filters.locality
      ) || DEFAULT_LOCALITY
    );

    setMinPriceInput(
      normalizeText(
        filters.min_price
      )
    );

    setMaxPriceInput(
      normalizeText(
        filters.max_price
      )
    );
  }, [
    filters.locality,
    filters.min_price,
    filters.max_price,
  ]);

  const minPrice =
    minPriceInput === ''
      ? null
      : Number(minPriceInput);

  const maxPrice =
    maxPriceInput === ''
      ? null
      : Number(maxPriceInput);

  const invalidPriceRange =
    minPrice !== null &&
    maxPrice !== null &&
    Number.isFinite(minPrice) &&
    Number.isFinite(maxPrice) &&
    minPrice > maxPrice;

  const hasFilters = Boolean(
    normalizeText(
      filters.locality
    ) ||
      selectedBhk ||
      selectedFurnishing ||
      normalizeText(
        filters.min_price
      ) ||
      normalizeText(
        filters.max_price
      ) ||
      selectedPropertyType
  );

  const setFilter = (
    key,
    value
  ) => {
    onChange({
      [key]: value,
      page: 1,
    });
  };

  const commitPrice = (
    minValue = minPriceInput,
    maxValue = maxPriceInput
  ) => {
    const normalizedMin =
      normalizeText(minValue);

    const normalizedMax =
      normalizeText(maxValue);

    const numericMin =
      normalizedMin === ''
        ? null
        : Number(normalizedMin);

    const numericMax =
      normalizedMax === ''
        ? null
        : Number(normalizedMax);

    if (
      numericMin !== null &&
      (!Number.isFinite(
        numericMin
      ) ||
        numericMin < 0)
    ) {
      return;
    }

    if (
      numericMax !== null &&
      (!Number.isFinite(
        numericMax
      ) ||
        numericMax < 0)
    ) {
      return;
    }

    if (
      numericMin !== null &&
      numericMax !== null &&
      numericMin > numericMax
    ) {
      return;
    }

    const currentMin =
      normalizeText(
        filters.min_price
      );

    const currentMax =
      normalizeText(
        filters.max_price
      );

    if (
      normalizedMin === currentMin &&
      normalizedMax === currentMax
    ) {
      return;
    }

    onChange({
      min_price: normalizedMin,
      max_price: normalizedMax,
      page: 1,
    });
  };

  const clearLocality = () => {
    setLocalityInput('');

    if (
      normalizeText(
        filters.locality
      )
    ) {
      setFilter(
        'locality',
        ''
      );
    }
  };

  const clearFurnishing = () => {
    if (selectedFurnishing) {
      setFilter(
        'furnishing',
        ''
      );
    }
  };

  const clearPropertyType = () => {
    if (selectedPropertyType) {
      setFilter(
        'property_type',
        ''
      );
    }
  };

  const clearPrices = () => {
    setMinPriceInput('');
    setMaxPriceInput('');

    if (
      normalizeText(
        filters.min_price
      ) ||
      normalizeText(
        filters.max_price
      )
    ) {
      onChange({
        min_price: '',
        max_price: '',
        page: 1,
      });
    }
  };

  return (
    <aside
      className={[
        'space-y-5 rounded-xl border border-gray-200 bg-white p-4',
        className,
      ].join(' ')}
      aria-label="Listing filters"
    >
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">
          <SlidersHorizontal
            size={15}
            aria-hidden="true"
          />
          Filters
        </p>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setLocalityInput(
                DEFAULT_LOCALITY
              );
              setMinPriceInput('');
              setMaxPriceInput('');
              onReset();
            }}
            className="flex items-center gap-0.5 rounded text-xs text-gray-400 transition-colors hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <X
              size={12}
              aria-hidden="true"
            />
            Clear
          </button>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>
            Locality
          </Label>

          {normalizeText(
            localityInput
          ) && (
            <button
              type="button"
              onClick={clearLocality}
              className="mb-2 text-xs text-gray-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Clear
            </button>
          )}
        </div>

        <input
          type="text"
          placeholder="e.g. Golf Course Road"
          value={localityInput}
          onChange={(event) => {
            const value =
              event.target.value.replace(
                /^\s+/,
                ''
              );

            setLocalityInput(value);

            setFilter(
              'locality',
              value
            );
          }}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
          aria-label="Filter by locality"
        />
      </div>

      <div>
        <Label>
          Bedrooms
        </Label>

        <div className="flex flex-wrap gap-2">
          {BHK_OPTIONS.map(
            (bedrooms) => {
              const value =
                String(
                  bedrooms
                );

              const active =
                selectedBhk ===
                value;

              return (
                <Pill
                  key={value}
                  active={active}
                  onClick={() =>
                    setFilter(
                      'bhk',
                      active
                        ? ''
                        : value
                    )
                  }
                >
                  {bedrooms} BHK
                </Pill>
              );
            }
          )}

          <Pill
            active={
              selectedBhk === '5+'
            }
            onClick={() =>
              setFilter(
                'bhk',
                selectedBhk ===
                  '5+'
                  ? ''
                  : '5+'
              )
            }
          >
            5+
          </Pill>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>
            Price (₹)
          </Label>

          {(minPriceInput ||
            maxPriceInput) && (
            <button
              type="button"
              onClick={clearPrices}
              className="mb-2 text-xs text-gray-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="Min"
            value={minPriceInput}
            onChange={(event) =>
              setMinPriceInput(
                event.target.value
              )
            }
            onBlur={() =>
              commitPrice()
            }
            onKeyDown={(event) => {
              if (
                event.key === 'Enter'
              ) {
                event.currentTarget.blur();
              }

              if (
                event.key === 'Escape'
              ) {
                setMinPriceInput(
                  normalizeText(
                    filters.min_price
                  )
                );

                event.currentTarget.blur();
              }
            }}
            className={[
              'w-1/2 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1',
              invalidPriceRange
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-200 focus:border-navy-500 focus:ring-navy-500',
            ].join(' ')}
            aria-label="Minimum price"
            aria-invalid={
              invalidPriceRange
            }
          />

          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="Max"
            value={maxPriceInput}
            onChange={(event) =>
              setMaxPriceInput(
                event.target.value
              )
            }
            onBlur={() =>
              commitPrice()
            }
            onKeyDown={(event) => {
              if (
                event.key === 'Enter'
              ) {
                event.currentTarget.blur();
              }

              if (
                event.key === 'Escape'
              ) {
                setMaxPriceInput(
                  normalizeText(
                    filters.max_price
                  )
                );

                event.currentTarget.blur();
              }
            }}
            className={[
              'w-1/2 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1',
              invalidPriceRange
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-200 focus:border-navy-500 focus:ring-navy-500',
            ].join(' ')}
            aria-label="Maximum price"
            aria-invalid={
              invalidPriceRange
            }
          />
        </div>

        {invalidPriceRange && (
          <p
            className="mt-2 text-xs text-red-500"
            role="alert"
          >
            Minimum price cannot exceed maximum price.
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>
            Furnishing
          </Label>

          {selectedFurnishing && (
            <button
              type="button"
              onClick={
                clearFurnishing
              }
              className="mb-2 text-xs text-gray-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {FURNISHING_OPTIONS.map(
            (furnishing) => (
              <RadioOption
                key={furnishing}
                name="furnishing"
                value={furnishing}
                checked={
                  selectedFurnishing ===
                  furnishing
                }
                onChange={(value) =>
                  setFilter(
                    'furnishing',
                    value
                  )
                }
              >
                {formatOptionLabel(
                  furnishing
                )}
              </RadioOption>
            )
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>
            Property type
          </Label>

          {selectedPropertyType && (
            <button
              type="button"
              onClick={
                clearPropertyType
              }
              className="mb-2 text-xs text-gray-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {PROPERTY_TYPES.map(
            (propertyType) => (
              <RadioOption
                key={propertyType}
                name="property-type"
                value={propertyType}
                checked={
                  selectedPropertyType ===
                  propertyType
                }
                onChange={(value) =>
                  setFilter(
                    'property_type',
                    value
                  )
                }
              >
                {propertyType}
              </RadioOption>
            )
          )}
        </div>
      </div>

      <div>
        <Label>
          Sort by
        </Label>

        <select
          value={`${normalizeText(
            filters.sort_by ||
              'posted_at'
          )}:${normalizeText(
            filters.order ||
              'desc'
          )}`}
          onChange={(event) => {
            const [
              sortBy,
              order,
            ] =
              event.target.value.split(
                ':'
              );

            onChange({
              sort_by: sortBy,
              order,
              page: 1,
            });
          }}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
          aria-label="Sort listings"
        >
          <option value="posted_at:desc">
            Newest first
          </option>

          <option value="posted_at:asc">
            Oldest first
          </option>

          <option value="price:asc">
            Price: Low to High
          </option>

          <option value="price:desc">
            Price: High to Low
          </option>

          <option value="carpet_area:asc">
            Area: Small to Large
          </option>

          <option value="carpet_area:desc">
            Area: Large to Small
          </option>
        </select>
      </div>
    </aside>
  );
}