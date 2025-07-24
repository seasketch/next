import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DraftReportDocument,
  SketchingDetailsFragment,
  useAddReportTabMutation,
  useCreateDraftReportMutation,
  useDraftReportQuery,
} from "../../generated/graphql";
import { PlusCircleIcon } from "@heroicons/react/solid";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  MenuBarContentClasses,
  MenuBarItemClasses,
} from "../../components/Menubar";
import { ReportConfiguration, registerCards } from "../../reports/cards";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Warning from "../../components/Warning";
import useDialog from "../../components/useDialog";
import { ReportContextProvider } from "../../reports/ReportContext";
import { ReportTabs } from "../../reports/ReportTabs";
import { ReportBody } from "../../reports/ReportBody";
import { ReportTabManagementModal } from "../../reports/ReportTabManagementModal";

registerCards();

export default function SketchClassReportsAdmin({
  sketchClass,
}: {
  sketchClass: SketchingDetailsFragment;
}) {
  const { t } = useTranslation("admin:sketching");

  const onError = useGlobalErrorHandler();
  const { data, loading } = useDraftReportQuery({
    variables: {
      sketchClassId: sketchClass.id,
    },
    onError,
  });

  const [createDraftReport, createDraftReportState] =
    useCreateDraftReportMutation({
      awaitRefetchQueries: true,
      refetchQueries: [DraftReportDocument],
    });

  const [createReportTab] = useAddReportTabMutation({
    awaitRefetchQueries: true,
    refetchQueries: [DraftReportDocument],
  });

  const dialog = useDialog();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [manageTabsModalOpen, setManageTabsModalOpen] = useState(false);

  const handleAddNewTab = () => {
    if (!draftReport) return;

    const tabName = prompt(t("Choose a name for this Tab"));

    if (tabName === null) {
      // User cancelled
      return;
    }

    if (!tabName.trim()) {
      alert(t("Tab name cannot be empty"));
      return;
    }

    createReportTab({
      variables: {
        reportId: draftReport.id,
        title: tabName.trim(),
        position: (draftReport.tabs?.length || 0) + 1,
      },
    }).catch((error) => {
      onError(error);
    });
  };

  const draftReport = data?.sketchClass?.draftReport;

  console.log("draftReport", draftReport?.tabs);

  if (!loading && !draftReport) {
    if (
      !createDraftReportState.called &&
      !createDraftReportState.loading &&
      !createDraftReportState.error
    ) {
      createDraftReport({
        variables: {
          sketchClassId: sketchClass.id,
        },
      }).catch(() => {
        // do nothing. component will show error
      });
    }
    return (
      <div className="flex flex-col w-full h-full items-center p-8">
        {createDraftReportState.called &&
          !createDraftReportState.loading &&
          !createDraftReportState.error && (
            <Warning level="warning">{t("No draft report found")}</Warning>
          )}
        {createDraftReportState.error && (
          <Warning level="error">
            {t("Error creating draft report. ")}
            {createDraftReportState.error.message}
          </Warning>
        )}
        {createDraftReportState.loading && (
          <div className="flex flex-col w-full h-full items-center p-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="text-gray-500">{t("Creating draft report...")}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

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
          {draftReport && (
            <>
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
                    <DropdownMenu.Root
                      open={dropdownOpen}
                      onOpenChange={setDropdownOpen}
                    >
                      <DropdownMenu.Trigger asChild>
                        <button title={t("Add a card or tab")}>
                          <PlusCircleIcon className="w-7 h-7 text-blue-500 hover:text-blue-600" />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className={MenuBarContentClasses}
                          side="bottom"
                          align="end"
                          sideOffset={5}
                        >
                          <DropdownMenu.Item className={MenuBarItemClasses}>
                            {t("Add a Card")}
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className={MenuBarItemClasses}
                            onSelect={(e) => {
                              e.preventDefault();
                              handleAddNewTab();
                              setDropdownOpen(false);
                            }}
                          >
                            {t("Add a New Tab")}
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className={MenuBarItemClasses}
                            onSelect={(e) => {
                              e.preventDefault();
                              setManageTabsModalOpen(true);
                              setDropdownOpen(false);
                            }}
                          >
                            {t("Manage Tabs")}
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>
                </div>
                <ReportContextProvider
                  report={draftReport as unknown as ReportConfiguration}
                  sketchClass={sketchClass}
                  sketch={null}
                >
                  {/* report tabs */}
                  <ReportTabs />
                  {/* report body */}
                  <ReportBody />
                </ReportContextProvider>
                {/* report footer */}
                {/* <div className="p-4 border-t"></div> */}
              </div>
            </>
          )}

          {/* Manage Tabs Modal */}
          {draftReport && (
            <ReportTabManagementModal
              isOpen={manageTabsModalOpen}
              onClose={() => setManageTabsModalOpen(false)}
              tabs={draftReport.tabs || []}
              reportId={draftReport.id}
            />
          )}
        </div>

        {/* right sidebar */}
        <div className="w-0 bg-white flex-none border-l shadow"></div>
      </div>

      {/* Footer */}
      {/* <div className="bg-gray-100 p-4 flex-none border-t shadow"></div> */}
    </div>
  );
}
