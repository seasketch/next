import { Trans, useTranslation } from "react-i18next";
import {
  SketchingDetailsFragment,
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
import {
  ReportCardConfiguration,
  ReportConfiguration,
  registerCards,
} from "../../reports/cards";
import { ReportCardFactory } from "../../reports/ReportCard";
import { TextBlockCardConfiguration } from "../../reports/TextBlockCard";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Warning from "../../components/Warning";
import useDebounce from "../../useDebounce";

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
      // refetchQueries: [
      //   {
      //     query: DraftReportDocument,
      //     variables: { sketchClassId: sketchClass.id },
      //   },
      // ],
      awaitRefetchQueries: true,
    });

  // const report: ReportConfiguration = {
  //   id: 1,
  //   tabs: [
  //     {
  //       id: 1,
  //       title: "Tab 1",
  //       cards: [
  //         {
  //           id: 1,
  //           type: "TextBlock",
  //           title: "Welcome",
  //           body: {
  //             type: "doc",
  //             content: [
  //               {
  //                 type: "paragraph",
  //                 content: [
  //                   {
  //                     type: "text",
  //                     text: "This is your first report. Please click the + button to customize it.",
  //                   },
  //                 ],
  //               },
  //             ],
  //           },
  //           alternateLanguageSettings: {},
  //           componentSettings: {
  //             presentation: "info",
  //           },
  //           position: 1,
  //         } as TextBlockCardConfiguration,
  //       ],
  //       position: 1,
  //       alternateLanguageSettings: {},
  //     },
  //   ],
  // };

  console.log(data);

  const draftReport = data?.sketchClass?.draftReport;
  const selectedTab = draftReport?.tabs?.[0];

  // console.log({ draftReport, selectedTab });

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
        {console.log(data)}
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
              {/* report tabs */}
              {draftReport.tabs && draftReport.tabs?.length > 1 && <div></div>}
              {/* report body */}
              <div className="p-4 bg-gray-50 rounded-b-lg space-y-2">
                {selectedTab?.cards?.length === 0 && (
                  <div>
                    <p className="text-sm text-gray-500">
                      <Trans ns="admin:sketching">
                        No cards found. Click the + button to customize.
                      </Trans>
                    </p>
                  </div>
                )}
                {selectedTab?.cards?.map((card) => (
                  <ReportCardFactory
                    key={card.id}
                    config={card as ReportCardConfiguration<any>}
                  />
                ))}
              </div>
              {/* report footer */}
              {/* <div className="p-4 border-t"></div> */}
            </div>
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
