import { ChevronRightIcon } from "@heroicons/react/outline";
import { Trans } from "react-i18next";
import { Link } from "react-router-dom";

export interface GeographyRequiredForReportsPromptProps {
  /** Destination for the prompt (e.g. project geography admin). */
  to: string;
}

/**
 * Call-to-action shown when report editing requires project geographies to exist first.
 */
export default function GeographyRequiredForReportsPrompt({
  to,
}: GeographyRequiredForReportsPromptProps) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-xl bg-white shadow-xl px-4 py-4 text-left transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
    >
      <img
        src="/geography.png"
        alt=""
        className="h-16 w-16 shrink-0 rounded-lg object-cover"
      />
      <p className="min-w-0 flex-1 text-sm leading-snug text-gray-800">
        <Trans ns="admin:sketching">
          At least one geography is required before authoring reports. <br />
          <span className="font-medium text-primary-700">
            Open Geography administration
          </span>
          .
        </Trans>
      </p>
      <ChevronRightIcon
        className="h-8 w-8 shrink-0 text-gray-400"
        aria-hidden
      />
    </Link>
  );
}
