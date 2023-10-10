import { useMemo, useState, useEffect, ReactNode, useRef } from "react";
import { Trans, useTranslation } from "react-i18next";
import { getDataForExport } from "../../formElements/ExportUtils";
import {
  useToggleResponsesPracticeMutation,
  useSurveyResponsesQuery,
  useArchiveResponsesMutation,
  useModifyAnswersMutation,
} from "../../generated/graphql";
import {
  useTable,
  useSortBy,
  useFlexLayout,
  useResizeColumns,
  Row,
  useGlobalFilter,
  useRowSelect,
  usePagination,
  Cell,
} from "react-table";
import DownloadIcon from "../../components/DownloadIcon";
import Papa from "papaparse";
import ExportResponsesModal from "./ExportResponsesModal";
import ResponsesAsExported from "./ResponsesAsExported";
import { ConsentValue } from "../../formElements/Consent";
import sortBy from "lodash.sortby";
import { components } from "../../formElements";
import React from "react";
import DropdownButton, {
  DropdownOption,
} from "../../components/DropdownButton";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Spinner from "../../components/Spinner";
import EditableResponseCell, {
  CellEditorComponent,
  CellEditorContext,
  EditorsList,
} from "./EditableResponseCell";
import { areEqual, FixedSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import Badge from "../../components/Badge";

const ITEM_SIZE = 35;
interface Props {
  surveyId: number;
  className?: string;
  highlightedRows: number[];
  onSelectionChange?: (selection: number[]) => void;
  onTabChange?: (tab: ResponseGridTabName) => void;
  onNewMapTilesRequired: () => void;
}

export function SkippedQuestion() {
  return (
    <span className="italic text-gray-500">
      <Trans ns="admin:surveys">skipped</Trans>
    </span>
  );
}

function normalizeRespondent(
  respondent: string | { name?: string; email?: string } | null | undefined
) {
  if (typeof respondent === "string") {
    return respondent;
  } else if (respondent === null || respondent === undefined) {
    return "";
  } else {
    return respondent.name || respondent.email || "";
  }
}

const FacilitatorEditor: CellEditorComponent<
  | {
      name?: string;
      facilitator?: string;
    }
  | null
  | undefined
> = ({ value, disabled, onChange, onRequestSave, onRequestCancel }) => {
  const [val, setVal] = useState(value);

  useEffect(() => {
    onChange(val);
  }, [val]);

  return (
    <input
      disabled={disabled}
      autoFocus
      type="text"
      value={val?.facilitator || ""}
      onChange={(e) =>
        setVal((prev) => ({ ...prev, facilitator: e.target.value }))
      }
      className={`p-1 block w-full h-full rounded m-0 ${
        disabled && "opacity-50 pointer-events-none"
      }`}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onRequestSave();
          e.preventDefault();
          e.stopPropagation();
        } else if (e.key === "Escape") {
          onRequestCancel();
        }
      }}
    />
  );
};

const RespondentEditor: CellEditorComponent<
  | {
      name?: string;
      facilitator?: string;
    }
  | null
  | undefined
> = ({ value, disabled, onChange, onRequestSave, onRequestCancel }) => {
  const [val, setVal] = useState(value);

  useEffect(() => {
    onChange(val);
  }, [val]);

  return (
    <input
      disabled={disabled}
      autoFocus
      placeholder="name"
      type="text"
      value={val?.name || ""}
      onChange={(e) => setVal((prev) => ({ ...prev, name: e.target.value }))}
      className={`p-1 block w-full h-full rounded m-0 ${
        disabled && "opacity-50 pointer-events-none"
      }`}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onRequestSave();
          e.preventDefault();
          e.stopPropagation();
        } else if (e.key === "Escape") {
          onRequestCancel();
        }
      }}
    />
  );
};

const EmailEditor: CellEditorComponent<string | null | undefined> = ({
  value,
  disabled,
  onChange,
  onRequestSave,
  onRequestCancel,
}) => {
  const [val, setVal] = useState(value);

  useEffect(() => {
    onChange(val);
  }, [val]);

  return (
    <input
      placeholder="email"
      disabled={disabled}
      autoFocus
      type="text"
      value={val || ""}
      onChange={(e) => setVal((prev) => e.target.value)}
      className={`p-1 block w-full h-full rounded m-0 ${
        disabled && "opacity-50 pointer-events-none"
      }`}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onRequestSave();
          e.preventDefault();
          e.stopPropagation();
        } else if (e.key === "Escape") {
          onRequestCancel();
        }
      }}
    />
  );
};

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

export type ResponseGridTabName =
  | "responses"
  | "practice"
  | "archived"
  | "export";

function filterRows(
  rows: Row<{ isPractice: boolean; archived: boolean }>[],
  selectedTab: ResponseGridTabName
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
  const [togglePractice, togglePracticeState] =
    useToggleResponsesPracticeMutation({
      onError,
      onCompleted: props.onNewMapTilesRequired,
    });
  const [archiveResponses, archiveResponsesState] = useArchiveResponsesMutation(
    {
      onError,
      onCompleted: props.onNewMapTilesRequired,
    }
  );
  const [modifyAnswers, modifyAnwersState] = useModifyAnswersMutation({});
  const [editingCell, setEditingCell] = useState(false);
  const scrollContainer = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (props.onTabChange) {
      props.onTabChange(tab as ResponseGridTabName);
    }
  }, [tab]);

  useEffect(() => {
    if (
      props.highlightedRows.length &&
      data?.survey?.surveyResponsesConnection.nodes &&
      scrollContainer.current
    ) {
      const index = rows.findIndex(
        (r) => parseInt(r.id) === props.highlightedRows[0]
      );
      if (index > -1) {
        (scrollContainer.current.childNodes[0] as HTMLDivElement).scrollTop =
          ITEM_SIZE * index - 100;
      }
      toggleAllRowsSelected(false);
      for (const id of props.highlightedRows) {
        toggleRowSelected(id.toString(), true);
      }
    }
  }, [props.highlightedRows]);

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
    const valueUpdater = (rowId: number) => (value: any) => {
      const variables = {
        responseIds: [rowId],
        answers: {
          ...value,
        },
      };
      return modifyAnswers({
        variables,
      });
    };
    return [
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
                return normalizeRespondent(a.values.respondent).localeCompare(
                  normalizeRespondent(b.values.respondent)
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
              Cell: ({ value, row }: { value: NameColumn; row: Row<any> }) => {
                let cellContents: ReactNode = "Unknown";
                if (value === null) {
                  <SkippedQuestion />;
                } else if (value.name) {
                  if (value.email) {
                    cellContents = (
                      <a
                        className="text-primary-500 underline"
                        href={`mailto:${value.email}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {value.name}
                      </a>
                    );
                  } else {
                    cellContents = value.name;
                  }
                } else if (value.email) {
                  cellContents = (
                    <a
                      className="text-primary-500 underline"
                      href={`mailto:${value.email}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {value.email}
                    </a>
                  );
                }
                const editors: EditorsList = [
                  [NameElement.id, RespondentEditor],
                ];
                if (EmailElement) {
                  editors.push([EmailElement.id, EmailEditor]);
                }
                return (
                  <EditableResponseCell
                    componentSettings={NameElement.componentSettings}
                    data={row.original.data}
                    editors={editors}
                    updateValue={valueUpdater(parseInt(row.id))}
                    onStateChange={setEditingCell}
                  >
                    {cellContents}
                  </EditableResponseCell>
                );
              },
            },
            {
              Header: "facilitator",
              accessor: (row: any) => {
                const data = row.data[NameElement.id];
                return data?.facilitator || null;
              },
              Cell: ({
                value,
                row,
              }: {
                value: string | null;
                row: Row<any>;
              }) => {
                return (
                  <EditableResponseCell
                    componentSettings={NameElement.componentSettings}
                    data={row.original.data}
                    editors={[[NameElement.id, FacilitatorEditor]]}
                    updateValue={valueUpdater(parseInt(row.id))}
                    onStateChange={setEditingCell}
                  >
                    {value ? (
                      value
                    ) : (
                      <span className="text-gray-500 italic">
                        <Trans ns="admin:surveys">None</Trans>
                      </span>
                    )}
                  </EditableResponseCell>
                );
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
                const url =
                  ConsentElement.surveyConsentDocumentsConnection.nodes.find(
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
        Cell: ({ value, row }: { value: any; row: Row<any> }) => {
          const C = components[formElement.typeId];
          if (C.ResponseGridCell) {
            return (
              <C.ResponseGridCell
                elementId={formElement.id}
                value={value}
                componentSettings={formElement.componentSettings}
                editable={false}
                updateValue={valueUpdater(parseInt(row.id))}
                geometryType={formElement.sketchClass?.geometryType}
              />
            );
          } else {
            if (value === undefined || value === null) {
              return <SkippedQuestion />;
            }
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

  const getItemKey = useMemo(
    () =>
      function itemKeyFn(index: number, data: any) {
        return rowData[index].id;
      },
    [rowData]
  );

  const getRowId = useMemo(() => (row: any) => row.id, []);

  const globalFilter = useMemo(() => {
    return (
      rows: Row<{ isPractice: boolean; archived: boolean }>[],
      columnIds: any,
      selectedTab: ResponseGridTabName
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
            getToggleAllRowsSelectedProps,
          }: {
            getToggleAllRowsSelectedProps: any;
          }) => (
            <IndeterminateCheckbox
              className="-ml-1"
              {...getToggleAllRowsSelectedProps()}
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
    totalColumnsWidth,
    toggleAllRowsSelected,
    toggleRowSelected,
    filteredFlatRows,
    state: { selectedRowIds },
  } = tableInstance;

  useEffect(() => {
    if (props.onSelectionChange) {
      const selection = Object.keys(selectedRowIds)
        .filter((k) => selectedRowIds[k] === true)
        .map((k) => parseInt(k));
      props.onSelectionChange(selection);
    }
  }, [selectedRowIds]);

  useEffect(() => {
    setGlobalFilter(tab);
  }, [tab]);

  const RenderCellContents = React.memo(
    ({ cell, isSelected }: { cell: Cell<any, any>; isSelected: boolean }) => {
      return (
        <div
          className={`whitespace-nowrap px-2 py-1 inline-flex align-middle border truncate ${
            isSelected
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
    },
    (prev, next) => {
      return (
        false &&
        prev.isSelected === next.isSelected &&
        areEqual(prev.cell.getCellProps(), next.cell.getCellProps())
      );
    }
  );

  const RenderRow = React.useCallback(
    function RenderRow({ index, style }) {
      const row = rows[index];
      prepareRow(row);
      return (
        <div
          {...row.getRowProps({ style })}
          className={`inline-block ${
            row.index % 2 ? "bg-gray-50" : "bg-white"
          }`}
        >
          {
            // Loop over the rows cells
            row.cells.map((cell) => {
              // Apply the cell props
              return (
                <RenderCellContents
                  {...cell.getCellProps()}
                  cell={cell}
                  isSelected={row.isSelected}
                />
              );
            })
          }
        </div>
      );
    },
    [prepareRow, rows, selectedRowIds]
  );

  if (!data) {
    return null;
  }

  return (
    <div
      className={`${props.className} px-0 pt-0 overflow-hidden flex flex-col`}
    >
      <FakeTabs
        selectionCount={selectedFlatRows.length}
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
      <div className="overflow-x-auto text-sm flex-1">
        {tab === "export" ? (
          <ResponsesAsExported
            rules={data.survey?.form?.logicRules || []}
            formElements={data.survey?.form?.formElements || []}
            responses={data.survey?.surveyResponsesConnection.nodes || []}
          />
        ) : (
          <CellEditorContext.Provider value={{ editing: editingCell }}>
            <AutoSizer disableWidth={true}>
              {(props: any) => (
                <div
                  {...getTableProps()}
                  className="border-collapse border-2 border-t-0 inline-block"
                  style={{ height: props.height }}
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
                  <div
                    {...getTableBodyProps()}
                    className="block"
                    ref={scrollContainer}
                  >
                    <FixedSizeList
                      height={props.height - 38}
                      itemCount={rows.length}
                      itemSize={ITEM_SIZE}
                      width={totalColumnsWidth}
                      itemKey={getItemKey}
                    >
                      {RenderRow}
                    </FixedSizeList>
                  </div>
                </div>
              )}
            </AutoSizer>
          </CellEditorContext.Provider>
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
  selectionCount,
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
  selectionCount: number;
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
              label={
                <span className="flex items-center space-x-2">
                  {selectionCount > 0 && <Badge>{selectionCount}</Badge>}
                  <span>{t("Move to")}</span>
                </span>
              }
              options={dropdownOptions}
            />
            {mutating && <Spinner className="pl-2" />}
          </nav>
        </div>
      </div>
    </>
  );
}
