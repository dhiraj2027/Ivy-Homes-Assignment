# Ivy Homes — Property Discovery Platform

A React-based property discovery application built for the Ivy Homes Software Engineering Internship assignment.

The application provides authenticated browsing of listings, rentals, and projects with filtering, sorting, pagination, property details, saved listings, and an analytics/insights dashboard.

---

## 1. Tech Stack

* React
* Vite
* React Router
* Tailwind CSS
* Axios
* Lucide React
* JavaScript (ES6+)

The application uses the Ivy Homes API as its backend data source.

---

## 2. Project Structure

```text
.
├── src/
│   ├── components/
│   │   ├── FilterPanel.jsx
│   │   ├── ListingCard.jsx
│   │   ├── Navbar.jsx
│   │   ├── Pagination.jsx
│   │   ├── ProjectCard.jsx
│   │   └── RentalCard.jsx
│   │
│   ├── pages/
│   │   ├── Listings.jsx
│   │   ├── ListingDetail.jsx
│   │   ├── Rentals.jsx
│   │   ├── RentalDetail.jsx
│   │   ├── Projects.jsx
│   │   ├── ProjectDetail.jsx
│   │   ├── Favourites.jsx
│   │   ├── Insights.jsx
│   │   └── Login.jsx
│   │
│   ├── context/
│   │   └── AuthContext.jsx
│   │
│   ├── api/
│   │   └── client.js
│   │
│   ├── config.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
├── scripts/
│   ├── fetch_data.mjs
│   ├── analyze.mjs
│   └── data/
│       ├── listings.json
│       ├── rentals.json
│       ├── projects.json
│       └── analysis.json
│
├── submission.json
├── package.json
└── README.md
```

---

## 3. Running the Application

### Prerequisites

* Node.js 18+
* npm

### Install dependencies

```bash
npm install
```

### Environment variables

Create a `.env` file:

```env
VITE_API_BASE_URL=https://solve.ivy.homes
VITE_API_KEY=IVY26-XXXXXXXXXXXX
```

Replace the API key with the key provided for the assignment.

Do not commit the actual API key to the repository.

### Start development server

```bash
npm run dev
```

The application will be available at the URL printed by Vite.

### Production build

```bash
npm run build
```

---

# 4. Authentication

Authentication is handled through the Ivy Homes login API.

The application:

* Requires authentication before accessing protected application pages.
* Redirects unauthenticated users to `/login`.
* Preserves the originally requested route when redirecting to login.
* Stores the authenticated session so that refreshes do not immediately log the user out.
* Uses the refresh token to maintain the session.
* Handles unauthorized API responses by clearing the authenticated state.

The running API was found to return:

```text
access_token
refresh_token
expires_in
user
```

rather than the documented `token` field.

The implementation therefore follows the **running API contract** rather than relying blindly on the documentation.

---

# 5. API Contract Findings

The assignment explicitly states that the API documentation may be inaccurate, so the implementation was validated against the running API.

Several differences were discovered.

## Pagination

The documented API describes page-based pagination, but the running API reliably supports:

```text
offset
limit
```

Responses are also capped at 50 records.

The data-fetching scripts therefore continue requesting:

```text
offset = 0, 50, 100, ...
limit = 50
```

until an empty page is returned.

The API-reported `total` is treated as advisory rather than as the termination condition.

This was important because the complete datasets were larger than the reported totals.

| Collection | Reported | Actual |
| ---------- | -------: | -----: |
| Listings   |     3336 |   3500 |
| Rentals    |     1258 |   1320 |
| Projects   |      381 |    400 |

---

## Listing Detail

The running API serves listing details through:

```text
GET /v1/listings/{listing_id}
```

The implementation follows this working route.

---

## Saved Listings

The running API uses:

```text
GET    /v1/saved
POST   /v1/saved
DELETE /v1/saved/{id}
```

A save request uses:

```json
{
  "listing_id": "..."
}
```

The application uses these live endpoints for adding, removing, and loading saved listings.

---

## Analytics Endpoint

The documented:

```text
/v1/analytics/summary
```

endpoint returned HTTP 404 against the running API.

Therefore the insights screen computes the required assignment analytics locally from the complete datasets instead of depending on a non-working endpoint.

---

# 6. Listings

The listings page supports:

* Locality
* Bedrooms / BHK
* Price range
* Furnishing
* Property type
* Sorting
* Pagination
* Responsive grid/list presentation
* Listing detail navigation

### Filtering strategy

The assignment requires filters to actually work even if server-side filtering is unreliable.

The application therefore:

1. Retrieves the complete listings dataset.
2. Applies filters locally.
3. Applies sorting locally.
4. Calculates pagination over the filtered/sorted result.
5. Displays only the current page.

This ordering is intentional.

Applying pagination before filtering can produce incorrect results because a filtered record may exist on a later API page.

The default locality is:

```text
Golf Course Road
```

The API is city-scoped through the supplied API key, so a separate city parameter is not artificially added to requests.

### BHK handling

The UI provides:

```text
1 BHK
2 BHK
3 BHK
4 BHK
5+ BHK
```

The `5+` option is implemented as:

```text
bedroom >= 5
```

rather than an exact match.

---

# 7. Rentals

The rentals page follows the same reliable collection strategy:

1. Fetch the complete rental dataset.
2. Apply filters locally.
3. Sort locally.
4. Paginate after filtering.

The default locality is also:

```text
Golf Course Road
```

Rental prices and areas are displayed using the units supplied by the API without unsupported conversions.

---

# 8. Projects

Projects are fetched completely and then filtered, sorted, and paginated on the client.

Supported project filters include:

* Locality
* Project status

Supported sorting includes:

* Maximum price
* Minimum price
* Launch date
* Total units

The project listing count shown in the application is treated carefully because the API's `total_listings` field was found to disagree with the actual listing dataset for many projects.

---

# 9. Saved Listings

Authenticated users can:

* Save a listing.
* Remove a saved listing.
* View their saved listings.
* Return to saved listings after a refresh or re-login.

Saved state is persisted through the API rather than being stored only in browser state.

---

# 10. Listing and Project Details

Each listing has a dedicated URL:

```text
/listings/{listing_id}
```

Rentals:

```text
/rentals/{listing_id}
```

Projects:

```text
/projects/{project_id}
```

The detail pages retrieve their corresponding records from the API and provide relevant property/project information.

---

# 11. Insights

The Insights page reproduces the assignment's requested analytics from the complete fetched datasets.

Current results:

| Question                                     |     Result |
| -------------------------------------------- | ---------: |
| Q1 — Total listing records                   |       3500 |
| Q2 — Unique properties                       |       3417 |
| Q3 — Active listings                         |       2792 |
| Q4 — Corrupt listings                        |         24 |
| Q5 — Total monthly rent in Golf Course Road  | ₹4,662,400 |
| Q6 — Mean live 2BHK price/sqft               | ₹26,803.34 |
| Q7 — Costliest project                       |     P60090 |
| Q8 — Listings posted in previous 7 days      |        129 |
| Q9 — Confirmed fake listings                 |          0 |
| Q10 — Projects with incorrect listing counts |        295 |

The analytics use the fixed assignment reference date:

```text
2026-09-10T00:00:00+05:30
```

The seven-day posting window is treated as the half-open interval:

```text
[2026-09-03T00:00:00+05:30,
 2026-09-10T00:00:00+05:30)
```

---

# 12. Data Quality Findings

The analysis identified several important discrepancies between the API documentation, reported metadata, and actual records.

### Dataset completeness

The API-reported totals undercount the records returned through complete offset pagination:

```text
Listings: 3336 → 3500
Rentals:  1258 → 1320
Projects: 381  → 400
```

Therefore the application does not use the reported total as the sole source of truth for complete dataset retrieval.

### Duplicate property records

Using the assignment's property fingerprint, the dataset contains:

```text
3417 unique properties
3500 listing records
83 duplicate property groups
166 listing records involved in those groups
```

Listing IDs are therefore not assumed to represent unique physical properties.

### Corrupt listings

24 listings were identified using the assignment's data-quality checks, including:

* Non-positive prices.
* Super-built-up area smaller than carpet area for non-plot properties.
* Floor greater than total floors.
* Zero bedrooms for non-plot properties.
* Zero bathrooms for non-plot properties.

### Project listing-count consistency

295 projects have a `total_listings` value that differs from the number of listings associated with that project in the complete listings dataset.

The application therefore treats the API's project inventory count as potentially inconsistent rather than assuming it is authoritative.

### Fake listings

No listing was classified as a confirmed fake.

Suspicious patterns were investigated, but a shared contact associated with multiple listing names alone was not considered sufficient evidence to label a listing as definitively fake.

This conservative approach avoids presenting an unverified suspicion as a confirmed fraud finding.

---

# 13. Why the Frontend Uses Local Filtering

A major implementation decision was to avoid depending on server-side filtering and pagination for the primary browsing experience.

The reason is that the API's documented and observed behavior is not completely reliable.

For filtered collections, the application uses:

```text
Complete dataset
      ↓
Filter
      ↓
Sort
      ↓
Paginate
      ↓
Render
```

instead of:

```text
API page
      ↓
Filter
      ↓
Render
```

The latter can incorrectly omit matching records that exist outside the currently fetched API page.

This also makes the UI behavior deterministic and ensures that pagination represents the filtered result set rather than an arbitrary API page.

---

# 14. What I Distrusted

During implementation I specifically treated the following API behavior as untrusted until verified:

* Documented page-based pagination.
* Reported collection totals.
* Documented login token field.
* Documented listing detail route.
* Documented saved-listing endpoint contract.
* Documented analytics endpoint.
* Project `total_listings` consistency.
* Listing uniqueness based solely on `listing_id`.

The implementation was adjusted only where live API behavior demonstrated a concrete discrepancy.

---

# 15. What Turned Out to Be Fine

After verification, several parts of the API/data model were usable as expected:

* Listing records could be retrieved completely through offset pagination.
* Rental records could be retrieved completely.
* Project records could be retrieved completely.
* Listing detail retrieval worked through the running plural route.
* Saved listing operations worked through the running `/v1/saved` endpoints.
* Property price and area values could be used directly in the assignment calculations.
* Timestamps could be normalized and compared against the assignment's fixed reference date.

---

# 16. Data Analysis Scripts

The repository includes scripts used to reproduce the assignment analysis.

### Fetch complete datasets

```bash
VITE_API_KEY=IVY26-XXXXXXXXXXXX node scripts/fetch_data.mjs
```

The script stores the fetched datasets under:

```text
scripts/data/
```

### Run analysis

```bash
node scripts/analyze.mjs
```

The analysis output is written to:

```text
scripts/data/analysis.json
```

The analysis uses complete datasets and does not stop based solely on API-reported totals.

---

# 17. Reproducibility

The analysis is based on a fixed reference date supplied by the assignment:

```text
2026-09-10T00:00:00+05:30
```

This makes time-dependent answers reproducible instead of changing based on the current system date.

The analysis also records the methodology used for each question and the relevant data-quality findings.

---

# 18. Security

The API key is supplied through environment variables.

The actual API key should not be committed to Git.

Use:

```env
VITE_API_KEY=XXXX
```

locally and replace it with the actual assignment key.

The repository should contain only placeholders/example values.

---

# 19. LLM Usage Disclosure

LLM assistance was used during development for:

* Reviewing implementation decisions.
* Identifying potential edge cases.
* Refactoring and improving code structure.
* Reviewing API behavior and data-analysis logic.
* Improving documentation.

All final implementation decisions and API findings were validated against the running application/API and the assignment requirements.

---

# 20. Submission

The required candidate details and Q1–Q10 answers are provided in the root submission.json.
