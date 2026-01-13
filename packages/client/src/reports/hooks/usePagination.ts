import { useEffect, useMemo, useState } from "react";

export type PaginationResult<T> = {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  paginatedItems: T[];
  paddingRowsCount: number;
  showPagination: boolean;
  totalPages: number;
  totalRows: number;
  pageBounds: {
    start: number;
    end: number;
  };
};

/**
 * Shared pagination state and derived values for tabular report widgets.
 */
export const usePagination = <T>(
  items: T[],
  rowsPerPage: number
): PaginationResult<T> => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalRows = items.length;
  const showPagination = rowsPerPage > 0 && totalRows > rowsPerPage;
  const totalPages = showPagination ? Math.ceil(totalRows / rowsPerPage) : 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [rowsPerPage, totalRows]);

  const paginatedItems = useMemo(() => {
    if (!showPagination) return items;
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, showPagination, currentPage, rowsPerPage]);

  const paddingRowsCount = useMemo(() => {
    if (!showPagination || paginatedItems.length >= rowsPerPage) return 0;
    return rowsPerPage - paginatedItems.length;
  }, [showPagination, paginatedItems.length, rowsPerPage]);

  const pageBounds = useMemo(() => {
    if (!showPagination) {
      return {
        start: totalRows === 0 ? 0 : 1,
        end: totalRows,
      };
    }
    return {
      start: (currentPage - 1) * rowsPerPage + 1,
      end: Math.min(currentPage * rowsPerPage, totalRows),
    };
  }, [showPagination, currentPage, rowsPerPage, totalRows]);

  return {
    currentPage,
    setCurrentPage,
    paginatedItems,
    paddingRowsCount,
    showPagination,
    totalPages,
    totalRows,
    pageBounds,
  };
};
