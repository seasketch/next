import Modal from "../../../components/Modal";
import { ReactNode } from "react";
import { GeostatsAttribute, GeostatsLayer } from "@seasketch/geostats-types";
import { TFunction, useTranslation } from "react-i18next";
import {
  piiRiskBadgeClass,
  piiRiskCategoryLabel,
  piiRiskDetected,
} from "../piiGeostatsDisplay";
import { getAttributeValues } from "./extensions/glStyleAutocomplete";
import {
  Cross2Icon,
  LayersIcon,
  PersonIcon,
  QuestionMarkCircledIcon,
} from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";

export interface Geostats {
  layers: GeostatsLayer[];
  layerCount: number;
}

interface GeostatsModalProps {
  geostats: Geostats;
  onRequestClose: () => void;
  className?: string;
}

export default function GeostatsModal(props: GeostatsModalProps) {
  const { t } = useTranslation("admin:data");
  const single = props.geostats.layerCount === 1;
  return (
    <Modal
      className={props.className}
      panelClassName="!max-w-3xl w-[min(100%,calc(100vw-2rem))] overflow-hidden"
      onRequestClose={props.onRequestClose}
      open={true}
      zeroPadding
    >
      <Tooltip.Provider delayDuration={200}>
        <div className="max-h-[min(88vh,calc(100dvh-2.5rem))] overflow-y-auto overscroll-none sm:max-h-[min(90vh,calc(100vh-3rem))]">
          {single ? (
            <>
              <ModalStickyHeader
                onRequestClose={props.onRequestClose}
                closeLabel={t("Close")}
              >
                <LayerMetaHeader layer={props.geostats.layers[0]} />
              </ModalStickyHeader>
              <ul className="list-none space-y-3 px-6 py-5 pb-8" role="list">
                {props.geostats.layers[0].attributes.map((attribute) => (
                  <AttributeCard
                    key={attribute.attribute}
                    attribute={attribute}
                    t={t}
                  />
                ))}
              </ul>
            </>
          ) : (
            <>
              <ModalStickyHeader
                onRequestClose={props.onRequestClose}
                closeLabel={t("Close")}
              >
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                  {t("Layers")}
                </h2>
              </ModalStickyHeader>
              <div className="space-y-8 px-5 py-6 pb-8">
                {props.geostats.layers.map((layer) => (
                  <GeostatsLayerPanel key={layer.layer} layer={layer} />
                ))}
              </div>
            </>
          )}
        </div>
      </Tooltip.Provider>
    </Modal>
  );
}

function ModalStickyHeader({
  children,
  onRequestClose,
  closeLabel,
}: {
  children: ReactNode;
  onRequestClose: () => void;
  closeLabel: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100/70 shadow-[0_1px_0_0_rgba(15,23,42,0.06)]">
      <div className="relative px-6 pb-5 pt-4">
        <button
          type="button"
          onClick={onRequestClose}
          className="absolute right-3 top-3 z-10 rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800"
          aria-label={closeLabel}
        >
          <Cross2Icon className="h-5 w-5" />
        </button>
        <div className="min-w-0 pr-12">{children}</div>
      </div>
    </header>
  );
}

function LayerMetaHeader({ layer }: { layer: GeostatsLayer }) {
  const { t } = useTranslation("admin:data");
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-700">
        <LayersIcon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-lg font-semibold leading-snug tracking-tight text-slate-900">
          {layer.layer}
        </h2>
        <div className="mt-3 flex min-h-[1.5rem] flex-wrap items-center gap-x-2 gap-y-1">
          <span className="box-border inline-flex items-center rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 text-xs font-medium leading-5 text-emerald-900">
            {layer.geometry}
          </span>
          {layer.piiRiskWasAssessed ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-xs font-medium leading-5 text-slate-800">
              <PersonIcon
                className="h-3.5 w-3.5 shrink-0 text-slate-600"
                aria-hidden
              />
              <span>{t("Scanned for PII")}</span>
              <PiiInfoTooltipButton
                t={t}
                buttonClassName="-mr-0.5"
                iconClassName="h-3.5 w-3.5"
              />
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs leading-5 text-slate-500">
              <PersonIcon
                className="h-3.5 w-3.5 shrink-0 opacity-70"
                aria-hidden
              />
              <span>{t("PII risk not evaluated")}</span>
              <PiiInfoTooltipButton
                t={t}
                buttonClassName="-m-0.5"
                iconClassName="h-3.5 w-3.5"
              />
            </span>
          )}
          <span className="text-xs leading-5 text-slate-400" aria-hidden>
            {String.fromCharCode(0x00b7)}
          </span>
          <span className="text-xs leading-5 text-slate-600">
            {layer.count === 1
              ? t("1 feature")
              : t("{{n}} features", { n: layer.count.toLocaleString() })}
          </span>
          <span className="text-xs leading-5 text-slate-400" aria-hidden>
            {String.fromCharCode(0x00b7)}
          </span>
          <span className="text-xs leading-5 text-slate-600">
            {layer.attributeCount === 1
              ? t("1 column")
              : t("{{n}} columns", { n: layer.attributeCount })}
          </span>
        </div>
      </div>
    </div>
  );
}

function GeostatsLayerPanel({ layer }: { layer: GeostatsLayer }) {
  const { t } = useTranslation("admin:data");
  return (
    <div>
      <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
        <LayerMetaHeader layer={layer} />
      </div>
      <ul className="mt-5 list-none space-y-3" role="list">
        {layer.attributes.map((attribute) => (
          <AttributeCard
            key={attribute.attribute}
            attribute={attribute}
            t={t}
          />
        ))}
      </ul>
    </div>
  );
}

function AttributeCard({
  attribute,
  t,
}: {
  attribute: GeostatsAttribute;
  t: TFunction<"admin:data">;
}) {
  const hasPii = piiRiskDetected(attribute.piiRisk);
  const pct = Math.round((attribute.piiRisk ?? 0) * 100);
  const categoriesText =
    attribute.piiRiskCategories && attribute.piiRiskCategories.length > 0
      ? attribute.piiRiskCategories
          .map((c) => piiRiskCategoryLabel(c, t))
          .join(", ")
      : null;

  const piiDot = String.fromCharCode(0x00b7);
  const piiSummaryTitle = categoriesText
    ? `${t("PII risk {{pct}}%", { pct })} ${piiDot} ${categoriesText}`
    : t("{{pct}}% PII risk", { pct });

  return (
    <li className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold tracking-tight text-slate-900 break-words">
            {attribute.attribute}
          </h3>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
          {"countDistinct" in attribute && attribute.countDistinct != null && (
            <span
              className="tabular-nums text-xs leading-5 text-slate-500"
              title={t("Distinct values in this column")}
            >
              {attribute.countDistinct === 1
                ? t("1 unique value")
                : t("{{n}} unique values", {
                    n: attribute.countDistinct.toLocaleString(),
                  })}
            </span>
          )}
          {hasPii && (
            <span
              className={`inline-flex max-w-[min(100%,13rem)] items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium leading-5 ${piiRiskBadgeClass(
                attribute.piiRisk
              )}`}
              // title={piiSummaryTitle}
            >
              <PersonIcon className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
              <span className="min-w-0 truncate">
                {t("PII {{pct}}%", { pct })}
                {categoriesText ? ` ${piiDot} ${categoriesText}` : ""}
              </span>
              <PiiInfoTooltipButton
                t={t}
                buttonClassName="-mr-0.5"
                iconClassName="h-3 w-3"
              />
            </span>
          )}
          <span className="box-border inline-flex items-center rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize leading-5 text-slate-700">
            {attribute.type}
          </span>
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50/90 px-4 py-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {t("Sample values")}
        </p>
        <div className="max-h-32 overflow-y-auto pr-1 text-xs leading-relaxed text-slate-700 break-words">
          <AttributePreview attribute={attribute} t={t} />
        </div>
      </div>
    </li>
  );
}

function formatPreviewValue(v: unknown): string {
  if (v === null) {
    // eslint-disable-next-line i18next/no-literal-string -- technical JSON null
    return "null";
  }
  if (v === undefined) {
    return "";
  }
  if (typeof v === "object") {
    try {
      const s = JSON.stringify(v);
      // eslint-disable-next-line i18next/no-literal-string -- truncated JSON fragment
      return s.length > 200 ? `${s.slice(0, 197)}…` : s;
    } catch {
      // eslint-disable-next-line i18next/no-literal-string -- fallback when stringify fails
      return "[?]";
    }
  }
  return String(v);
}

function AttributePreview({
  attribute,
  t,
}: {
  attribute: GeostatsAttribute;
  t: TFunction<"admin:data">;
}) {
  const vals = getAttributeValues(attribute);

  if (attribute.type === "boolean") {
    return <span className="font-mono text-slate-600">{t("true, false")}</span>;
  }

  if (attribute.type === "string" && vals.length === 0) {
    return <span className="italic text-slate-400">{t("Values unknown")}</span>;
  }

  if (attribute.type === "number" && vals.length > 10) {
    if (attribute.min !== undefined && attribute.max !== undefined) {
      return (
        <span className="font-mono text-slate-600">
          {t("{{min}} – {{max}}", {
            min: attribute.min,
            max: attribute.max,
          })}
        </span>
      );
    }
    return (
      <span className="text-slate-600">
        {t("{{n}} numeric values", { n: vals.length })}
      </span>
    );
  }

  const parts = vals.map((v) => {
    const s = formatPreviewValue(v);
    return /[,\n]/.test(s) ? `"${s}"` : s;
  });

  return (
    <span className="font-mono text-[13px] text-slate-600">
      {parts.join(", ")}
    </span>
  );
}

function PiiInfoTooltipButton({
  t,
  buttonClassName = "",
  iconClassName = "h-3 w-3",
}: {
  t: TFunction<"admin:data">;
  buttonClassName?: string;
  iconClassName?: string;
}) {
  return (
    <Tooltip.Root delayDuration={10}>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={`-m-0.5 inline-flex shrink-0 rounded p-0.5 text-current opacity-75 hover:opacity-100 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-400 ${buttonClassName}`}
          aria-label={t("About PII columns")}
        >
          <QuestionMarkCircledIcon className={iconClassName} />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          className="TooltipContent z-[60] max-w-sm"
          sideOffset={6}
        >
          <p className="text-sm">
            {t(
              "For uploaded vector datasets, columns may contain Personally Identifiable Information (PII). SeaSketch scans uploads for PII like person names, email addresses, phone numbers, and government ID numbers. You can use this information to make decisions about enabling features such as data download. When using the AI cartography tools, sample values are redacted before sending to 3rd party AI services."
            )}
          </p>
          <Tooltip.Arrow className="TooltipArrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
