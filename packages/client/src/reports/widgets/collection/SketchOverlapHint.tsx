import * as Tooltip from "@radix-ui/react-tooltip";
import { useTranslation } from "react-i18next";
import IntersectionIcon from "../../../components/icons/IntersectionIcon";

type SketchOverlapHintProps = {
  hasOverlap: boolean;
  sketchDisplayName: string;
  overlapPartnerSketchNames: string[];
};

/**
 * Icon + tooltip when this sketch shares fragment metrics with other sketches in the collection.
 */
export default function SketchOverlapHint({
  hasOverlap,
  sketchDisplayName,
  overlapPartnerSketchNames,
}: SketchOverlapHintProps) {
  const { t } = useTranslation("reports");

  if (!hasOverlap || overlapPartnerSketchNames.length === 0) {
    return null;
  }

  const partners = overlapPartnerSketchNames;
  const footer = t(
    "Collection stats take this overlap into account to avoid double-counting. Collection totals will be less than the sum of individual sketch values when there is overlap."
  );

  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-200/80 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={t("Overlapping sketches")}
        >
          <IntersectionIcon size={20} className="text-current" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="z-[60] max-w-sm rounded-md bg-gray-900 px-3 py-2 text-xs leading-snug text-white shadow-lg"
          side="top"
          sideOffset={6}
        >
          {partners.length === 1 ? (
            <p className="leading-relaxed">
              <span className="font-semibold tracking-tight text-indigo-300">
                {sketchDisplayName}
              </span>
              <span className="mx-1 font-normal text-gray-400">
                {t("overlaps with")}
              </span>
              <span className="font-semibold tracking-tight text-indigo-300">
                {partners[0]}
              </span>
              <span className="text-gray-400">.</span>
            </p>
          ) : (
            <>
              <p className="leading-relaxed">
                <span className="font-semibold tracking-tight text-indigo-300">
                  {sketchDisplayName}{" "}
                </span>
                <span className="mt-1 font-normal leading-snug text-gray-400">
                  {t("overlaps the following")}
                  {":"}
                </span>
              </p>
              <ul className="mt-2 space-y-1 border-l border-emerald-500/40 pl-3">
                {partners.map((name, idx) => (
                  <li key={`${idx}-${name}`}>
                    <span className="font-semibold tracking-tight text-indigo-300">
                      {name}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-2 border-t border-gray-700 pt-2 font-normal leading-snug text-gray-400">
            {footer}
          </p>
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
