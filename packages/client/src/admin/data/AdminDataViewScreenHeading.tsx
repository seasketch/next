import type { ReactNode } from "react";
import { ChevronLeftIcon, LayersIcon } from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import getSlug from "../../getSlug";

interface AdminDataViewScreenHeadingProps {
  /** Primary screen title (e.g. “Download Settings”). */
  children: ReactNode;
  className?: string;
}

/**
 * Secondary admin screen title row: back to layer list control + title.
 */
export default function AdminDataViewScreenHeading({
  children,
  className = "",
}: AdminDataViewScreenHeadingProps) {
  const history = useHistory();
  const { t } = useTranslation("admin:data");

  const goToLayerList = () => {
    // eslint-disable-next-line i18next/no-literal-string -- route path
    history.push(`/${getSlug()}/admin/data`);
  };

  return (
    <header className={`min-w-0 ${className}`.trim()}>
      <h2 className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <Tooltip.Provider>
          <Tooltip.Root delayDuration={400}>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                className="flex shrink-0 items-center rounded px-0.5 py-0.5 text-gray-400 transition-colors hover:bg-gray-100/80 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                aria-label={t("Back to layer list")}
                onClick={goToLayerList}
              >
                <span
                  className="flex items-center gap-0 opacity-90"
                  aria-hidden
                >
                  <ChevronLeftIcon className="h-3.5 w-3.5 shrink-0 opacity-75" />
                  <LayersIcon className="h-[1.125rem] w-[1.125rem] shrink-0 -translate-x-px opacity-80" />
                </span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="z-50 select-none rounded bg-black px-3 py-2 text-sm text-white shadow-md"
                side="bottom"
                sideOffset={6}
              >
                {t("Back to layer list")}
                <Tooltip.Arrow className="fill-black" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
        <span className="min-w-0 text-base font-semibold tracking-tight text-gray-900">
          {children}
        </span>
      </h2>
    </header>
  );
}
