import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import Modal from "../../../components/Modal";
import RadioGroup from "../../../components/RadioGroup";
import Warning from "../../../components/Warning";
import Spinner from "../../../components/Spinner";
import { detectDelimitedGeometry, validateWgs84PointColumns, DELIMITED_SAMPLE_BYTES } from "./detectDelimitedGeometry";
import {
  DelimitedUploadProcessingOptions,
  DetectDelimitedGeometryResult,
} from "./types";

// Only the first chunk of each file is read to detect columns and preview
// rows. This keeps detection fast even for very large CSVs.

const selectClassName =
  "block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6";

type FileConfigState = {
  file: File;
  loading: boolean;
  error: string | null;
  detection: DetectDelimitedGeometryResult | null;
  geometryMode: "point_xy" | "wkt";
  xField: string;
  yField: string;
  geometryField: string;
  delimiter: DelimitedUploadProcessingOptions["delimiter"];
  hasHeaderRow: boolean;
  validationError: string | null;
};

function initialFileConfigState(file: File): FileConfigState {
  return {
    file,
    loading: true,
    error: null,
    detection: null,
    geometryMode: "point_xy",
    xField: "",
    yField: "",
    geometryField: "",
    delimiter: ",",
    hasHeaderRow: true,
    validationError: null,
  };
}

function getPointColumnValidationError(
  state: FileConfigState
): string | null {
  if (
    !state.detection ||
    state.geometryMode !== "point_xy" ||
    !state.xField ||
    !state.yField
  ) {
    return null;
  }
  return validateWgs84PointColumns(
    state.detection.headers,
    state.detection.rows,
    state.xField,
    state.yField
  );
}

function isFileConfigValid(state: FileConfigState) {
  if (state.loading || state.error || state.validationError) return false;
  if (state.geometryMode === "wkt") return Boolean(state.geometryField);
  return Boolean(state.xField) && Boolean(state.yField);
}

function toProcessingOptions(
  state: FileConfigState
): DelimitedUploadProcessingOptions {
  return {
    kind: "delimited",
    geometryMode: state.geometryMode,
    xField: state.geometryMode === "point_xy" ? state.xField : undefined,
    yField: state.geometryMode === "point_xy" ? state.yField : undefined,
    geometryField:
      state.geometryMode === "wkt" ? state.geometryField : undefined,
    crs: "EPSG:4326",
    delimiter: state.delimiter,
    hasHeaderRow: state.hasHeaderRow,
  };
}

/**
 * Presented when one or more dropped CSV/TSV/TXT files need the user to
 * confirm (or correct) which columns contain location data before they are
 * uploaded. Detection runs client-side via `detectDelimitedGeometry`; this
 * modal is skipped entirely for files where detection is high-confidence.
 */
export default function DelimitedUploadConfigModal({
  files,
  onSubmit,
  onCancel,
}: {
  files: File[];
  onSubmit: (
    configsByFile: Map<File, DelimitedUploadProcessingOptions>
  ) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const [activeIndex, setActiveIndex] = useState(0);
  const [fileStates, setFileStates] = useState<FileConfigState[]>(() =>
    files.map(initialFileConfigState)
  );

  useEffect(() => {
    let cancelled = false;
    files.forEach((file, i) => {
      file
        .slice(0, DELIMITED_SAMPLE_BYTES)
        .text()
        .then((sample) => {
          if (cancelled) return;
          const detection = detectDelimitedGeometry(sample);
          setFileStates((prev) => {
            const next = [...prev];
            const nextState: FileConfigState = {
              ...next[i],
              loading: false,
              detection,
              geometryMode: detection.geometryMode || "point_xy",
              xField: detection.xField || "",
              yField: detection.yField || "",
              geometryField: detection.geometryField || "",
              delimiter: detection.delimiter,
              hasHeaderRow: detection.hasHeaderRow,
              error: detection.error || null,
              validationError: null,
            };
            nextState.validationError = getPointColumnValidationError(nextState);
            next[i] = nextState;
            return next;
          });
        })
        .catch((e) => {
          if (cancelled) return;
          setFileStates((prev) => {
            const next = [...prev];
            next[i] = {
              ...next[i],
              loading: false,
              error: e instanceof Error ? e.message : String(e),
            };
            return next;
          });
        });
    });
    return () => {
      cancelled = true;
    };
    // Detection only needs to run once per set of files.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateActive = (update: Partial<FileConfigState>) => {
    setFileStates((prev) => {
      const next = [...prev];
      const merged = { ...next[activeIndex], ...update };
      merged.validationError = getPointColumnValidationError(merged);
      next[activeIndex] = merged;
      return next;
    });
  };

  const active = fileStates[activeIndex];
  const allValid = fileStates.every(isFileConfigValid);
  const anyLoading = fileStates.some((f) => f.loading);

  return (
    <Modal
      title={t("Configure spatial columns")}
      onRequestClose={onCancel}
      scrollable
      tabs={files.length > 1 ? files.map((f) => f.name) : undefined}
      onTabChange={files.length > 1 ? setActiveIndex : undefined}
      footer={[
        {
          label: t("Cancel"),
          variant: "secondary",
          onClick: onCancel,
        },
        {
          label:
            files.length > 1
              ? t("Upload {{count}} files", { count: files.length })
              : t("Upload"),
          variant: "primary",
          autoFocus: true,
          disabled: !allValid || anyLoading,
          onClick: () => {
            const configs = new Map<File, DelimitedUploadProcessingOptions>();
            fileStates.forEach((state) => {
              configs.set(state.file, toProcessingOptions(state));
            });
            onSubmit(configs);
          },
        },
      ]}
    >
      <div className="space-y-4 w-full sm:w-[34rem]">
        {files.length === 1 && (
          <p
            className="text-sm font-medium text-gray-800 truncate"
            title={active.file.name}
          >
            {active.file.name}
          </p>
        )}
        {active.loading && (
          <div className="py-8 flex justify-center">
            <Spinner />
          </div>
        )}
        {active.error && (
          <Warning level="error">{active.error}</Warning>
        )}
        {!active.loading && !active.error && active.detection && (
          <FileConfigForm
            state={active}
            detection={active.detection}
            onChange={updateActive}
          />
        )}
      </div>
    </Modal>
  );
}

function FileConfigForm({
  state,
  detection,
  onChange,
}: {
  state: FileConfigState;
  detection: DetectDelimitedGeometryResult;
  onChange: (update: Partial<FileConfigState>) => void;
}) {
  const { t } = useTranslation("admin:data");

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        <Trans ns="admin:data">
          SeaSketch needs to know which columns in this file contain location
          data. Review the detected mapping below, or choose different
          columns.
        </Trans>
      </p>

      {detection.warnings.map((warning, i) => (
        <Warning key={i} level={detection.confidence === "low" ? "warning" : "info"}>
          {warning}
        </Warning>
      ))}

      {(state.error || state.validationError) && (
        <Warning level="error">{state.validationError || state.error}</Warning>
      )}

      <p className="text-sm text-gray-500">
        <Trans ns="admin:data">
          Coordinates must be in WGS 84 (EPSG:4326) decimal degrees.
        </Trans>
      </p>

      <RadioGroup<"point_xy" | "wkt">
        legend={t("Geometry type")}
        value={state.geometryMode}
        onChange={(geometryMode) => onChange({ geometryMode })}
        items={[
          {
            value: "point_xy",
            label: t("Point coordinates"),
            description: t(
              "Use separate columns for latitude (Y) and longitude (X)"
            ),
          },
          {
            value: "wkt",
            label: t("Well-Known Text (WKT)"),
            description: t(
              "Use a single column containing WKT geometry strings (points, lines, or polygons)"
            ),
          },
        ]}
      />

      {state.geometryMode === "point_xy" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              {t("Longitude (X) column")}
            </span>
            <select
              className={selectClassName}
              value={state.xField}
              onChange={(e) => onChange({ xField: e.target.value })}
            >
              <option value="">{t("Select a column")}</option>
              {detection.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              {t("Latitude (Y) column")}
            </span>
            <select
              className={selectClassName}
              value={state.yField}
              onChange={(e) => onChange({ yField: e.target.value })}
            >
              <option value="">{t("Select a column")}</option>
              {detection.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            {t("WKT geometry column")}
          </span>
          <select
            className={selectClassName}
            value={state.geometryField}
            onChange={(e) => onChange({ geometryField: e.target.value })}
          >
            <option value="">{t("Select a column")}</option>
            {detection.headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex items-center">
        <input
          type="checkbox"
          className="rounded border-gray-300 text-primary-500 focus:ring-primary-500 mr-2"
          checked={state.hasHeaderRow}
          onChange={(e) => onChange({ hasHeaderRow: e.target.checked })}
        />
        <span className="text-sm text-gray-700">
          {t("First row is a header")}
        </span>
      </label>

      <PreviewTable detection={detection} />
    </div>
  );
}

function PreviewTable({
  detection,
}: {
  detection: DetectDelimitedGeometryResult;
}) {
  const { t } = useTranslation("admin:data");
  if (!detection.rows.length) return null;
  return (
    <div>
      <span className="text-sm font-medium text-gray-700">
        {t("Preview")}
      </span>
      <div className="mt-1 overflow-x-auto border rounded-md max-h-48">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {detection.headers.map((header) => (
                <th
                  key={header}
                  className="px-2 py-1 text-left font-medium text-gray-500 whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {detection.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-2 py-1 text-gray-700 whitespace-nowrap"
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
  );
}
