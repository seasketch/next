import { Trans, useTranslation } from "react-i18next";
import {
  useProjectDashboardBannerStatsQuery,
  useProjectDashboardQuery,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import bgBlur from "../../bg-blur.jpg";
import {
  DashboardPeriod,
  StatItem,
  UserActivitySection,
  toActivityStatsPeriod,
  toUserActivityPeriod,
} from "../../Dashboard";
import bytes from "bytes";
import { useLocalStorage } from "beautiful-react-hooks";
import useIsSuperuser from "../../useIsSuperuser";

export default function ActivityDashboard() {
  const { t } = useTranslation("admin:activity");
  const slug = getSlug();
  const [period, setPeriod] = useLocalStorage<DashboardPeriod>(
    `activityStatsPeriod-${slug}`,
    "7d"
  );
  const onError = useGlobalErrorHandler();
  const periodValue: DashboardPeriod = (period ?? "7d") as DashboardPeriod;
  const { data, loading, error, refetch } = useProjectDashboardQuery({
    variables: {
      slug,
      period: toActivityStatsPeriod(periodValue),
      activityPeriod: toUserActivityPeriod(periodValue),
    },
    onError,
    skip: !slug,
  });
  const { data: bannerData } = useProjectDashboardBannerStatsQuery({
    variables: { slug },
    skip: !slug,
  });
  const isSuperUser = useIsSuperuser();

  const activity = bannerData?.projectBySlug?.activity;

  if (error) {
    return <div>Error: {error.message}</div>;
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
          value={(activity?.registeredUsers || 0).toLocaleString()}
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
          value={(activity?.surveyResponses || 0).toLocaleString()}
        />
        <StatItem
          label={t("Data Uploads")}
          value={(activity?.uploadedLayers || 0).toLocaleString()}
        />
        <StatItem
          className="md:rounded-r md:border-r"
          label={t("Layers Stored")}
          value={bytes(parseInt(activity?.uploadsStorageUsed || "0"))}
        />
      </div>
      <UserActivitySection
        period={periodValue}
        onPeriodChange={setPeriod}
        loading={loading}
        visitors={data?.userActivityStats?.visitors as any}
        mapDataRequests={data?.userActivityStats?.mapDataRequests as any}
        visitorMetrics={data?.userActivityStats?.visitorMetrics as any}
        sampleInterval={(data?.userActivityStats as any)?.sampleInterval}
        slug={slug}
        onRefresh={() => refetch()}
      />
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
