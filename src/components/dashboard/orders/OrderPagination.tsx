'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PageNumber = number | 'ellipsis';

function PageBtn({
  children,
  active = false,
  disabled = false,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      style={{ fontSize: '12px', minHeight: 0, padding: 0 }}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition ${
        active
          ? 'bg-[#2563EB] text-white shadow-xs'
          : disabled
          ? 'cursor-not-allowed text-[#CBD5E1]'
          : 'text-[#475569] hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function getPageNumbers(currentPage: number, totalPages: number): PageNumber[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 'ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

interface OrderPaginationProps {
  currentPage: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export default function OrderPagination({
  currentPage,
  totalPages,
  startItem,
  endItem,
  totalItems,
  onPageChange,
}: OrderPaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);
  const pageNumbers = getPageNumbers(safeCurrentPage, safeTotalPages);

  const hasPrevious = safeCurrentPage > 1;
  const hasNext = safeCurrentPage < safeTotalPages;

  return (
    <div className="flex flex-col gap-3 border-t border-[#E2E8F0] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="text-center text-xs font-medium text-[#64748B] sm:text-left">
        {totalItems === 0
          ? 'No orders'
          : `Showing ${startItem}–${endItem} of ${totalItems} orders`}
      </p>

      <div className="flex items-center justify-center gap-1 sm:gap-1.5">
        {/* Previous */}
        <PageBtn
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={!hasPrevious}
          ariaLabel="Previous page"
        >
          <ChevronLeft size={16} />
        </PageBtn>

        {/* Page numbers */}
        {pageNumbers.map((pageNumber, index) => {
          if (pageNumber === 'ellipsis') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="flex h-8 w-6 items-center justify-center text-xs font-semibold text-slate-400 sm:h-9 sm:w-7"
                style={{ fontSize: '12px' }}
              >
                ...
              </span>
            );
          }

          return (
            <PageBtn
              key={pageNumber}
              active={pageNumber === safeCurrentPage}
              onClick={() => onPageChange(pageNumber)}
              ariaLabel={`Page ${pageNumber}`}
            >
              {pageNumber}
            </PageBtn>
          );
        })}

        {/* Next */}
        <PageBtn
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={!hasNext}
          ariaLabel="Next page"
        >
          <ChevronRight size={16} />
        </PageBtn>
      </div>
    </div>
  );
}
