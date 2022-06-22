import { useMemo } from "react";
import { getDataForExport } from "../../formElements/ExportUtils";
import {
  FormElementDetailsFragment,
  SurveyAppRuleFragment,
  SurveyResponseFragment,
} from "../../generated/graphql";
import {
  useTable,
  useSortBy,
  useFlexLayout,
  useResizeColumns,
  Row,
  Column,
  useGlobalFilter,
} from "react-table";

function valueFormatter(accessor: string) {
  return (row: any): string => {
    const value = row[accessor];
    if (value === true) {
      return "True";
    } else if (value === false) {
      return "False";
    } else if (Array.isArray(value)) {
      return value.map((v) => v.toString()).join(", ");
    } else if (value === undefined || value === null) {
      return "";
    } else {
      return value.toString();
    }
  };
}

interface Props {
  responses: SurveyResponseFragment[];
  formElements: FormElementDetailsFragment[];
  rules: SurveyAppRuleFragment[];
}

export default function ResponsesAsExported(props: Props) {
  const { rows: rowData, columns: exportColumnNames } = useMemo(() => {
    return getDataForExport(props.responses, props.formElements, props.rules);
  }, [props.formElements, props.responses, props.rules]);

  const columns = useMemo<Column[]>(() => {
    return [
      {
        Header: "id",
        accessor: "id",
      },
      {
        Header: "created_at_utc",
        accessor: "created_at_utc",
        sortDescFirst: true,
        sortType: (a: Row, b: Row) =>
          new Date(a.values.created_at_utc).getTime() -
          new Date(b.values.created_at_utc).getTime(),
      },
      {
        Header: "updated_at_utc",
        accessor: "updated_at_utc",
        sortDescFirst: true,
        sortType: (a: Row, b: Row) =>
          new Date(a.values.updated_at_utc).getTime() -
          new Date(b.values.updated_at_utc).getTime(),
      },
      ...exportColumnNames
        .filter(
          (c) => c !== "created_at_utc" && c !== "updated_at_utc" && c !== "id"
        )
        .map((h) => ({ Header: h, accessor: valueFormatter(h) })),
    ];
  }, [exportColumnNames]);

  const defaultColumn = useMemo(
    () => ({
      minWidth: 30,
      width: 175,
      maxWidth: 800,
    }),
    []
  );

  const tableInstance = useTable(
    {
      columns,
      data: rowData,
      defaultColumn,
      initialState: {
        sortBy: [{ id: "created_at_utc", desc: true }],
      },
    },
    useGlobalFilter,
    useSortBy,
    useFlexLayout,
    useResizeColumns
  );

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    tableInstance;

  return (
    <div
      {...getTableProps()}
      className="border-collapse border-2 border-t-0 inline-block"
    >
      <div className="bg-gray-50 ">
        {
          // Loop over the header rows
          headerGroups.map((headerGroup) => (
            // Apply the header row props
            <div {...headerGroup.getHeaderGroupProps()}>
              {
                // Loop over the headers in each row
                headerGroup.headers.map((column) => (
                  // Apply the header cell props
                  <div
                    {...column.getHeaderProps()}
                    {...column.getHeaderProps()}
                    className="select-none group font-semibold inline-block truncate overflow-hidden text-gray-500 text-left border border-gray-200 whitespace-nowrap cursor-pointer hover:border-gray-300 relative"
                  >
                    <div
                      className="py-2 px-2 truncate"
                      {...column.getSortByToggleProps()}
                    >
                      <span className="text-gray-400 text-xs mr-1">
                        {column.isSorted
                          ? column.isSortedDesc
                            ? " ▼"
                            : " ▲"
                          : ""}
                      </span>
                      {
                        // Render the header
                        column.render("Header")
                      }
                    </div>
                    <div
                      {...column.getResizerProps()}
                      className={`w-1 bg-gray-50 inline-block h-full absolute right-0 top-0 ${
                        column.isResizing ? "isResizing" : ""
                      }`}
                    />
                  </div>
                ))
              }
            </div>
          ))
        }
      </div>
      {/* Apply the table body props */}
      <div {...getTableBodyProps()} className="inline-block">
        {
          // Loop over the table rows
          rows.map((row) => {
            // Prepare the row for display
            prepareRow(row);
            return (
              // Apply the row props
              <div
                {...row.getRowProps()}
                className={`inline-block ${
                  row.index % 2 ? "bg-gray-50" : "bg-white"
                }`}
              >
                {
                  // Loop over the rows cells
                  row.cells.map((cell) => {
                    // Apply the cell props
                    return (
                      <div
                        className="inline-block whitespace-nowrap px-2 py-1 border border-gray-200 truncate"
                        {...cell.getCellProps()}
                      >
                        {
                          // Render the cell contents
                          cell.render("Cell")
                        }
                      </div>
                    );
                  })
                }
              </div>
            );
          })
        }
      </div>
    </div>
  );
}
