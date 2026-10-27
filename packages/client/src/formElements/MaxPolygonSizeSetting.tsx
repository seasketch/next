import { ChevronDownIcon } from "@heroicons/react/outline";
import { useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import Badge from "../components/Badge";
import { SketchGeometryType } from "../generated/graphql";
import { FormLanguageContext } from "./FormElement";
import {
  POLYGON_AREA_UNITS,
  PolygonAreaUnit,
  areaToSqKm,
  formatPolygonOverage,
  formatPolygonSizeLimit,
  isPolygonAreaUnit,
  parseMaxPolygonSizeSqKm,
  polygonAreaUnitLabel,
  roundArea,
  sqKmToArea,
} from "./maxPolygonSize";

/**
 * Optional maximum polygon area for a spatial survey question.
 * Nothing is stored until an author picks a unit and enters a size.
 * The number is kept as square kilometers; `unit` is how it is shown.
 */
export default function MaxPolygonSizeSetting(props: {
  geometryType?: SketchGeometryType | null;
  value?: number | null;
  unit?: PolygonAreaUnit | null;
  onChange: (value: number | null, unit: PolygonAreaUnit | null) => void;
}) {
  const { t, i18n } = useTranslation("admin:surveys");
  const [unit, setUnit] = useState<PolygonAreaUnit | "">(() =>
    initialUnit(props.unit, props.value)
  );
  const [text, setText] = useState(() =>
    displayValue(props.value, initialUnit(props.unit, props.value))
  );
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) {
      return;
    }
    const nextUnit = initialUnit(props.unit, props.value);
    setUnit(nextUnit);
    setText(displayValue(props.value, nextUnit));
  }, [props.value, props.unit, focused]);

  if (props.geometryType !== SketchGeometryType.Polygon) {
    return null;
  }

  function commit(raw: string, nextUnit: PolygonAreaUnit | "") {
    if (!nextUnit) {
      props.onChange(null, null);
      setText("");
      return;
    }
    const trimmed = raw.trim();
    if (trimmed === "") {
      props.onChange(null, null);
      setText("");
      setUnit("");
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      props.onChange(areaToSqKm(parsed, nextUnit), nextUnit);
      setText(String(parsed));
    } else {
      props.onChange(null, null);
      setText("");
      setUnit("");
    }
  }

  function clear() {
    setText("");
    setUnit("");
    setFocused(false);
    props.onChange(null, null);
  }

  function changeUnit(nextRaw: string) {
    if (!isPolygonAreaUnit(nextRaw)) {
      clear();
      return;
    }
    const saved = parseMaxPolygonSizeSqKm(props.value);
    if (saved !== undefined && unit && unit !== nextRaw) {
      const shown = roundArea(sqKmToArea(saved, nextRaw));
      setUnit(nextRaw);
      setText(String(shown));
      props.onChange(saved, nextRaw);
      return;
    }
    setUnit(nextRaw);
    const parsed = Number(text);
    if (text.trim() !== "" && Number.isFinite(parsed) && parsed > 0) {
      props.onChange(areaToSqKm(parsed, nextRaw), nextRaw);
    }
  }

  const enabled = unit !== "";
  const noneLabel = t("None");
  const unitLabels = POLYGON_AREA_UNITS.map((option) =>
    polygonAreaUnitLabel(option, i18n.language)
  );
  const widestLabel = [noneLabel, ...unitLabels].reduce((widest, label) =>
    label.length > widest.length ? label : widest
  );

  return (
    <div>
      <label
        htmlFor="maxPolygonSize"
        className="block text-sm font-medium leading-5 text-gray-800 mb-2"
      >
        {t("Max size (optional)")}
      </label>
      <div className="flex rounded-md shadow-sm">
        <input
          type="number"
          min={0}
          step="any"
          id="maxPolygonSize"
          name="maxPolygonSize"
          disabled={!enabled}
          className={`min-w-0 flex-1 block w-full appearance-none cursor-text border-gray-300 rounded-l-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 ${
            enabled ? "bg-white text-black" : "bg-gray-100 text-gray-500"
          }`}
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit(text, unit);
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            if (!unit) {
              return;
            }
            if (raw.trim() === "") {
              props.onChange(null, null);
              return;
            }
            // Keep intermediate values like "0." local until they are a
            // complete positive number. Blur commits or clears them.
            if (raw.endsWith(".") || /^0\.?$/.test(raw) || /\.0+$/.test(raw)) {
              return;
            }
            const parsed = Number(raw);
            if (Number.isFinite(parsed) && parsed > 0) {
              props.onChange(areaToSqKm(parsed, unit), unit);
            }
          }}
        />
        <div className="relative flex-shrink-0">
          {/* Width follows the longest option, with only enough padding for a small chevron. */}
          <span
            className="invisible block whitespace-nowrap pl-2 pr-5 sm:text-sm sm:leading-5"
            aria-hidden="true"
          >
            {widestLabel}
          </span>
          <select
            aria-label={t("Unit")}
            className="absolute inset-0 w-full min-w-0 appearance-none border border-l-0 border-gray-300 bg-gray-50 text-gray-700 rounded-r-md cursor-pointer sm:text-sm sm:leading-5 pl-2 pr-5"
            style={{ backgroundImage: "none" }}
            value={unit}
            onChange={(event) => changeUnit(event.target.value)}
          >
            <option value="">{noneLabel}</option>
            {POLYGON_AREA_UNITS.map((option, index) => (
              <option key={option} value={option}>
                {unitLabels[index]}
              </option>
            ))}
          </select>
          <span
            className="pointer-events-none absolute inset-y-0 right-0 pr-1 flex items-center"
            aria-hidden="true"
          >
            <ChevronDownIcon className="w-3 h-3 text-gray-500" />
          </span>
        </div>
      </div>
    </div>
  );
}

function initialUnit(
  unit: PolygonAreaUnit | null | undefined,
  sqKm: number | null | undefined
): PolygonAreaUnit | "" {
  if (isPolygonAreaUnit(unit)) {
    return unit;
  }
  if (parseMaxPolygonSizeSqKm(sqKm) !== undefined) {
    return "kilometer";
  }
  return "";
}

function displayValue(
  sqKm: number | null | undefined,
  unit: PolygonAreaUnit | ""
) {
  const saved = parseMaxPolygonSizeSqKm(sqKm);
  if (saved === undefined || !unit) {
    return "";
  }
  return String(roundArea(sqKmToArea(saved, unit)));
}

export function PolygonTooLargeNotice(props: {
  areaSqKm: number;
  maxSqKm: number;
  unit?: PolygonAreaUnit | null;
}) {
  const lang = useContext(FormLanguageContext);
  const unit = isPolygonAreaUnit(props.unit) ? props.unit : "kilometer";
  const limit = formatPolygonSizeLimit(props.maxSqKm, lang.lang?.code, unit);
  const over = formatPolygonOverage(
    props.areaSqKm,
    props.maxSqKm,
    lang.lang?.code
  );
  return (
    <span className="inline-flex items-center align-middle flex-wrap gap-2">
      <span className="leading-5">
        <Trans ns="surveys">
          This shape is over the size limit of {{ limit }}.
        </Trans>
      </span>
      {over && (
        <Badge
          variant="error"
          className="leading-none tabular-nums whitespace-nowrap"
        >
          {over}
        </Badge>
      )}
    </span>
  );
}

