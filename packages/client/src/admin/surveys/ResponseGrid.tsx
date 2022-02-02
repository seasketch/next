import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { getAnswers, getColumnNames } from "../../formElements/ExportUtils";
import { sortFormElements } from "../../formElements/FormElement";
import { useSurveyResponsesQuery } from "../../generated/graphql";
import {
  useTable,
  useSortBy,
  useBlockLayout,
  useFlexLayout,
  useResizeColumns,
} from "react-table";
import { ChevronDownIcon, UploadIcon } from "@heroicons/react/outline";
import DownloadIcon from "../../components/DownloadIcon";
import Papa from "papaparse";

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
      return value.map((v) => valueFormatter(accessor)(v)).join(", ");
    } else if (value === undefined || value === null) {
      return "";
    } else {
      return value.toString();
    }
  };
}

export default function ResponseGrid(props: Props) {
  const { t } = useTranslation("admin:surveys");
  const { data, loading, error } = useSurveyResponsesQuery({
    variables: {
      surveyId: props.surveyId,
    },
  });
  const survey = data?.survey;

  const columns = useMemo(() => {
    if (survey) {
      let columns: string[] = [];
      const formElements = survey?.form?.formElements
        ? sortFormElements(survey.form.formElements)
        : [];
      (survey.form?.formElements || [])
        .filter((el) => el.type?.isInput)
        .forEach((el) => {
          const cols = getColumnNames(
            el.typeId,
            el.exportId!,
            el.componentSettings
          );
          columns.push(...cols);
        });
      return [
        { Header: "id", accessor: "id" },
        {
          Header: "created",
          accessor: "createdAt",
        },
        ...columns.map((accessor) => ({
          Header: accessor,
          accessor: valueFormatter(accessor),
        })),
      ];
    } else {
      return [];
    }
  }, [survey]);

  const rowData = useMemo(() => {
    const formElements = survey?.form?.formElements
      ? sortFormElements(survey.form.formElements)
      : [];
    if (survey?.surveyResponsesConnection.nodes) {
      let rows: any[] = [];
      for (const response of [...survey?.surveyResponsesConnection.nodes].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )) {
        let rowData: { [column: string]: any } = {};
        for (const element of formElements) {
          const answer = response.data[element.id];
          if (answer !== undefined) {
            rowData = {
              ...rowData,
              ...getAnswers(
                element.typeId,
                element.exportId!,
                element.componentSettings,
                answer
              ),
            };
          }
        }
        rows.push({
          id: response.id,
          createdAt: new Date(response.createdAt).toLocaleString([], {
            // @ts-ignore
            timeStyle: "short",
            dateStyle: "medium",
          }),
          ...rowData,
        });
      }
      return rows;
    } else {
      return [];
    }
  }, [survey?.surveyResponsesConnection.nodes]);

  const exportData = useMemo(() => {
    if (rowData.length && columns.length) {
      return Papa.unparse(rowData, { columns: columns.map((c) => c.Header) });
    } else {
      return "";
    }
  }, [rowData, columns]);

  const defaultColumn = useMemo(
    () => ({
      minWidth: 30,
      width: 175,
      maxWidth: 400,
    }),
    []
  );

  const tableInstance = useTable(
    {
      columns,
      data: rowData,
      defaultColumn,
      initialState: {
        sortBy: [{ id: "createdAt", desc: true }],
      },
    },
    useSortBy,
    useFlexLayout,
    useResizeColumns
  );

  if (!data) {
    return null;
  }

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    resetResizing,
  } = tableInstance;

  return (
    <div
      className={`${props.className} px-4 py-4 sm:px-6 lg:px-8 overflow-hidden flex flex-col`}
    >
      <h2 className="text-xl">{t("Survey Responses")}</h2>
      <FakeTabs
        exportData={exportData}
        tabs={[
          {
            name: "All",
            count: survey?.submittedResponseCount || 0,
            href: "#",
            current: true,
          },
          {
            name: "For Review",
            count: 0,
            href: "#",
            current: false,
          },
          {
            name: "Practice",
            count: survey?.practiceResponseCount || 0,
            href: "#",
            current: false,
          },
          {
            name: "Map",
            href: "#",
            current: false,
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
    </div>
  );
}
function FakeTabs({
  tabs,
  exportData,
}: {
  tabs: { current: boolean; name: string; href: string; count?: number }[];
  exportData: string;
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
        >
          {tabs.map((tab) => (
            <option key={tab.name}>{tab.name}</option>
          ))}
        </select>
      </div>
      <div className="hidden sm:block">
        <div className="border-b border-gray-200">
          <nav className="mt-2 -mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <a
                key={tab.name}
                href={tab.href}
                className={`${
                  tab.current
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
                },
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
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
              onClick={(e) => {
                download(
                  exportData,
                  "responses.csv",
                  "text/csv;encoding:utf-8"
                );
              }}
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

var download = function (content: string, fileName: string, mimeType: string) {
  var a = document.createElement("a");
  mimeType = mimeType || "application/octet-stream";

  // @ts-ignore
  if (navigator.msSaveBlob) {
    // IE10
    // @ts-ignore
    navigator.msSaveBlob(
      new Blob([content], {
        type: mimeType,
      }),
      fileName
    );
  } else if (URL && "download" in a) {
    //html5 A[download]
    a.href = URL.createObjectURL(
      new Blob([content], {
        type: mimeType,
      })
    );
    a.setAttribute("download", fileName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    window.location.href =
      "data:application/octet-stream," + encodeURIComponent(content); // only this mime type is supported
  }
};
