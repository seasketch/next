import { Trans, useTranslation } from "react-i18next";
import {
  ActivityStatsPeriod,
  useProjectDashboardQuery,
} from "../../generated/graphql";
import { useMemo } from "react";
import getSlug from "../../getSlug";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import bgBlur from "../../bg-blur.jpg";
import { StatItem, VisitorLineChart, VisitorMetrics } from "../../Dashboard";
import bytes from "bytes";
import { useLocalStorage } from "beautiful-react-hooks";
import Badge from "../../components/Badge";
import useIsSuperuser from "../../useIsSuperuser";

export default function ActivityDashboard() {
  const { t } = useTranslation("admin:activity");
  const [period, setPeriod] = useLocalStorage<ActivityStatsPeriod>(
    `activityStatsPeriod-${getSlug()}`,
    ActivityStatsPeriod["7Days"]
  );
  const onError = useGlobalErrorHandler();
  const { data, loading, error } = useProjectDashboardQuery({
    variables: {
      period,
      slug: getSlug(),
    },
    onError,
  });
  const isSuperUser = useIsSuperuser();

  const totalVisitors = useMemo(() => {
    return data?.projectBySlug?.visitors?.reduce((acc, v) => acc + v.count, 0);
  }, [data?.projectBySlug?.visitors]);
  const totalMapDataRequests = useMemo(() => {
    return data?.projectBySlug?.mapDataRequests?.reduce(
      (acc, v) => acc + v.count,
      0
    );
  }, [data?.projectBySlug?.mapDataRequests]);

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const activity = data?.projectBySlug?.activity;
  if (!activity) {
    return null;
  }

  const mostUsedLayers = [...(data?.projectBySlug?.mostUsedLayers || [])];
  const maxLayerUsage = mostUsedLayers.reduce(
    (acc, layer) => Math.max(acc, layer.totalRequests || 0),
    0
  );

  return (
    <div className="w-full xl:max-w-6xl md:border-r md:border-b bg-white flex flex-col md:min-h-screen">
      <div className="flex items-center space-x-1 md:space-x-2 p-2 py-3 md:p-4 md:px-6">
        <h1 className="text-md font-medium text-blue-gray-900">
          <Trans ns="admin:activity">Usage Dashboard</Trans>
        </h1>
      </div>
      <div
        style={{
          backgroundImage: `url(${bgBlur})`,
          backgroundPosition: "center",
        }}
        className="bg-blue-600 w-full md:flex md:p-2 md:py-4 lg:p-4 lg:py-8"
      >
        <StatItem
          className="md:rounded-none md:rounded-l "
          label={t("Participants")}
          value={(
            data?.projectBySlug?.activity?.registeredUsers || 0
          ).toLocaleString()}
        />
        <StatItem
          label={t("Sketches")}
          value={(activity?.sketches || 0).toLocaleString()}
        />
        <StatItem
          label={t("Forum Posts")}
          value={(activity?.forumPosts || 0).toLocaleString()}
        />
        <StatItem
          label={t("Survey Responses")}
          value={(activity.surveyResponses || 0).toLocaleString()}
        />
        <StatItem
          label={t("Data Uploads")}
          value={(activity.uploadedLayers || 0).toLocaleString()}
        />
        <StatItem
          className="md:rounded-r md:border-r"
          label={t("Layers Stored")}
          value={bytes(parseInt(activity.uploadsStorageUsed || "0"))}
        />
      </div>
      <h2 className="bg-gray-100 leading-6 text-base p-2 font-semibold flex items-center space-x-4">
        <span className="">
          {totalVisitors?.toLocaleString()} {t("Total Visitors")}
        </span>
        <span className="">
          {totalMapDataRequests?.toLocaleString()} {t("Hosted Layer Requests")}
        </span>
        <span className="text-gray-500 italic hidden md:visible">
          {t("Updated every 5 minutes.")}
        </span>
        <span className="flex-1 text-right">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as ActivityStatsPeriod)}
            className="ml-auto py-1 text-sm rounded"
          >
            <option value={ActivityStatsPeriod["24Hrs"]}>
              {t("Last 24 hours")}
            </option>
            <option value={ActivityStatsPeriod["7Days"]}>
              {t("Last 7 days")}
            </option>
            <option value={ActivityStatsPeriod["30Days"]}>
              {t("Last 30 days")}
            </option>
          </select>
        </span>
      </h2>
      {data?.projectBySlug?.visitors && (
        <VisitorLineChart
          period={period}
          data={data?.projectBySlug?.visitors.map((d) => ({
            timestamp: new Date(d.timestamp),
            count: d.count,
          }))}
          mapDataRequests={(data?.projectBySlug?.mapDataRequests || []).map(
            (d) => ({
              timestamp: new Date(d.timestamp),
              count: d.count,
              cacheRatio: d.cacheHitRatio,
            })
          )}
        />
      )}
      <h2 className="bg-gray-100 leading-6 text-base p-2 font-semibold flex">
        <span className="flex-1">{t("Visitor Metrics")}</span>
      </h2>
      <div className="md:flex w-full">
        <VisitorMetrics
          label={t("Countries")}
          data={data?.projectBySlug?.visitorMetrics?.[0]?.topCountries}
        />
        <VisitorMetrics
          label={t("Referrers")}
          data={data?.projectBySlug?.visitorMetrics?.[0]?.topReferrers}
        />
        <VisitorMetrics
          label={t("Browsers")}
          data={data?.projectBySlug?.visitorMetrics?.[0]?.topBrowsers}
        />
      </div>
      <div className="md:flex">
        <VisitorMetrics
          label={t("Operating Systems")}
          data={data?.projectBySlug?.visitorMetrics?.[0]?.topOperatingSystems}
        />
        <VisitorMetrics
          label={t("Device Types")}
          data={data?.projectBySlug?.visitorMetrics?.[0]?.topDeviceTypes}
        />
      </div>
      {isSuperUser === true && (
        <>
          <h2 className="bg-gray-100 leading-6 text-base p-2 font-semibold flex">
            <span className="flex-1">{t("Most Popular Hosted Layers")}</span>
          </h2>
          <div>
            <ul>
              {mostUsedLayers
                .sort((a, b) => (b.totalRequests || 0) - (a.totalRequests || 0))
                .map((layer) => (
                  <li key={layer.id} className="p-2 border-b flex">
                    <span className="truncate flex-1">{layer.title}</span>
                    <div className="w-1/4 text-right">
                      <div
                        className="bg-primary-300 h-4 inline-block"
                        style={{
                          width: `${
                            ((layer.totalRequests || 0) / maxLayerUsage) * 100
                          }%`,
                        }}
                      ></div>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
