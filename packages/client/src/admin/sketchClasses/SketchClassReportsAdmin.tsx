import { Trans, useTranslation } from "react-i18next";
import { SketchingDetailsFragment } from "../../generated/graphql";
import { PlusCircleIcon } from "@heroicons/react/solid";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  MenuBarContentClasses,
  MenuBarItemClasses,
} from "../../components/Menubar";

export default function SketchClassReportsAdmin({
  sketchClass,
}: {
  sketchClass: SketchingDetailsFragment;
}) {
  const { t } = useTranslation("admin:sketching");

  const cards = [];

  return (
    <div className="flex flex-col w-full h-full">
      {/* Header */}
      <div className="bg-gray-100 p-4 flex-none border-b shadow"></div>

      {/* Main */}
      <div className="flex-1 flex">
        {/* left sidebar */}
        <div className="w-0 bg-white flex-none border-r shadow"></div>

        {/* main content */}
        <div className="flex-1 p-8">
          <div className="w-128 mx-auto bg-white rounded-lg shadow-xl border border-t-black/5 border-l-black/10 border-r-black/15 border-b-black/20">
            {/* report header */}
            <div className="px-4 py-3 border-b bg-white rounded-t-lg flex items-center space-x-2">
              <div className="flex-1">
                {sketchClass.name} {t("Report")}
              </div>
              <div className="flex-none flex items-center hover:bg-gray-100 rounded-full hover:outline-4 hover:outline hover:outline-gray-100">
                <button>
                  <DotsHorizontalIcon className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              <div className="flex-none flex items-center">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button title={t("Add a card or tab")}>
                      <PlusCircleIcon className="w-7 h-7 text-blue-500 hover:text-blue-600" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    className={MenuBarContentClasses}
                    side="bottom"
                    align="end"
                    sideOffset={5}
                  >
                    <DropdownMenu.Item className={MenuBarItemClasses}>
                      {t("Add a Card")}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className={MenuBarItemClasses}>
                      {t("Add a New Tab")}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </div>
            </div>
            {/* report body */}
            <div className="p-4 bg-gray-50 rounded-b-lg">
              {cards.length === 0 && (
                <div>
                  <p className="text-sm text-gray-500">
                    <Trans ns="admin:sketching">
                      This report has no cards. Click the + button to customize.
                    </Trans>
                  </p>
                </div>
              )}
            </div>
            {/* report footer */}
            {/* <div className="p-4 border-t"></div> */}
          </div>
        </div>

        {/* right sidebar */}
        <div className="w-0 bg-white flex-none border-l shadow"></div>
      </div>

      {/* Footer */}
      {/* <div className="bg-gray-100 p-4 flex-none border-t shadow"></div> */}
    </div>
  );
}
