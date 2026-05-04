import { useMemo } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useParams } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { FolderIcon } from "@heroicons/react/outline";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import {
  ChangeLogsSinceLastPublishQuery,
  LayersAndSourcesForItemsDocument,
  PublishedTableOfContentsDocument,
  useChangeLogsSinceLastPublishQuery,
  usePublishTableOfContentsMutation,
} from "../../generated/graphql";
import ChangeLogListItem from "../changelogs/ChangeLogListItem";
import {
  summary,
  valueText,
} from "../changelogs/fieldGroups/FieldGroupListItemBase";
import useProjectId from "../../useProjectId";
import { CHANGE_LOG_INTRODUCTION_DATE } from "../changelogs/constants";
import PublishSummarizedChangesPanel from "./PublishSummarizedChangesPanel";
import PublishUnresolvedCommentsPanel from "./PublishUnresolvedCommentsPanel";
import clsx from "clsx";

export default function PublishTableOfContentsModal(props: {
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin");
  const { t: dataT } = useTranslation("admin:data");
  const { slug } = useParams<{ slug: string }>();
  const changeLogsQuery = useChangeLogsSinceLastPublishQuery({
    variables: { slug },
    fetchPolicy: "cache-and-network",
  });
  const [publish, publishState] = usePublishTableOfContentsMutation({
    refetchQueries: [
      PublishedTableOfContentsDocument,
      LayersAndSourcesForItemsDocument,
    ],
  });
  const projectId = useProjectId();
  const publishProject = changeLogsQuery.data?.projectBySlug as
    | ChangeLogsSinceLastPublishQuery["projectBySlug"]
    | undefined;
  const changeLogs = publishProject?.changeLogsSinceLastPublish || [];
  const draftTableOfContentsItems =
    publishProject?.draftTableOfContentsItems || [];
  const tableOfContentsLastPublished =
    publishProject?.tableOfContentsLastPublished;
  const itemTitleById = useMemo(() => {
    const items = publishProject?.draftTableOfContentsItems || [];
    return new Map(
      items.map((item) => [
        item.id,
        { title: item.title, isFolder: item.isFolder },
      ])
    );
  }, [publishProject?.draftTableOfContentsItems]);

  const loading = changeLogsQuery.loading && !changeLogsQuery.data;

  return (
    <Modal
      title={t("Publish Overlays")}
      onRequestClose={props.onRequestClose}
      disableBackdropClick
      scrollable
      panelClassName="flex max-h-[min(90vh,52rem)] flex-col sm:max-w-3xl"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      footer={[
        {
          autoFocus: true,
          label: t("Publish"),
          disabled: publishState.loading,
          loading: publishState.loading,
          variant: "primary",
          onClick: async () => {
            await publish({
              variables: {
                projectId: projectId!,
              },
            })
              .then((val) => {
                if (!val.errors) {
                  props.onRequestClose();
                }
              })
              .catch((e) => {
                console.error(e);
              });
          },
        },
        {
          label: t("Cancel"),
          onClick: props.onRequestClose,
        },
      ]}
    >
      <Tabs.Root
        defaultValue="summarized"
        className="flex min-h-0 flex-1 flex-col outline-none"
      >
        <div className="w-full shrink-0 px-6 pb-3 pt-4">
          <Tabs.List className="grid w-full grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium text-gray-600">
            <Tabs.Trigger
              value="summarized"
              className={clsx(
                "rounded-md px-3 py-2 outline-none transition-colors",
                "data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm",
                "data-[state=inactive]:text-gray-600"
              )}
            >
              {dataT("Summarized Changes")}
            </Tabs.Trigger>
            <Tabs.Trigger
              value="unresolved"
              className={clsx(
                "rounded-md px-3 py-2 outline-none transition-colors",
                "data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm",
                "data-[state=inactive]:text-gray-600"
              )}
            >
              {dataT("Unresolved Comments")}
            </Tabs.Trigger>
            <Tabs.Trigger
              value="all"
              className={clsx(
                "rounded-md px-3 py-2 outline-none transition-colors",
                "data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm",
                "data-[state=inactive]:text-gray-600"
              )}
            >
              {dataT("All Changes")}
            </Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content
          value="summarized"
          className="min-h-0 flex-1 overflow-y-auto outline-none data-[state=inactive]:hidden"
        >
          <div className="px-6 pb-6">
            {loading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : (
              <PublishSummarizedChangesPanel
                changeLogs={changeLogs}
                draftItems={draftTableOfContentsItems}
                tableOfContentsLastPublished={tableOfContentsLastPublished}
              />
            )}
          </div>
        </Tabs.Content>
        <Tabs.Content
          value="unresolved"
          className="min-h-0 flex-1 overflow-y-auto outline-none data-[state=inactive]:hidden"
        >
          <div className="px-6 pb-6">
            {loading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : (
              <PublishUnresolvedCommentsPanel project={publishProject} />
            )}
          </div>
        </Tabs.Content>
        <Tabs.Content
          value="all"
          className="min-h-0 flex-1 overflow-y-auto outline-none data-[state=inactive]:hidden"
        >
          <div className="px-6 pb-6">
            <AllChangesPanel
              loading={loading}
              changeLogs={changeLogs}
              itemTitleById={itemTitleById}
            />
          </div>
        </Tabs.Content>
      </Tabs.Root>
      {publishState.error && (
        <p className="mt-4 px-6 text-red-800">
          Error: {publishState.error.message}
        </p>
      )}
    </Modal>
  );
}

function AllChangesPanel({
  loading,
  changeLogs,
  itemTitleById,
}: {
  loading: boolean;
  changeLogs: NonNullable<
    NonNullable<
      ChangeLogsSinceLastPublishQuery["projectBySlug"]
    >["changeLogsSinceLastPublish"]
  >;
  itemTitleById: Map<number, { title: string; isFolder: boolean }>;
}) {
  const { t } = useTranslation("admin:data");

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const daysSinceIntroduction = Math.floor(
    (Date.now() - CHANGE_LOG_INTRODUCTION_DATE.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (!changeLogs.length) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-5 text-gray-600">
          <Trans ns={["admin"]}>
            Published layer lists include all authorization settings, data layer
            changes, and cartography. Below you will find all the changes since
            last publication listed.
          </Trans>
        </p>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          {daysSinceIntroduction < 90
            ? t(
                "No unpublished changes were found. Change logging was introduced on {{date}}, so any changes made before that date were not logged. In the future, you can look forward to seeing detailed change history for layer list updates.",
                {
                  date: CHANGE_LOG_INTRODUCTION_DATE.toLocaleDateString(),
                }
              )
            : t(
                "No unpublished changes were found in the changelog. There may still be changes not recorded by the changelog system that need publishing."
              )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-5 text-gray-600">
        <Trans ns={["admin"]}>
          Published layer lists include all authorization settings, data layer
          changes, and cartography. Below you will find all the changes since
          last publication listed.
        </Trans>
      </p>
      <ul>
        {changeLogs.map((changeLog, index) => (
          <ChangeLogListItem
            key={changeLog.id}
            changeLog={changeLog}
            itemTitle={titleForChangeLog(changeLog, itemTitleById, t)}
            last={index === changeLogs.length - 1}
          />
        ))}
      </ul>
    </div>
  );
}

function titleForChangeLog(
  changeLog: NonNullable<
    NonNullable<
      ChangeLogsSinceLastPublishQuery["projectBySlug"]
    >["changeLogsSinceLastPublish"]
  >[number],
  itemTitleById: Map<number, { title: string; isFolder: boolean }>,
  fallback: (key: string) => string
) {
  if (changeLog.entityType !== "table_of_contents_items") {
    return undefined;
  }
  const to = summary(changeLog.toSummary);
  const from = summary(changeLog.fromSummary);
  const currentItem = itemTitleById.get(changeLog.entityId);
  const title =
    currentItem?.title ||
    valueText(to.title) ||
    valueText(from.title) ||
    valueText(to.filename) ||
    fallback("Unknown layer");
  const isFolder =
    currentItem?.isFolder ||
    to.is_folder === true ||
    from.is_folder === true ||
    changeLog.fieldGroup.startsWith("FOLDER");

  if (!isFolder) {
    return title;
  }

  return (
    <span className="inline-flex h-6 min-w-0 items-center gap-1 align-middle leading-6">
      <FolderIcon className="h-3.5 w-3.5 flex-none text-gray-400" aria-hidden />
      <span className="min-w-0 truncate leading-6">{title}</span>
    </span>
  );
}
