import { NetworkStatus } from "@apollo/client";
import { useCallback, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import Spinner from "../../components/Spinner";
import Warning from "../../components/Warning";
import {
  ChangeLogDetailsFragment,
  useChangeLogEntityLookupsQuery,
  useDraftTableOfContentsQuery,
  useProjectChangeLogHistoryQuery,
} from "../../generated/graphql";
import AdminDataViewScreenHeading from "../data/AdminDataViewScreenHeading";
import ChangeLogLayerTitle from "./ChangeLogLayerTitle";
import ChangeLogListItem from "./ChangeLogListItem";
import {
  ChangeLogTocItem,
  buildChangeLogEntityLookups,
  titleForChangeLog,
} from "./changeLogEntityTitle";
import { CHANGE_LOG_INTRODUCTION_DATE } from "./constants";
import { TOC_ENTITY_TYPE } from "../data/publishChangelogSummary";
import ProjectChangeLogList from "./ProjectChangeLogList";

export const PROJECT_CHANGE_LOG_PAGE_SIZE = 50;

interface DayGroup {
  key: string;
  date: Date;
  changeLogs: ChangeLogDetailsFragment[];
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Entries arrive newest first, so consecutive entries share a day. */
function groupByDay(changeLogs: ChangeLogDetailsFragment[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const changeLog of changeLogs) {
    const date = new Date(changeLog.lastAt);
    const key = localDayKey(date);
    const current = groups[groups.length - 1];
    if (current && current.key === key) {
      current.changeLogs.push(changeLog);
    } else {
      groups.push({ key, date, changeLogs: [changeLog] });
    }
  }
  return groups;
}

export default function ProjectChangeLogPanel({ slug }: { slug: string }) {
  const { t } = useTranslation("admin:data");

  const { data, error, networkStatus, fetchMore } =
    useProjectChangeLogHistoryQuery({
      variables: { slug, first: PROJECT_CHANGE_LOG_PAGE_SIZE },
      fetchPolicy: "network-only",
      nextFetchPolicy: "cache-first",
      notifyOnNetworkStatusChange: true,
    });
  const lookupsQuery = useChangeLogEntityLookupsQuery({
    variables: { slug },
    fetchPolicy: "cache-and-network",
  });
  const draftTableOfContents = useDraftTableOfContentsQuery({
    variables: { slug },
    fetchPolicy: "cache-first",
  });

  const connection = data?.projectBySlug?.changeLogsConnection;
  const changeLogs = useMemo(() => connection?.nodes ?? [], [connection]);
  const hasNextPage = connection?.pageInfo.hasNextPage ?? false;
  const endCursor = connection?.pageInfo.endCursor;
  const initialLoading =
    !data?.projectBySlug && networkStatus !== NetworkStatus.error;
  const loadingMore = networkStatus === NetworkStatus.fetchMore;

  const lookups = useMemo(
    () =>
      buildChangeLogEntityLookups(
        lookupsQuery.data?.projectBySlug?.draftTableOfContentsItems ?? []
      ),
    [lookupsQuery.data?.projectBySlug?.draftTableOfContentsItems]
  );
  const tocItems = useMemo((): ChangeLogTocItem[] => {
    return (
      draftTableOfContents.data?.projectBySlug?.draftTableOfContentsItems ?? []
    ).map((item) => ({
      id: item.id,
      title: item.title,
      isFolder: Boolean(item.isFolder),
      stableId: item.stableId,
      parentStableId: item.parentStableId,
      hasDataLayer: item.dataLayerId != null,
    }));
  }, [draftTableOfContents.data?.projectBySlug?.draftTableOfContentsItems]);
  const tocItemById = useMemo(() => {
    const byId = new Map<number, ChangeLogTocItem>();
    for (const item of tocItems) {
      byId.set(item.id, item);
    }
    return byId;
  }, [tocItems]);
  const dayGroups = useMemo(() => groupByDay(changeLogs), [changeLogs]);
  const renderLayerTitle = useCallback(
    (title: string, itemId: number) => {
      const item = tocItemById.get(itemId);
      if (!item) {
        return title;
      }
      return (
        <ChangeLogLayerTitle item={item} title={title} tocItems={tocItems} />
      );
    },
    [tocItemById, tocItems]
  );
  const renderEntry = useCallback(
    (changeLog: ChangeLogDetailsFragment, lastInGroup: boolean) => (
      <ChangeLogListItem
        changeLog={changeLog}
        scope="project"
        last={lastInGroup}
        itemTitle={titleForChangeLog(
          changeLog,
          lookups.itemTitleById,
          lookups.dataTableNameById,
          t,
          renderLayerTitle
        )}
        missingProfileLabel={
          changeLog.entityType === TOC_ENTITY_TYPE &&
          lookups.tocItemIdsWithDataLibrarySource.has(changeLog.entityId)
            ? t("Data Library")
            : undefined
        }
      />
    ),
    [lookups, renderLayerTitle, t]
  );

  const loadMore = () => {
    if (!endCursor || loadingMore) {
      return;
    }
    fetchMore({
      variables: {
        slug,
        first: PROJECT_CHANGE_LOG_PAGE_SIZE,
        after: endCursor,
      },
      updateQuery: (previous, { fetchMoreResult }) => {
        const previousProject = previous.projectBySlug;
        const nextConnection =
          fetchMoreResult?.projectBySlug?.changeLogsConnection;
        if (!previousProject?.changeLogsConnection || !nextConnection) {
          return previous;
        }
        const seen = new Set(
          previousProject.changeLogsConnection.nodes.map((node) => node.id)
        );
        return {
          ...previous,
          projectBySlug: {
            ...previousProject,
            changeLogsConnection: {
              ...previousProject.changeLogsConnection,
              nodes: [
                ...previousProject.changeLogsConnection.nodes,
                ...nextConnection.nodes.filter((node) => !seen.has(node.id)),
              ],
              pageInfo: nextConnection.pageInfo,
            },
          },
        };
      },
    }).catch((e) => {
      console.error(e);
    });
  };

  const formatDay = useMemo(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const todayKey = localDayKey(today);
    const yesterdayKey = localDayKey(yesterday);
    const formatter = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return (group: DayGroup) =>
      group.key === todayKey
        ? t("Today")
        : group.key === yesterdayKey
        ? t("Yesterday")
        : formatter.format(group.date);
  }, [t]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex-none px-4 pb-3 pt-5 sm:px-6">
        <AdminDataViewScreenHeading>
          <Trans ns="admin:data">Changelog</Trans>
        </AdminDataViewScreenHeading>
        <p className="mt-2 max-w-4xl text-sm leading-snug text-gray-600">
          <Trans ns="admin:data">
            Each recorded change to the data layers list appears below.
          </Trans>
        </p>
      </header>
      <div className="relative min-h-0 flex-1">
        {error && !data?.projectBySlug && (
          <Warning level="error" className="mx-4 sm:mx-6">
            {error.message || t("An error occurred loading the changelog.")}
          </Warning>
        )}
        {initialLoading && !error && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
        {!initialLoading && changeLogs.length === 0 && !error && (
          <div className="mx-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 sm:mx-6">
            {t(
              "No changes have been logged yet. Change logging was introduced on {{date}}, so earlier changes were not recorded.",
              { date: CHANGE_LOG_INTRODUCTION_DATE.toLocaleDateString() }
            )}
          </div>
        )}
        {changeLogs.length > 0 && (
          <ProjectChangeLogList
            dayGroups={dayGroups}
            formatDay={formatDay}
            renderEntry={renderEntry}
            hasNextPage={hasNextPage}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            entryCount={changeLogs.length}
            beginningMessage={t(
              "The changelog feature was introduced on {{date}}. Changes before that date were not recorded.",
              { date: CHANGE_LOG_INTRODUCTION_DATE.toLocaleDateString() }
            )}
          />
        )}
      </div>
    </div>
  );
}
