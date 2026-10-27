import { useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import Badge from "../components/Badge";
import { SketchGeometryType } from "../generated/graphql";
import { FormLanguageContext } from "./FormElement";
import {
  formatPolygonOverage,
  formatPolygonSizeLimit,
} from "./maxPolygonSize";

/**
 * Optional maximum polygon area for a spatial survey question.
 * Stored on component settings as square kilometers. Blank means no limit.
 *
 * `nested` places the field inside the selected Polygon geometry card.
 * Otherwise it is a section, matching Starting Bounds.
 */
export default function MaxPolygonSizeSetting(props: {
  geometryType?: SketchGeometryType | null;
  value?: number | null;
  onChange: (value: number | null) => void;
  nested?: boolean;
}) {
  const { t } = useTranslation("admin:surveys");
  const [text, setText] = useState(() => displayValue(props.value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) {
      return;
    }
    setText(displayValue(props.value));
  }, [props.value, focused]);

  if (props.geometryType !== SketchGeometryType.Polygon) {
    return null;
  }

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      props.onChange(null);
      setText("");
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      props.onChange(parsed);
      setText(String(parsed));
    } else {
      props.onChange(null);
      setText("");
    }
  }

  const field = (
    <div className="flex rounded-md shadow-sm">
      <input
        type="number"
        min={0}
        step="any"
        id="maxPolygonSizeSqKm"
        name="maxPolygonSizeSqKm"
        placeholder={t("No limit")}
        className="min-w-0 flex-1 block w-full bg-white cursor-text border-gray-300 rounded-l-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit(text);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          if (raw.trim() === "") {
            props.onChange(null);
            return;
          }
          // Keep intermediate values like "0." local until they are a
          // complete positive number. Blur commits or clears them.
          if (raw.endsWith(".") || /^0\.?$/.test(raw) || /\.0+$/.test(raw)) {
            return;
          }
          const parsed = Number(raw);
          if (Number.isFinite(parsed) && parsed > 0) {
            props.onChange(parsed);
          }
        }}
      />
      <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
        <Trans ns="admin:surveys">km²</Trans>
      </span>
    </div>
  );

  if (props.nested) {
    return (
      <div>
        <label
          htmlFor="maxPolygonSizeSqKm"
          className="block text-sm font-medium leading-5 text-gray-800"
        >
          {t("Maximum size")}
        </label>
        <p className="text-sm text-gray-500 mt-1 mb-2">
          <Trans ns="admin:surveys">Leave blank for no limit.</Trans>
        </p>
        {field}
      </div>
    );
  }

  return (
    <div>
      <h4 className="block text-sm font-medium leading-5 text-gray-800">
        <label htmlFor="maxPolygonSizeSqKm">{t("Maximum polygon size")}</label>
      </h4>
      <p className="text-sm text-gray-500 mb-2 mt-1">
        <Trans ns="admin:surveys">
          Respondents cannot save a polygon larger than this area. Leave blank
          for no limit.
        </Trans>
      </p>
      {field}
    </div>
  );
}

function displayValue(value: number | null | undefined) {
  if (value == null || !(value > 0)) {
    return "";
  }
  return String(value);
}

export function PolygonTooLargeNotice(props: {
  areaSqKm: number;
  maxSqKm: number;
}) {
  const lang = useContext(FormLanguageContext);
  const limit = formatPolygonSizeLimit(props.maxSqKm, lang.lang?.code);
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
