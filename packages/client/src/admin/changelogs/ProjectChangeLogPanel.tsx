import { NetworkStatus } from "@apollo/client";
import { ChevronDownIcon } from "@heroicons/react/outline";
import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import Spinner from "../../components/Spinner";
import Warning from "../../components/Warning";
import {
  ChangeLogDetailsFragment,
  useChangeLogEntityLookupsQuery,
  useProjectChangeLogHistoryQuery,
} from "../../generated/graphql";
import AdminDataViewScreenHeading from "../data/AdminDataViewScreenHeading";
import ChangeLogListItem from "./ChangeLogListItem";
import {
  buildChangeLogEntityLookups,
  titleForChangeLog,
} from "./changeLogEntityTitle";
import { CHANGE_LOG_INTRODUCTION_DATE } from "./constants";
import { TOC_ENTITY_TYPE } from "../data/publishChangelogSummary";

export const PROJECT_CHANGE_LOG_PAGE_SIZE = 100;

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
  const { t: adminT } = useTranslation("admin");

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
  const dayGroups = useMemo(() => groupByDay(changeLogs), [changeLogs]);

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
            Every change made to the layer list, newest first, whether or not it
            has been published.
          </Trans>
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        <div className="max-w-4xl">
          {error && !data?.projectBySlug && (
            <Warning level="error">
              {error.message || t("An error occurred loading the changelog.")}
            </Warning>
          )}
          {initialLoading && !error && (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          )}
          {!initialLoading && changeLogs.length === 0 && !error && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              {t(
                "No changes have been logged yet. Change logging was introduced on {{date}}, so earlier changes were not recorded.",
                { date: CHANGE_LOG_INTRODUCTION_DATE.toLocaleDateString() }
              )}
            </div>
          )}
          <div className="flex flex-col gap-6">
            {dayGroups.map((group) => (
              <section
                key={group.key}
                className="rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-950/5"
              >
                <header className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-t-xl border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                  <h3 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {formatDay(group)}
                  </h3>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-slate-700">
                    {adminT("{{count}} changes", {
                      count: group.changeLogs.length,
                    })}
                  </span>
                </header>
                <ul className="px-4 py-5">
                  {group.changeLogs.map((changeLog, index) => (
                    <ChangeLogListItem
                      key={changeLog.id}
                      changeLog={changeLog}
                      scope="project"
                      last={index === group.changeLogs.length - 1}
                      itemTitle={titleForChangeLog(
                        changeLog,
                        lookups.itemTitleById,
                        lookups.dataTableNameById,
                        t
                      )}
                      missingProfileLabel={
                        changeLog.entityType === TOC_ENTITY_TYPE &&
                        lookups.tocItemIdsWithDataLibrarySource.has(
                          changeLog.entityId
                        )
                          ? t("Data Library")
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {hasNextPage && (
            <div className="flex justify-center pt-6">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 disabled:cursor-wait disabled:opacity-70"
              >
                {loadingMore ? (
                  <Spinner mini />
                ) : (
                  <ChevronDownIcon
                    className="h-4 w-4 text-gray-500"
                    aria-hidden
                  />
                )}
                <span>
                  <Trans ns="admin:data">Load older changes</Trans>
                </span>
              </button>
            </div>
          )}
          {!hasNextPage && changeLogs.length > 0 && (
            <p className="pt-6 text-center text-xs text-gray-400">
              {t(
                "This is the beginning of the changelog. Changes made before {{date}} were not recorded.",
                { date: CHANGE_LOG_INTRODUCTION_DATE.toLocaleDateString() }
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
