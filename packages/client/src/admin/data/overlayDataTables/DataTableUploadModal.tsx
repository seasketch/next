import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import Papa from "papaparse";
import {
  ChevronDownIcon,
  DocumentTextIcon,
  RefreshIcon,
  TableIcon,
  UploadIcon,
} from "@heroicons/react/outline";
import { CheckIcon } from "@radix-ui/react-icons";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { GeostatsLayer } from "@seasketch/geostats-types";
import Modal from "../../../components/Modal";
import Spinner from "../../../components/Spinner";
import Warning from "../../../components/Warning";
import {
  detectJoinColumnCandidates,
  JoinColumnCandidate,
  pickJoinColumn,
} from "./detectJoinColumn";
import { DELIMITED_SAMPLE_BYTES } from "../../uploads/delimitedSpatial/detectDelimitedGeometry";
import { DataTableUploadProcessingOptions } from "./types";
import ProjectBackgroundJobManager from "../../uploads/ProjectBackgroundJobManager";

const CSV_ACCEPT = ".csv,.tsv,.txt";

function DataTableCsvJoinColumnPicker({
  joinColumn,
  candidates,
  overlayJoinColumn,
  onSelect,
  disabled,
}: {
  joinColumn: string;
  candidates: JoinColumnCandidate[];
  overlayJoinColumn: string;
  onSelect: (csvColumn: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("admin:data");
  const hasAlternatives = candidates.length > 1;

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled || !joinColumn}
          className="flex w-full items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="shrink-0 font-normal text-gray-500">
            {t("Join column")}
          </span>
          <span className="min-w-0 flex-1 truncate text-left font-medium text-gray-900">
            {joinColumn}
          </span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-400" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="z-[60] min-w-[14rem] max-w-xs rounded-md border border-black/5 bg-white p-1 text-sm shadow-lg"
        >
          {candidates.map((candidate) => (
            <DropdownMenu.Item
              key={candidate.csvColumn}
              className={`flex cursor-pointer select-none items-center justify-between gap-3 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-gray-100 ${
                candidate.csvColumn === joinColumn
                  ? "font-medium text-primary-700"
                  : "text-gray-700"
              }`}
              onSelect={() => onSelect(candidate.csvColumn)}
            >
              <span className="min-w-0 truncate">{candidate.csvColumn}</span>
              {candidate.csvColumn === joinColumn ? (
                <CheckIcon className="h-4 w-4 shrink-0 text-primary-600" />
              ) : null}
            </DropdownMenu.Item>
          ))}
          {!hasAlternatives ? (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-gray-200" />
              <p className="px-2 py-1.5 text-xs leading-snug text-gray-500">
                {t(
                  "No other columns in this file match the ID column chosen for this spatial layer.",
                  { overlayJoinColumn },
                )}
              </p>
            </>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function defaultName(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

type PreviewData = {
  headers: string[];
  rows: string[][];
};

export default function DataTableUploadModal({
  open,
  onClose,
  tableOfContentsItemId,
  geostatsLayer,
  canonicalOverlayJoinColumn,
  replaceTableId,
  onUploadStarted,
  uploadOverlayDataTable,
}: {
  open: boolean;
  onClose: () => void;
  tableOfContentsItemId: number;
  geostatsLayer: GeostatsLayer | undefined;
  canonicalOverlayJoinColumn: string;
  replaceTableId?: number;
  onUploadStarted: () => void;
  uploadOverlayDataTable?: ProjectBackgroundJobManager["uploadOverlayDataTable"];
}) {
  const { t } = useTranslation("admin:data");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinColumn, setJoinColumn] = useState("");
  const [overlayJoinColumn, setOverlayJoinColumn] = useState("");
  const [candidates, setCandidates] = useState<JoinColumnCandidate[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [startingUpload, setStartingUpload] = useState(false);
  // Delimiter detected by Papa.parse during analysis; passed to the server so
  // TSV/tab-delimited files are processed with the same delimiter used for
  // the preview.
  const [detectedDelimiter, setDetectedDelimiter] = useState(",");
  // Incremented per analyzeFile call so a slow parse of a previously chosen
  // file can't clobber results from a newer selection.
  const analysisGeneration = useRef(0);

  const formatFileSize = useCallback(
    (bytes: number) => {
      if (bytes < 1024) {
        return t("{{size}} B", { size: bytes });
      }
      if (bytes < 1024 * 1024) {
        return t("{{size}} KB", { size: (bytes / 1024).toFixed(1) });
      }
      return t("{{size}} MB", {
        size: (bytes / (1024 * 1024)).toFixed(1),
      });
    },
    [t],
  );

  const resetForm = useCallback(() => {
    analysisGeneration.current++;
    setFile(null);
    setPreview(null);
    setError(null);
    setJoinColumn("");
    setOverlayJoinColumn("");
    setCandidates([]);
    setAnalyzing(false);
    setStartingUpload(false);
    setDetectedDelimiter(",");
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  const analyzeFile = useCallback(
    async (selected: File) => {
      const generation = ++analysisGeneration.current;
      const isCurrent = () => analysisGeneration.current === generation;
      setAnalyzing(true);
      setError(null);
      setPreview(null);
      setJoinColumn("");
      setOverlayJoinColumn("");
      setCandidates([]);
      try {
        const chunk = selected.slice(0, DELIMITED_SAMPLE_BYTES);
        const text = await chunk.text();
        if (!isCurrent()) {
          return;
        }
        const parsed = Papa.parse<string[]>(text, {
          header: false,
          skipEmptyLines: true,
        });
        const rows = (parsed.data as string[][]).filter((r) => r.length > 0);
        if (rows.length < 2) {
          setError(t("Could not parse CSV file"));
          return;
        }
        setDetectedDelimiter(parsed.meta?.delimiter || ",");
        const headers = rows[0].map((h) => h.trim());
        const dataRows = rows.slice(1, 6);
        setPreview({ headers, rows: dataRows });
        const detected = detectJoinColumnCandidates(
          headers,
          rows.slice(1),
          geostatsLayer,
          canonicalOverlayJoinColumn,
        );
        setCandidates(detected);
        const picked = pickJoinColumn(detected);
        if (!picked) {
          setError(
            t("Could not detect a join column matching the overlay layer"),
          );
          return;
        }
        setJoinColumn(picked.joinColumn);
        setOverlayJoinColumn(canonicalOverlayJoinColumn);
      } finally {
        if (isCurrent()) {
          setAnalyzing(false);
        }
      }
    },
    [geostatsLayer, canonicalOverlayJoinColumn, t],
  );

  const onFileSelected = useCallback(
    (selected: File | null) => {
      setFile(selected);
      if (selected) {
        analyzeFile(selected);
      } else {
        setPreview(null);
        setCandidates([]);
        setJoinColumn("");
        setOverlayJoinColumn("");
        setError(null);
      }
    },
    [analyzeFile],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0] ?? null;
      onFileSelected(selected);
      e.target.value = "";
    },
    [onFileSelected],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onSubmit = async () => {
    if (!file || !joinColumn || !overlayJoinColumn || !uploadOverlayDataTable) {
      return;
    }
    setStartingUpload(true);
    setError(null);
    try {
      const processingOptions: DataTableUploadProcessingOptions = {
        delimiter: detectedDelimiter,
        hasHeaderRow: true,
        joinColumn,
        overlayJoinColumn,
        name: defaultName(file.name),
      };
      await uploadOverlayDataTable({
        tableOfContentsItemId,
        file,
        processingOptions,
        replaceOverlayDataTableId: replaceTableId,
      });
      onUploadStarted();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStartingUpload(false);
    }
  };

  const title = replaceTableId
    ? t("Replace Data Table")
    : t("Upload Data Table");

  return createPortal(
    <Modal
      open={open}
      onRequestClose={onClose}
      title={title}
      scrollable
      autoWidth
      tipyTop
      panelClassName="sm:max-w-xl"
      footer={[
        {
          label: t("Cancel"),
          onClick: onClose,
          disabled: startingUpload,
        },
        {
          label: startingUpload ? t("Starting…") : t("Upload"),
          variant: "primary",
          onClick: onSubmit,
          disabled:
            startingUpload ||
            analyzing ||
            !file ||
            !joinColumn ||
            !uploadOverlayDataTable,
          loading: startingUpload,
        },
      ]}
    >
      <div className="space-y-5 px-1 pb-2">
        {replaceTableId ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Trans ns="admin:data">
              Upload a new CSV to replace the existing table. The previous
              version will be kept in history and can be rolled back.
            </Trans>
          </div>
        ) : null}

        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <TableIcon className="h-5 w-5 flex-shrink-0 text-primary-600 mt-0.5" />
            <div className="text-sm text-gray-700 space-y-2">
              <p>
                <Trans ns="admin:data">
                  Attach a CSV of observations or measurements to this map
                  layer. Rows are linked to overlay features using a shared ID
                  column, then stored as an optimized table for reports and
                  analysis.
                </Trans>
              </p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>
                  <Trans ns="admin:data">
                    CSV, TSV, or tab-delimited text with a header row
                  </Trans>
                </li>
                <li>
                  <Trans ns="admin:data">
                    One column must match an attribute on this layer
                  </Trans>
                </li>
                <li>
                  <Trans ns="admin:data">
                    Processing converts the file to a fast columnar format
                  </Trans>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={CSV_ACCEPT}
          className="hidden"
          onChange={onInputChange}
          disabled={startingUpload || analyzing}
        />

        {!file ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 text-center">
            <UploadIcon className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-900">
              {t("Choose a CSV file")}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {t(".csv, .tsv, or .txt with a header row")}
            </p>
            <button
              type="button"
              className="mt-4 inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-60"
              onClick={openFilePicker}
              disabled={startingUpload || analyzing}
            >
              {t("Browse…")}
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <DocumentTextIcon className="h-8 w-8 flex-shrink-0 text-primary-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(file.size)}
                </p>
              </div>
              {analyzing ? (
                <Spinner mini />
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                  onClick={openFilePicker}
                  disabled={startingUpload}
                >
                  <RefreshIcon className="h-4 w-4" />
                  {t("Change file")}
                </button>
              )}
            </div>

            {joinColumn && !analyzing ? (
              <div className="px-4 py-3 border-b border-gray-100">
                <DataTableCsvJoinColumnPicker
                  joinColumn={joinColumn}
                  candidates={candidates}
                  overlayJoinColumn={overlayJoinColumn}
                  disabled={startingUpload}
                  onSelect={(csvColumn) => {
                    setJoinColumn(csvColumn);
                    setOverlayJoinColumn(canonicalOverlayJoinColumn);
                  }}
                />
              </div>
            ) : null}

            {preview && !analyzing ? (
              <div className="px-4 py-3">
                <span className="text-sm font-medium text-gray-700">
                  {t("Preview")}
                </span>
                <div className="mt-2 overflow-x-auto border rounded-md max-h-40">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {preview.headers.map((header) => (
                          <th
                            key={header}
                            className="px-2 py-1.5 text-left font-medium text-gray-500 whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td
                              key={j}
                              className="px-2 py-1.5 text-gray-700 whitespace-nowrap"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {error ? <Warning>{error}</Warning> : null}
      </div>
    </Modal>,
    document.body,
  );
}
