import { useMemo, useState, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { getAnswers, getDataForExport } from "../../formElements/ExportUtils";
import { sortFormElements } from "../../formElements/sortFormElements";
import { useSurveyResponsesQuery } from "../../generated/graphql";
import {
  useTable,
  useSortBy,
  useBlockLayout,
  useFlexLayout,
  useResizeColumns,
  Row,
  Column,
  useGlobalFilter,
} from "react-table";
import { ChevronDownIcon, UploadIcon } from "@heroicons/react/outline";
import DownloadIcon from "../../components/DownloadIcon";
import Papa from "papaparse";
import ExportResponsesModal from "./ExportResponsesModal";

interface Props {
  surveyId: number;
  className?: string;
}

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

type TabName = "responses" | "practice" | "archived";

function filterRows(
  rows: Row<{ is_practice: boolean; is_archived: boolean }>[],
  selectedTab: TabName
) {
  if (selectedTab === "responses") {
    const filtered = rows.filter((r) => !r.original.is_practice);
    return filtered;
  } else if (selectedTab === "practice") {
    return rows.filter((r) => r.original.is_practice);
  } else if (selectedTab === "archived") {
    return rows.filter((r) => !!r.original.is_archived);
  } else {
    throw new Error("Unknown selectedTab");
  }
}

export default function ResponseGrid(props: Props) {
  const { t } = useTranslation("admin:surveys");
  const [showExportModal, setShowExportModal] = useState(false);
  const { data, loading, error } = useSurveyResponsesQuery({
    variables: {
      surveyId: props.surveyId,
    },
  });
  const survey = data?.survey;
  const [tab, setTab] = useState("responses");

  const { rows: rowData, columns: exportColumnNames } = useMemo(() => {
    return getDataForExport(
      survey?.surveyResponsesConnection.nodes || [],
      survey?.form?.formElements || []
    );
  }, [survey?.surveyResponsesConnection.nodes]);

  const columns = useMemo<Column[]>(() => {
    if (survey) {
      let columns: string[] = [];
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
            (c) =>
              c !== "created_at_utc" && c !== "updated_at_utc" && c !== "id"
          )
          .map((h) => ({ Header: h, accessor: valueFormatter(h) })),
      ];
    } else {
      return [];
    }
  }, [survey, exportColumnNames]);

  const exportData = useMemo(() => {
    if (rowData.length && columns.length) {
      return Papa.unparse(
        rowData.filter((r) => !r.is_practice),
        {
          columns: exportColumnNames,
        }
      );
    } else {
      return "";
    }
  }, [rowData, columns]);

  const defaultColumn = useMemo(
    () => ({
      minWidth: 30,
      width: 175,
      maxWidth: 800,
    }),
    []
  );

  const globalFilter = useMemo(() => {
    return (rows: any[], columnIds: any, selectedTab: TabName) => {
      // @ts-ignore
      return filterRows(rows, selectedTab) as Row[];
    };
  }, []);

  const tableInstance = useTable(
    {
      columns,
      data: rowData,
      defaultColumn,
      initialState: {
        sortBy: [{ id: "created_at_utc", desc: true }],
        globalFilter: tab,
      },
      globalFilter,
    },
    useGlobalFilter,
    useSortBy,
    useFlexLayout,
    useResizeColumns
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    resetResizing,
    setGlobalFilter,
  } = tableInstance;

  useEffect(() => {
    setGlobalFilter(tab);
  }, [tab]);

  if (!data) {
    return null;
  }

  return (
    <div
      className={`${props.className} px-0 py-4 pt-0 overflow-hidden flex flex-col`}
    >
      <FakeTabs
        onClickExport={() => setShowExportModal(true)}
        onChange={(value) => setTab(value)}
        tabs={[
          {
            id: "responses",
            name: "Survey Responses",
            count: survey?.submittedResponseCount || 0,
            href: "#",
            current: tab === "responses",
          },
          {
            id: "practice",
            name: "Practice Responses",
            count: survey?.practiceResponseCount || 0,
            href: "#",
            current: tab === "practice",
          },
          {
            id: "archived",
            name: "Archived",
            count: 0,
            href: "#",
            current: tab === "archived",
          },
        ]}
      />
      <div className="overflow-x-auto text-sm flex-1 overflow-y-auto">
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
                        {/* <div
                          className="border-gray-500 border w-content absolute px-0.5 text-xs bg-white rounded right-2 top-1/2 -mt-1.5 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <ChevronDownIcon className="w-3 h-3 text-gray-500" />
                        </div> */}
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
      </div>
      <ExportResponsesModal
        dataForExport={exportData}
        open={showExportModal}
        onRequestClose={() => setShowExportModal(false)}
        spatialFormElements={(data.survey?.form?.formElements || [])?.filter(
          (el) => el.type?.isSpatial
        )}
        surveyId={props.surveyId}
      />
    </div>
  );
}
function FakeTabs({
  tabs,
  onClickExport,
  onChange,
}: {
  tabs: {
    current: boolean;
    name: string;
    href: string;
    count?: number;
    id: string;
  }[];
  onClickExport: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <div className="sm:hidden">
        <label htmlFor="tabs" className="sr-only">
          {
            // eslint-disable-next-line i18next/no-literal-string
            "Select a tab"
          }
        </label>
        {/* Use an "onChange" listener to redirect the user to the selected tab URL. */}
        <select
          id="tabs"
          name="tabs"
          className="mt-4 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          defaultValue={tabs.find((tab) => tab.current)!.name}
          onChange={(e) => onChange(e.target.value)}
        >
          {tabs.map((tab) => (
            <option value={tab.id} key={tab.name}>
              {tab.name}
            </option>
          ))}
        </select>
      </div>
      <div className="hidden sm:block">
        <div className="border-b border-gray-200">
          <nav className="mt-2 -mb-px flex space-x-2" aria-label="Tabs">
            {tabs.map((tab) => (
              <a
                key={tab.name}
                href={tab.href}
                onClick={() => onChange(tab.id)}
                className={`${
                  tab.current
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
                },
                  whitespace-nowrap py-4 border-b-2 font-medium text-sm px-3`}
              >
                {tab.name}
                {tab.count ? (
                  <span
                    className={`${
                      tab.current
                        ? "bg-blue-100 text-primary-600"
                        : "bg-gray-100 text-gray-900"
                    }
                      hidden ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium md:inline-block`}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </a>
            ))}
            <button
              className="text-gray-500 px-1 py-4 text-sm font-medium border-b-2 border-transparent"
              onClick={onClickExport}
            >
              <Trans ns="admin:surveys">Export</Trans>
              <DownloadIcon className="w-4 h-4 mx-2 -mt-0.5" />
            </button>
          </nav>
        </div>
      </div>
    </>
  );
}
