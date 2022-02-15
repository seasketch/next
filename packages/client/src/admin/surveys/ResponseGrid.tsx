import { useMemo, useState, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { getAnswers, getDataForExport } from "../../formElements/ExportUtils";
import { sortFormElements } from "../../formElements/sortFormElements";
import {
  useToggleResponsesPracticeMutation,
  useSurveyResponsesQuery,
  useArchiveResponsesMutation,
} from "../../generated/graphql";
import {
  useTable,
  useSortBy,
  useBlockLayout,
  useFlexLayout,
  useResizeColumns,
  Row,
  Column,
  useGlobalFilter,
  useRowSelect,
  usePagination,
} from "react-table";
import { ChevronDownIcon, UploadIcon } from "@heroicons/react/outline";
import DownloadIcon from "../../components/DownloadIcon";
import Papa from "papaparse";
import ExportResponsesModal from "./ExportResponsesModal";
import ResponsesAsExported from "./ResponsesAsExported";
import { ConsentValue } from "../../formElements/Consent";
import sortBy from "lodash.sortby";
import { components } from "../../formElements";
import { ErrorBoundary } from "@sentry/react";
import React from "react";
import DropdownButton, {
  DropdownOption,
} from "../../components/DropdownButton";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Spinner from "../../components/Spinner";

interface Props {
  surveyId: number;
  className?: string;
}

export function SkippedQuestion() {
  return (
    <span className="italic text-gray-500">
      <Trans ns="admin:surveys">skipped</Trans>
    </span>
  );
}

const IndeterminateCheckbox = React.forwardRef<
  unknown,
  { indeterminate: boolean }
>(({ indeterminate, ...rest }, ref) => {
  const defaultRef = React.useRef();
  const resolvedRef = ref || defaultRef;

  React.useEffect(() => {
    // @ts-ignore
    resolvedRef.current.indeterminate = indeterminate;
  }, [resolvedRef, indeterminate]);

  return (
    <>
      <input
        type="checkbox"
        // @ts-ignore
        ref={resolvedRef}
        {...rest}
        // @ts-ignore
        className={`focus:ring-primary-500 text-primary-600 border-gray-300 rounded relative -right-0.5 ${rest.className}`}
      />
    </>
  );
});

type TabName = "responses" | "practice" | "archived" | "export";

function filterRows(
  rows: Row<{ isPractice: boolean; archived: boolean }>[],
  selectedTab: TabName
) {
  // return rows;
  if (selectedTab === "responses") {
    return rows.filter((r) => !r.original.isPractice && !r.original.archived);
  } else if (selectedTab === "practice") {
    return rows.filter((r) => r.original.isPractice && !r.original.archived);
  } else if (selectedTab === "archived") {
    return rows.filter((r) => !!r.original.archived);
  } else if (selectedTab === "export") {
    return rows;
  } else {
    throw new Error("Unknown selectedTab");
  }
}

type NameColumn = { name: string | null; email: string | null };

export default function ResponseGrid(props: Props) {
  const { t } = useTranslation("admin:surveys");
  const [showExportModal, setShowExportModal] = useState(false);
  const { data } = useSurveyResponsesQuery({
    variables: {
      surveyId: props.surveyId,
    },
  });
  const survey = data?.survey;
  const [tab, setTab] = useState("responses");
  const onError = useGlobalErrorHandler();
  const [
    togglePractice,
    togglePracticeState,
  ] = useToggleResponsesPracticeMutation({ onError });
  const [
    archiveResponses,
    archiveResponsesState,
  ] = useArchiveResponsesMutation({ onError });

  const rowData = useMemo(() => {
    return survey?.surveyResponsesConnection.nodes || [];
  }, [
    survey?.surveyResponsesConnection.nodes,
    survey?.archivedResponseCount,
    survey?.practiceResponseCount,
    survey?.submittedResponseCount,
  ]);

  const columns = useMemo(() => {
    const NameElement = (data?.survey?.form?.formElements || []).find(
      (el) => el.typeId === "Name"
    );
    const EmailElement = (data?.survey?.form?.formElements || []).find(
      (el) => el.typeId === "Email"
    );
    const ConsentElement = (data?.survey?.form?.formElements || []).find(
      (el) => el.typeId === "Consent"
    );
    const questions = (data?.survey?.form?.formElements || []).filter(
      (el) =>
        el.isInput &&
        el.typeId !== "Name" &&
        el.typeId !== "Email" &&
        el.typeId !== "Consent"
    );
    return [
      // {
      //   Header: "",
      //   width: 40,
      //   id: "select-all",
      //   Cell: ({ row }: { row: Row<any> }) => {
      //     return (
      //       <div className="flex align-middle justify-center items-center">
      //         {/* @ts-ignore */}
      //         <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />
      //         {/* <input
      //           {...row.getToggleRowSelectedProps()}
      //           // onClick={() => {
      //           //   toggleRowSelected(row.id);
      //           // }}
      //           type="checkbox"
      //           className="focus:ring-primary-500 text-primary-600 border-gray-300 rounded relative -right-0.5"
      //           // checked={row.isSelected}
      //         /> */}
      //       </div>
      //     );
      //   },
      // },
      {
        Header: "id",
        accessor: "id",
        width: 50,
      },
      {
        Header: "created",
        accessor: (row: any) => new Date(row.createdAt).toLocaleString(),
        sortDescFirst: true,
        sortType: (a: Row<any>, b: Row<any>) => {
          return (
            new Date(a.original.createdAt).getTime() -
            new Date(b.original.createdAt).getTime()
          );
        },
        width: 180,
      },
      {
        Header: "last updated",
        accessor: (row: any) =>
          row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "Never",
        sortDescFirst: true,
        Cell: ({ row }: { row: Row<any> }) => {
          const { updatedAt, lastUpdatedByEmail } = row.original;
          if (lastUpdatedByEmail) {
            return (
              <div>
                <span title={updatedAt}>
                  {new Date(updatedAt).toLocaleDateString()}
                </span>
                {/*eslint-disable-next-line i18next/no-literal-string*/}
                {" by "}
                {lastUpdatedByEmail}
              </div>
            );
          } else if (updatedAt) {
            return (
              <span title={updatedAt}>
                {new Date(updatedAt).toLocaleDateString()}
              </span>
            );
          } else {
            return "";
          }
        },
        sortType: (a: Row<any>, b: Row<any>) => {
          return (
            new Date(a.original.updatedAt).getTime() -
            new Date(b.original.updatedAt).getTime()
          );
        },
      },
      ...(NameElement
        ? [
            {
              Header: "respondent",
              sortType: (a: Row<any>, b: Row<any>) => {
                return (
                  a.values.respondent.name || a.values.respondent.email
                ).localeCompare(
                  b.values.respondent.name || b.values.respondent.email
                );
              },
              accessor: (row: any) => {
                const data = row.data[NameElement.id];
                if (data?.name) {
                  const { name } = data;
                  const email = EmailElement ? row.data[EmailElement.id] : null;
                  return {
                    name,
                    email,
                  };
                } else {
                  return null;
                }
              },
              Cell: ({ value }: { value: NameColumn }) => {
                if (value === null) {
                  return <SkippedQuestion />;
                }
                if (value.name) {
                  if (value.email) {
                    return (
                      <a
                        className="text-primary-500 underline"
                        href={`mailto:${value.email}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {value.name}
                      </a>
                    );
                  }
                } else if (value.email) {
                  return (
                    <a
                      className="text-primary-500 underline"
                      href={`mailto:${value.email}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {value.email}
                    </a>
                  );
                } else {
                  return "Unknown";
                }
                return value.name ? value.name : "Unknown";
              },
            },
            {
              Header: "facilitator",
              accessor: (row: any) => {
                const data = row.data[NameElement.id];
                return data?.facilitator || null;
              },
              Cell: ({ value }: { value: string | null }) => {
                return value ? value : "None";
              },
            },
          ]
        : []),
      ...(EmailElement && !NameElement
        ? [
            {
              Header: "email",
              accessor: (row: any) => row.data[EmailElement.id],
              Cell: ({ value }: { value: string | null }) => value || "Unknown",
            },
          ]
        : []),
      {
        Header: "account",
        accessor: (row: any) => row.accountEmail,
        Cell: ({ value }: { value: string | null }) =>
          value ? (
            <a
              className="text-primary-500 underline"
              href={`mailto:${value}`}
              target="_blank"
              rel="noreferrer"
            >
              {value}
            </a>
          ) : (
            "Anonymous"
          ),
      },
      ...(ConsentElement
        ? [
            {
              Header: "consent",
              accessor: (row: any) => row.data[ConsentElement.id],
              Cell: ({ value }: { value: ConsentValue }) => {
                if (value === undefined || value === null) {
                  return (
                    <span className="text-grey-500 italic">
                      <Trans ns="admin:surveys">None</Trans>
                    </span>
                  );
                }
                const url = ConsentElement.surveyConsentDocumentsConnection.nodes.find(
                  (doc) => doc.version === value.docVersion
                )?.url;
                return value?.consented ? (
                  <span>
                    {value.clickedDoc ? (
                      <Trans ns="admin:surveys">Clicked</Trans>
                    ) : (
                      <Trans ns="admin:surveys">Agreed to</Trans>
                    )}{" "}
                    <a
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-500 underline"
                      href={url}
                    >
                      {
                        // eslint-disable-next-line i18next/no-literal-string
                        "v"
                      }
                      {value.docVersion}
                    </a>
                    {value.clickedDoc && (
                      <Trans ns="admin:surveys">, agreed</Trans>
                    )}
                  </span>
                ) : (
                  "No"
                );
              },
              sortType: (a: Row<any>, b: Row<any>) => {
                const sorted = sortBy(
                  [a, b],
                  [
                    // "original.consented",
                    "original.clickedDoc",
                    "original.docVersion",
                  ]
                );
                return sorted.indexOf(b) - sorted.indexOf(a);
              },
            },
          ]
        : []),
      ...questions.map((formElement) => ({
        Header: formElement.exportId!,
        accessor: (row: any) => row.data[formElement.id],
        Cell: ({ value }: { value: any }) => {
          const C = components[formElement.typeId];
          if (value === undefined || value === null) {
            return <SkippedQuestion />;
          }
          if (C.ResponseGridCell) {
            return (
              <C.ResponseGridCell
                value={value}
                componentSettings={formElement.componentSettings}
              />
            );
          } else {
            return value.toString();
          }
        },
      })),
    ];
  }, [data?.survey]);

  const defaultColumn = useMemo(
    () => ({
      minWidth: 30,
      width: 175,
      maxWidth: 800,
    }),
    []
  );

  const getRowId = useMemo(() => (row: any) => row.id, []);

  const globalFilter = useMemo(() => {
    return (
      rows: Row<{ isPractice: boolean; archived: boolean }>[],
      columnIds: any,
      selectedTab: TabName
    ) => {
      return filterRows(rows, selectedTab) as Row<any>[];
    };
  }, [survey?.surveyResponsesConnection.nodes]);

  const tableInstance = useTable(
    {
      // @ts-ignore
      columns,
      data: rowData,
      defaultColumn,
      getRowId,
      initialState: {
        sortBy: [{ id: "created", desc: true }],
        globalFilter: tab,
        // @ts-ignore
        selectedRowIds: [],
      },
      globalFilter,
    },
    useGlobalFilter,
    useSortBy,
    useFlexLayout,
    useResizeColumns,
    usePagination,
    useRowSelect,
    (hooks: any) => {
      hooks.visibleColumns.push((columns: any) => [
        // Let's make a column for selection
        {
          width: 40,
          id: "selection",
          // The header can use the table's getToggleAllRowsSelectedProps method
          // to render a checkbox
          Header: ({
            getToggleAllPageRowsSelectedProps,
          }: {
            getToggleAllPageRowsSelectedProps: any;
          }) => (
            <IndeterminateCheckbox
              className="-ml-1"
              {...getToggleAllPageRowsSelectedProps()}
            />
          ),
          // The cell can use the individual row's getToggleRowSelectedProps method
          // to the render a checkbox
          Cell: ({
            row,
          }: {
            row: { getToggleRowSelectedProps: () => any };
          }) => (
            <div>
              {/* @ts-ignore */}
              <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />
            </div>
          ),
        },
        ...columns,
      ]);
    }
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    setGlobalFilter,
    selectedFlatRows,
    state: { selectedRowIds },
  } = tableInstance;

  useEffect(() => {
    setGlobalFilter(tab);
  }, [tab]);

  if (!data) {
    return null;
  }

  return (
    <div
      className={`${props.className} px-0 pt-0 overflow-hidden flex flex-col`}
    >
      <FakeTabs
        mutating={togglePracticeState.loading || archiveResponsesState.loading}
        disableDropdownButton={selectedFlatRows.length === 0}
        dropdownOptions={[
          ...(tab !== "export" && tab !== "archived"
            ? [
                {
                  label: tab === "practice" ? "Responses" : "Practice",
                  onClick: () => {
                    togglePractice({
                      variables: {
                        ids: selectedFlatRows.map((r) => parseInt(r.id)),
                        isPractice: tab !== "practice",
                      },
                    });
                  },
                },
              ]
            : []),
          ...(tab !== "export"
            ? [
                {
                  label: tab === "archived" ? "Responses" : "Archived",
                  onClick: () => {
                    archiveResponses({
                      variables: {
                        ids: selectedFlatRows.map((r) => parseInt(r.id)),
                        makeArchived: tab !== "archived",
                      },
                    });
                  },
                },
              ]
            : []),
        ]}
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
            count: data.survey?.archivedResponseCount || 0,
            href: "#",
            current: tab === "archived",
          },
          {
            id: "export",
            name: "As Exported",
            count: 0,
            href: "#",
            current: tab === "export",
          },
        ]}
      />
      <div className="overflow-x-auto text-sm flex-1 overflow-y-auto">
        {tab === "export" ? (
          <ResponsesAsExported
            rules={data.survey?.form?.logicRules || []}
            formElements={data.survey?.form?.formElements || []}
            responses={data.survey?.surveyResponsesConnection.nodes || []}
          />
        ) : (
          <div
            {...getTableProps()}
            className="border-collapse border-2 border-t-0 inline-block"
          >
            <div className="bg-gray-50">
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
                              className={`whitespace-nowrap px-2 py-1 inline-flex align-middle border truncate ${
                                row.isSelected
                                  ? "border-blue-500 border-opacity-30 bg-blue-300 bg-opacity-5"
                                  : "border-gray-200"
                              }`}
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
        )}
      </div>
      <ExportResponsesModal
        onRequestData={(includePractice) => {
          const { rows, columns } = getDataForExport(
            survey?.surveyResponsesConnection.nodes || [],
            survey?.form?.formElements || [],
            data?.survey?.form?.logicRules || []
          );
          return Papa.unparse(
            rows.filter(
              (r) => (!r.is_practice || includePractice) && !r.archived
            ),
            {
              columns,
            }
          );
        }}
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
  disableDropdownButton,
  dropdownOptions,
  mutating,
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
  disableDropdownButton: boolean;
  dropdownOptions: DropdownOption[];
  mutating: boolean;
}) {
  const { t } = useTranslation("admin:surveys");
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
          <nav
            className="mt-2 -mb-px flex space-x-2 items-center"
            aria-label="Tabs"
          >
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
            <DropdownButton
              className="-mt-1"
              disabled={disableDropdownButton || mutating}
              label={t("Move to")}
              options={dropdownOptions}
            />
            {mutating && <Spinner className="pl-2" />}
          </nav>
        </div>
      </div>
    </>
  );
}
