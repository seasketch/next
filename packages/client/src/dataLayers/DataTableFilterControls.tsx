import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cross2Icon } from "@radix-ui/react-icons";
import * as Popover from "@radix-ui/react-popover";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import { DataTableFilter } from "./dataTableQueryApi";
import DataTableNumericFilter, {
  defaultNumericFilters,
} from "./DataTableNumericFilter";
import DataTableStringFilter from "./DataTableStringFilter";

function filtersForColumn(filters: DataTableFilter[], column: string) {
  return filters.filter((filter) => filter.column === column);
}

function replaceColumnFilters(
  filters: DataTableFilter[],
  column: string,
  replacements: DataTableFilter[]
) {
  const next: DataTableFilter[] = [];
  let inserted = false;
  for (const filter of filters) {
    if (filter.column === column) {
      if (!inserted) {
        next.push(...replacements);
        inserted = true;
      }
      continue;
    }
    next.push(filter);
  }
  if (!inserted) {
    next.push(...replacements);
  }
  return next;
}

function nullMode(filters: DataTableFilter[]) {
  if (filters.some((filter) => filter.op === "isNull")) {
    return "isNull";
  }
  if (filters.some((filter) => filter.op === "notNull")) {
    return "notNull";
  }
  return "value";
}

function BooleanColumnFilter({
  column,
  filters,
  onChange,
}: {
  column: GeostatsAttribute;
  filters: DataTableFilter[];
  onChange: (filters: DataTableFilter[]) => void;
}) {
  const { t } = useTranslation("homepage");
  const filter = filters[0];
  const value =
    filter?.op === "eq" && filter.value !== undefined ? filter.value : filter?.op;
  return (
    <select
      className="min-w-0 max-w-[58%] text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white"
      value={value || "notNull"}
      onChange={(e) => {
        const next = e.target.value;
        if (next === "true" || next === "false") {
          onChange([{ column: column.attribute, op: "eq", value: next }]);
        } else {
          onChange([
            {
              column: column.attribute,
              op: next as "isNull" | "notNull",
            },
          ]);
        }
      }}
    >
      <option value="true">{t("True")}</option>
      <option value="false">{t("False")}</option>
      <option value="notNull">{t("Has a value")}</option>
      <option value="isNull">{t("Is blank")}</option>
    </select>
  );
}

function DateColumnFilter({
  column,
  filters,
  onChange,
}: {
  column: GeostatsAttribute;
  filters: DataTableFilter[];
  onChange: (filters: DataTableFilter[]) => void;
}) {
  const { t } = useTranslation("homepage");
  const mode = nullMode(filters);
  const startValue = filters.find((filter) => filter.op === "gte")?.value || "";
  const endValue = filters.find((filter) => filter.op === "lte")?.value || "";

  const setRange = (nextStart: string, nextEnd: string) => {
    const next: DataTableFilter[] = [];
    if (nextStart !== "") {
      next.push({ column: column.attribute, op: "gte", value: nextStart });
    }
    if (nextEnd !== "") {
      next.push({ column: column.attribute, op: "lte", value: nextEnd });
    }
    onChange(next.length ? next : [{ column: column.attribute, op: "notNull" }]);
  };

  return (
    <div className="space-y-1 min-w-0 flex-1">
      <select
        className="w-full text-xs border border-gray-300 rounded px-1.5 py-1 bg-white"
        value={mode}
        onChange={(e) => {
          const nextMode = e.target.value as "value" | "isNull" | "notNull";
          if (nextMode === "isNull" || nextMode === "notNull") {
            onChange([{ column: column.attribute, op: nextMode }]);
          } else {
            setRange(startValue, endValue);
          }
        }}
      >
        <option value="value">{t("Date range")}</option>
        <option value="notNull">{t("Has a value")}</option>
        <option value="isNull">{t("Is blank")}</option>
      </select>
      {mode === "value" && (
        <div className="grid grid-cols-2 gap-1">
          <input
            type="date"
            className="w-full text-xs border border-gray-300 rounded px-1.5 py-1"
            value={startValue}
            onChange={(e) => setRange(e.target.value, endValue)}
          />
          <input
            type="date"
            className="w-full text-xs border border-gray-300 rounded px-1.5 py-1"
            value={endValue}
            onChange={(e) => setRange(startValue, e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

function isStringLikeColumn(column: GeostatsAttribute) {
  const type = column.type as string;
  return (
    type !== "number" &&
    type !== "boolean" &&
    type !== "date" &&
    type !== "timestamp"
  );
}

function defaultFiltersForColumn(column: GeostatsAttribute): DataTableFilter[] {
  if (column.type === "number") {
    return defaultNumericFilters(column);
  }
  if (isStringLikeColumn(column)) {
    const firstValue = Object.keys(column.values || {}).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    )[0];
    if (firstValue) {
      return [{ column: column.attribute, op: "eq", value: firstValue }];
    }
  }
  return [{ column: column.attribute, op: "notNull" }];
}

function FilterValueEditor({
  column,
  filters,
  onChange,
}: {
  column: GeostatsAttribute;
  filters: DataTableFilter[];
  onChange: (filters: DataTableFilter[]) => void;
}) {
  if (column.type === "number") {
    return (
      <DataTableNumericFilter
        column={column}
        filters={filters}
        onChange={onChange}
      />
    );
  }
  if (column.type === "boolean") {
    return (
      <BooleanColumnFilter
        column={column}
        filters={filters}
        onChange={onChange}
      />
    );
  }
  if ((column.type as string) === "date" || (column.type as string) === "timestamp") {
    return (
      <DateColumnFilter
        column={column}
        filters={filters}
        onChange={onChange}
      />
    );
  }
  return (
    <DataTableStringFilter
      column={column}
      filters={filters}
      onChange={onChange}
    />
  );
}

export default function DataTableFilterControls({
  columns,
  filters,
  visualizedColumns,
  onChange,
}: {
  columns: GeostatsAttribute[];
  filters: DataTableFilter[];
  visualizedColumns: string[];
  onChange: (filters: DataTableFilter[]) => void;
}) {
  const { t } = useTranslation("homepage");
  const excludedColumns = useMemo(
    () => new Set(visualizedColumns.filter(Boolean)),
    [visualizedColumns]
  );
  const columnsByName = useMemo(
    () => new Map(columns.map((column) => [column.attribute, column])),
    [columns]
  );
  // Stable display order: never follow "last edited" position in `filters`.
  const activeColumnNames = useMemo(
    () =>
      Array.from(new Set(filters.map((filter) => filter.column)))
        .filter(
          (column) => columnsByName.has(column) && !excludedColumns.has(column)
        )
        .sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        ),
    [columnsByName, excludedColumns, filters]
  );
  const availableColumns = useMemo(
    () =>
      columns
        .filter(
          (column) =>
            !excludedColumns.has(column.attribute) &&
            !activeColumnNames.includes(column.attribute)
        )
        .sort((a, b) =>
          a.attribute.localeCompare(b.attribute, undefined, {
            sensitivity: "base",
          })
        ),
    [activeColumnNames, columns, excludedColumns]
  );
  const [addFilterOpen, setAddFilterOpen] = useState(false);

  if (columns.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      {activeColumnNames.length > 0 && (
        <h6 className="text-[11px] font-medium text-gray-500">{t("Filters")}</h6>
      )}
      {activeColumnNames.map((columnName) => {
        const column = columnsByName.get(columnName)!;
        const columnFilters = filtersForColumn(filters, columnName);
        const compact =
          isStringLikeColumn(column) ||
          column.type === "boolean" ||
          column.type === "number";
        return (
          <div
            key={columnName}
            className={
              compact
                ? "flex items-center gap-2 min-w-0"
                : "rounded border border-gray-200 bg-gray-50 px-2 py-2 space-y-1.5"
            }
          >
            {compact ? (
              <>
                <span
                  title={column.attribute}
                  className="min-w-0 flex-1 truncate text-xs font-medium text-gray-700"
                >
                  {column.attribute}
                </span>
                <FilterValueEditor
                  column={column}
                  filters={columnFilters}
                  onChange={(nextFilters) =>
                    onChange(
                      replaceColumnFilters(filters, columnName, nextFilters)
                    )
                  }
                />
                <button
                  type="button"
                  aria-label={t("Remove filter")}
                  className="flex-none text-gray-400 hover:text-red-600"
                  onClick={() =>
                    onChange(
                      filters.filter((filter) => filter.column !== columnName)
                    )
                  }
                >
                  <Cross2Icon className="w-3 h-3" />
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-700 truncate">
                      {column.attribute}
                    </div>
                    <div className="text-[10px] text-gray-400">{column.type}</div>
                  </div>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-600"
                    onClick={() =>
                      onChange(
                        filters.filter((filter) => filter.column !== columnName)
                      )
                    }
                  >
                    <Cross2Icon className="w-3 h-3" />
                  </button>
                </div>
                <FilterValueEditor
                  column={column}
                  filters={columnFilters}
                  onChange={(nextFilters) =>
                    onChange(
                      replaceColumnFilters(filters, columnName, nextFilters)
                    )
                  }
                />
              </>
            )}
          </div>
        );
      })}
      {availableColumns.length > 0 && (
        <Popover.Root open={addFilterOpen} onOpenChange={setAddFilterOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="text-xs rounded border border-gray-300 bg-white px-2 py-1 text-gray-700 hover:bg-gray-50"
            >
              {t("Add filter+")}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              className="z-50 w-56 rounded-md border border-black/10 bg-white p-1 shadow-lg"
            >
              <div className="max-h-52 overflow-y-auto">
                {availableColumns.map((column) => (
                  <button
                    key={column.attribute}
                    type="button"
                    className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-50"
                    onClick={() => {
                      onChange([
                        ...filters,
                        ...defaultFiltersForColumn(column),
                      ]);
                      setAddFilterOpen(false);
                    }}
                  >
                    <span className="block truncate text-gray-800">
                      {column.attribute}
                    </span>
                    <span className="block text-[10px] text-gray-500">
                      {column.type}
                    </span>
                  </button>
                ))}
              </div>
              <Popover.Arrow className="fill-white" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
      {availableColumns.length === 0 && activeColumnNames.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          {t("No filterable columns available.")}
        </p>
      )}
    </div>
  );
}
