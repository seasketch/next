import { CaretDownIcon, CaretRightIcon } from "@radix-ui/react-icons";
import OptionalCaretTooltip from "./OptionalCaretTooltip";

type CollectionExpandableNameProps = {
  displayLabel: string;
  truncateRowLabels: boolean;
  expanded: boolean;
  onToggle: () => void;
  loading: boolean;
  isCollection: boolean;
  caretTooltipEnabled: boolean;
  caretTooltipLabel: string;
  expandAriaLabelExpanded: string;
  expandAriaLabelCollapsed: string;
};

/**
 * Name column for collection reports: caret (optional tooltip) + primary label button.
 */
export default function CollectionExpandableName({
  displayLabel,
  truncateRowLabels,
  expanded,
  onToggle,
  loading,
  isCollection,
  caretTooltipEnabled,
  caretTooltipLabel,
  expandAriaLabelExpanded,
  expandAriaLabelCollapsed,
}: CollectionExpandableNameProps) {
  if (!isCollection) {
    return (
      <span
        className={truncateRowLabels ? "truncate block" : "block break-words"}
        title={truncateRowLabels ? displayLabel : undefined}
      >
        {displayLabel}
      </span>
    );
  }

  return (
    <div className="group -mx-1 flex min-w-0 items-center gap-1 px-1">
      <OptionalCaretTooltip
        tooltipEnabled={caretTooltipEnabled}
        tooltipLabel={caretTooltipLabel}
      >
        <button
          type="button"
          disabled={loading}
          aria-hidden
          tabIndex={-1}
          className="inline-flex shrink-0 items-center justify-center rounded border border-transparent p-0.5 text-gray-500 transition-colors group-hover:bg-gray-200/80 group-hover:border-gray-300 group-hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 duration-300"
          onClick={onToggle}
        >
          {expanded ? (
            <CaretDownIcon className="h-4 w-4" aria-hidden />
          ) : (
            <CaretRightIcon className="h-4 w-4" aria-hidden />
          )}
        </button>
      </OptionalCaretTooltip>
      <button
        type="button"
        disabled={loading}
        aria-expanded={expanded}
        aria-label={
          expanded ? expandAriaLabelExpanded : expandAriaLabelCollapsed
        }
        className="min-w-0 flex-1 rounded border border-transparent py-0 text-left leading-normal text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onToggle}
      >
        <span
          className={truncateRowLabels ? "truncate block" : "block break-words"}
          title={truncateRowLabels ? displayLabel : undefined}
        >
          {displayLabel}
        </span>
      </button>
    </div>
  );
}
