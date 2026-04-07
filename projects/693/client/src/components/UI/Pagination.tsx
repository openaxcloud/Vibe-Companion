import React, { FC, KeyboardEvent, MouseEvent, useMemo } from "react";

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  className?: string;
  ariaLabel?: string;
  showPageSizeSummary?: boolean;
}

type PaginationItem =
  | number
  | "dots-left"
  | "dots-right";

const DOTS_LEFT: PaginationItem = "dots-left";
const DOTS_RIGHT: PaginationItem = "dots-right";

const createRange = (start: number, end: number): number[] => {
  const length = end - start + 1;
  return Array.from({ length }, (_, idx) => idx + start);
};

const getPaginationRange = (
  currentPage: number,
  totalItems: number,
  pageSize: number,
  siblingCount: number
): PaginationItem[] => {
  const totalPageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const totalPageNumbersToShow = siblingCount * 2 + 5; // first, last, current, 2*siblings, 2*dots

  if (totalPageNumbersToShow >= totalPageCount) {
    return createRange(1, totalPageCount);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPageCount);

  const showLeftDots = leftSiblingIndex > 2;
  const showRightDots = rightSiblingIndex < totalPageCount - 1;

  const firstPageIndex = 1;
  const lastPageIndex = totalPageCount;

  if (!showLeftDots && showRightDots) {
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = createRange(1, leftItemCount);
    return [...leftRange, DOTS_RIGHT, totalPageCount];
  }

  if (showLeftDots && !showRightDots) {
    const rightItemCount = 3 + 2 * siblingCount;
    const rightRange = createRange(totalPageCount - rightItemCount + 1, totalPageCount);
    return [firstPageIndex, DOTS_LEFT, ...rightRange];
  }

  const middleRange = createRange(leftSiblingIndex, rightSiblingIndex);
  return [firstPageIndex, DOTS_LEFT, ...middleRange, DOTS_RIGHT, lastPageIndex];
};

const isNumberPage = (item: PaginationItem): item is number => typeof item === "number";

export const Pagination: FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  siblingCount = 1,
  className = "",
  ariaLabel = "Pagination",
  showPageSizeSummary = true,
}) => {
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / pageSize)),
    [totalItems, pageSize]
  );

  const clampedCurrentPage = useMemo(
    () => Math.min(Math.max(currentPage, 1), totalPages),
    [currentPage, totalPages]
  );

  const paginationRange = useMemo(
    () => getPaginationRange(clampedCurrentPage, totalItems, pageSize, siblingCount),
    [clampedCurrentPage, totalItems, pageSize, siblingCount]
  );

  const isFirstPage = clampedCurrentPage === 1;
  const isLastPage = clampedCurrentPage === totalPages;

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    if (nextPage !== clampedCurrentPage) {
      onPageChange(nextPage);
    }
  };

  const handleKeyActivate = (
    event: KeyboardEvent<HTMLButtonElement>,
    page: number | "prev" | "next"
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (page === "prev") goToPage(clampedCurrentPage - 1);
      else if (page === "next") goToPage(clampedCurrentPage + 1);
      else goToPage(page);
    }
  };

  const handleClick = (
    event: MouseEvent<HTMLButtonElement>,
    page: number | "prev" | "next"
  ) => {
    event.preventDefault();
    if (page === "prev") goToPage(clampedCurrentPage - 1);
    else if (page === "next") goToPage(clampedCurrentPage + 1);
    else goToPage(page);
  };

  if (totalItems <= 0 || totalPages <= 1) {
    return null;
  }

  const startItem = (clampedCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(clampedCurrentPage * pageSize, totalItems);

  return (
    <nav
      aria-label={ariaLabel}
      className={`flex flex-col gap-2 items-start sm:items-center sm:flex-row sm:justify-between undefined`}
    >
      {showPageSizeSummary && (
        <p className="text-sm text-gray-600">
          Showing <span className="font-medium">{startItem}</span> to{" "}
          <span className="font-medium">{endItem}</span> of{" "}
          <span className="font-medium">{totalItems}</span> results
        </p>
      )}

      <div className="inline-flex items-center gap-1" role="group">
        <button
          type="button"
          onClick={(e) => handleClick(e, "prev")}
          onKeyDown={(e) => handleKeyActivate(e, "prev")}
          disabled={isFirstPage}
          aria-label="Go to previous page"
          className={`relative inline-flex items-center px-3 py-1.5 border text-sm font-medium rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 transition-colors undefined`}
        >
          <span aria-hidden="true">‹</span>
        </button>

        <ul
          className="inline-flex items-center gap-1 list-none m-0 p-0"
          aria-label="Pagination navigation"
        >
          {paginationRange.map((item, index) => {
            if (!isNumberPage(item)) {
              const isLeftDots = item === DOTS_LEFT;
              const ariaDotsLabel = isLeftDots
                ? "Collapsed previous pages"
                : "Collapsed following pages";

              return (
                <li key={`undefined-undefined`}>
                  <span
                    aria-hidden="true"
                    aria-label={ariaDotsLabel}
                    className="inline-flex items-center justify-center px-2 py-1 text-sm text-gray-500 select-none"
                  >
                    …
                  </span>
                </li>
              );
            }

            const isActive = item === clampedCurrentPage;

            return (
              <li key={item}>
                <button
                  type="button"
                  onClick={(e) => handleClick(e, item)}
                  onKeyDown={(e) => handleKeyActivate(e, item)}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={
                    isActive ? `Current page, page undefined` : `Go to page undefined`
                  }
                  className={`relative inline-flex items-center px-3 py-1.5 border text-sm font-medium rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 transition-colors undefined`}
                >
                  {item}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={(e) => handleClick(e, "next")}
          onKeyDown={(e) => handleKeyActivate(e, "next")}
          disabled={isLastPage}
          aria-label="Go to next page"
          className={`relative inline-flex items-center px-3 py-1.5 border text-sm font-medium rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 transition-colors undefined`}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </nav>
  );
};

export default Pagination;