import { useMemo } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useParams } from "react-router-dom";
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
  const changeLogs =
    changeLogsQuery.data?.projectBySlug?.changeLogsSinceLastPublish || [];
  const itemTitleById = useMemo(() => {
    const items =
      changeLogsQuery.data?.projectBySlug?.draftTableOfContentsItems || [];
    return new Map(
      items.map((item) => [
        item.id,
        { title: item.title, isFolder: item.isFolder },
      ])
    );
  }, [changeLogsQuery.data?.projectBySlug?.draftTableOfContentsItems]);

  return (
    <Modal
      title={t("Publish Overlays")}
      onRequestClose={props.onRequestClose}
      disableBackdropClick
      scrollable
      panelClassName="sm:max-w-3xl max-h-[min(90vh,52rem)]"
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
      <div className="flex min-h-0 flex-col space-y-4">
        <p className="text-sm leading-5 text-gray-600">
          <Trans ns={["admin"]}>
            Published layer lists include all authorization settings, data layer
            and source changes, and z-ordering specifications. Once published,
            project users will have access to the new list upon reloading the
            page.
          </Trans>
        </p>
        <div className="rounded-lg bg-gray-100 p-1 text-sm font-medium text-gray-600">
          <div className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-gray-900 shadow-sm">
            <span>{dataT("All Changes")}</span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <AllChangesPanel
            loading={changeLogsQuery.loading && !changeLogsQuery.data}
            changeLogs={changeLogs}
            itemTitleById={itemTitleById}
          />
        </div>
      </div>
      {publishState.error && (
        <p className="text-red-800 mt-4">
          Error: ${publishState.error.message}
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

  if (!changeLogs.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
        {t("No unpublished changes were found.")}
      </div>
    );
  }

  return (
    <ul className="max-h-[min(48vh,28rem)] overflow-y-auto pr-1">
      {changeLogs.map((changeLog, index) => (
        <ChangeLogListItem
          key={changeLog.id}
          changeLog={changeLog}
          itemTitle={titleForChangeLog(changeLog, itemTitleById, t)}
          last={index === changeLogs.length - 1}
        />
      ))}
    </ul>
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
    <span className="inline-flex min-w-0 items-center gap-1">
      <FolderIcon className="h-4 w-4 flex-none text-gray-400" aria-hidden />
      <span className="min-w-0 truncate">{title}</span>
    </span>
  );
}
