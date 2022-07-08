import { ExclamationIcon } from "@heroicons/react/outline";
import { ReactNode } from "react";
import { Trans } from "react-i18next";

export default function ErrorBoundaryFallback({
  title,
}: {
  title?: string | ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="w-full h-full flex justify-center align-middle">
      <div className="flex justify-center align-middle flex-col items-center p-4 text-red-800 text-center">
        <ExclamationIcon className="w-10 h-10 block " />
        {title || <Trans>Failed to render component</Trans>}
      </div>
    </div>
  );
}
