import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/outline";
import React from "react";
import { useTranslation } from "react-i18next";
import { LabeledDropdown } from "./LabeledDropdown";

type PaginationFooterProps = {
  currentPage: number;
  totalPages: number;
  totalRows: number;
  pageBounds: {
    start: number;
    end: number;
  };
  onPageChange: (nextPage: number) => void;
};

export const PaginationFooter: React.FC<PaginationFooterProps> = ({
  currentPage,
  totalPages,
  totalRows,
  pageBounds,
  onPageChange,
}) => {
  const { t } = useTranslation("reports");

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between">
      <div className="text-sm text-gray-700">
        {t("Showing {{start}}–{{end}} of {{total}}", {
          start: pageBounds.start,
          end: pageBounds.end,
          total: totalRows,
        })}
      </div>
      <nav
        className="isolate inline-flex -space-x-px rounded-md shadow-sm"
        aria-label="Pagination"
      >
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={`${
            currentPage === 1
              ? "pointer-events-none opacity-25"
              : "hover:bg-gray-50"
          } relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 focus:z-20 focus:outline-none`}
        >
          <span className="sr-only">{t("Previous")}</span>
          <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={`${
            currentPage === totalPages
              ? "pointer-events-none opacity-25"
              : "hover:bg-gray-50"
          } relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 focus:z-20 focus:outline-none`}
        >
          <span className="sr-only">{t("Next")}</span>
          <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
};

type TablePaddingRowsProps = {
  count: number;
  includeColorColumn?: boolean;
  includeVisibilityColumn?: boolean;
  showPercentColumn?: boolean;
  numericAlign?: "right" | "center";
};

export const TablePaddingRows: React.FC<TablePaddingRowsProps> = ({
  count,
  includeVisibilityColumn = false,
  includeColorColumn = false,
  showPercentColumn = false,
  numericAlign = "right",
}) => {
  if (count <= 0) return null;

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`padding-${i}`}
          className="flex items-center gap-3 px-3 py-2 bg-gray-50/30"
          aria-hidden="true"
        >
        {includeVisibilityColumn && (
          <div className="flex-none w-10 flex justify-center" />
        )}
          {includeColorColumn && (
            <div className="flex-none w-4 flex justify-center" />
          )}
          <div className="flex-1 min-w-0 text-gray-800 text-sm">
            <span className="truncate block invisible">.</span>
          </div>
          <div
            className={`flex-none text-gray-900 tabular-nums text-sm min-w-[80px] ${
              numericAlign === "center" ? "text-center" : "text-right"
            }`}
          >
            <span className="invisible">0</span>
          </div>
          {showPercentColumn && (
            <div className="flex-none text-right text-gray-700 tabular-nums text-sm min-w-[70px]">
              <span className="invisible">&nbsp;</span>
            </div>
          )}
        </div>
      ))}
    </>
  );
};

type PaginationSettingProps = {
  rowsPerPage?: number;
  onChange: (rowsPerPage: number) => void;
};

export const PaginationSetting: React.FC<PaginationSettingProps> = ({
  rowsPerPage = 10,
  onChange,
}) => {
  const { t } = useTranslation("admin:reports");

  const options = [
    { value: "None", label: t("None") },
    { value: "10", label: t("{{count}} items", { count: 10 }) },
    { value: "12", label: t("{{count}} items", { count: 12 }) },
    { value: "15", label: t("{{count}} items", { count: 15 }) },
    { value: "20", label: t("{{count}} items", { count: 20 }) },
  ];

  const value = rowsPerPage === 0 ? "None" : String(rowsPerPage);

  return (
    <LabeledDropdown
      label={t("Pagination")}
      value={value}
      options={options}
      onChange={(val) => onChange(val === "None" ? 0 : Number(val))}
    />
  );
};
