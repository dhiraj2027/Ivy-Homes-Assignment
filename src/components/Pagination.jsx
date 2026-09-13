import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function Pagination({
  page,
  total,
  pageSize,
  onChange,
}) {
  const parsedPage = Number(page);
  const totalItems = Number(total);
  const size = Number(pageSize);

  if (
    !Number.isFinite(parsedPage) ||
    !Number.isFinite(totalItems) ||
    !Number.isFinite(size) ||
    !Number.isInteger(parsedPage) ||
    !Number.isInteger(size) ||
    parsedPage < 1 ||
    totalItems <= 0 ||
    size <= 0 ||
    typeof onChange !== 'function'
  ) {
    return null;
  }

  const totalPages = Math.ceil(totalItems / size);

  if (totalPages <= 1) {
    return null;
  }

  /*
   * Keep calculations safe even if the parent temporarily
   * provides a page outside the valid range.
   */
  const currentPage = Math.min(
    parsedPage,
    totalPages
  );

  const pages = [];
  const delta = 2;

  const left = Math.max(
    1,
    currentPage - delta
  );

  const right = Math.min(
    totalPages,
    currentPage + delta
  );

  if (left > 1) {
    pages.push(1);

    if (left > 2) {
      pages.push('ellipsis-left');
    }
  }

  for (
    let pageNumber = left;
    pageNumber <= right;
    pageNumber += 1
  ) {
    pages.push(pageNumber);
  }

  if (right < totalPages) {
    if (right < totalPages - 1) {
      pages.push('ellipsis-right');
    }

    pages.push(totalPages);
  }

  const firstItem =
    (currentPage - 1) * size + 1;

  const lastItem = Math.min(
    currentPage * size,
    totalItems
  );

  const goToPage = (nextPage) => {
    if (
      !Number.isInteger(nextPage) ||
      nextPage < 1 ||
      nextPage > totalPages ||
      nextPage === currentPage
    ) {
      return;
    }

    onChange(nextPage);
  };

  const formatNumber = (value) =>
    value.toLocaleString('en-IN');

  return (
    <nav
      className="mt-6 flex items-center justify-between gap-4 text-sm"
      aria-label="Pagination"
    >
      <p className="text-xs text-gray-500">
        Showing {formatNumber(firstItem)}
        {'–'}
        {formatNumber(lastItem)}
        {' of '}
        {formatNumber(totalItems)}
      </p>

      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() =>
            goToPage(currentPage - 1)
          }
          className="rounded border border-gray-200 p-1.5 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Previous page"
        >
          <ChevronLeft
            size={16}
            aria-hidden="true"
          />
        </button>

        {/* Page numbers */}
        {pages.map((pageItem) => {
          if (
            typeof pageItem === 'string'
          ) {
            return (
              <span
                key={pageItem}
                className="px-2 text-gray-400"
                aria-hidden="true"
              >
                …
              </span>
            );
          }

          const active =
            pageItem === currentPage;

          return (
            <button
              key={pageItem}
              type="button"
              onClick={() =>
                goToPage(pageItem)
              }
              aria-current={
                active ? 'page' : undefined
              }
              aria-label={
                active
                  ? `Page ${pageItem}, current page`
                  : `Go to page ${pageItem}`
              }
              className={[
                'h-8 w-8 rounded border text-xs font-medium transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-emerald-400',
                active
                  ? 'border-navy-900 bg-navy-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              ].join(' ')}
            >
              {pageItem}
            </button>
          );
        })}

        {/* Next */}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() =>
            goToPage(currentPage + 1)
          }
          className="rounded border border-gray-200 p-1.5 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Next page"
        >
          <ChevronRight
            size={16}
            aria-hidden="true"
          />
        </button>
      </div>
    </nav>
  );
}