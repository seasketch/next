/* eslint-disable i18next/no-literal-string */
import {
  ActivityStatsPeriod,
  UserActivityPeriod,
  useDashboardBannerStatsQuery,
  useDashboardStatsQuery,
  useUserIsSuperuserQuery,
} from "./generated/graphql";
import bytes from "bytes";
import logo from "./header/seasketch-logo.png";
import bgBlur from "./bg-blur.jpg";
import {
  CaretLeftIcon,
  ClipboardIcon,
  LayersIcon,
  PersonIcon,
  ReloadIcon,
  TransformIcon,
} from "@radix-ui/react-icons";
import { ReactNode, useCallback, useState } from "react";
import { ChatIcon } from "@heroicons/react/outline";
import { useRef, useEffect } from "react";
import * as d3 from "d3";
import Warning from "./components/Warning";

export type DashboardPeriod = "24h" | "7d" | "30d" | "90d" | "180d";

export function toActivityStatsPeriod(p: DashboardPeriod): ActivityStatsPeriod {
  switch (p) {
    case "24h":
      return ActivityStatsPeriod["24Hrs"];
    case "7d":
      return ActivityStatsPeriod["7Days"];
    case "30d":
      return ActivityStatsPeriod["30Days"];
    case "90d":
    case "180d":
      return ActivityStatsPeriod["30Days"];
  }
}

export function toUserActivityPeriod(p: DashboardPeriod): UserActivityPeriod {
  switch (p) {
    case "24h":
      return UserActivityPeriod.H24;
    case "7d":
      return UserActivityPeriod.D7;
    case "30d":
      return UserActivityPeriod.D30;
    case "90d":
      return UserActivityPeriod.D90;
    case "180d":
      return UserActivityPeriod.D180;
  }
}

export default function Dashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>("24h");
  const isSuperUserQuery = useUserIsSuperuserQuery();
  const { data: bannerData } = useDashboardBannerStatsQuery({
    pollInterval: 60000,
  });
  const { data, loading, error, refetch } = useDashboardStatsQuery({
    variables: {
      period: toActivityStatsPeriod(period),
      activityPeriod: toUserActivityPeriod(period),
    },
    pollInterval: 60000,
  });
  if (isSuperUserQuery.loading) {
    return null;
  } else if (isSuperUserQuery.data?.currentUserIsSuperuser === false) {
    return (
      <div className="w-full h-full">
        <div className="w-128 bg-white border shadow mx-auto rounded-lg p-4 mt-8">
          <Warning level="error">
            You are not authorized to view this page.
          </Warning>
        </div>
      </div>
    );
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }
  return (
    <div className="w-full xl:max-w-6xl mx-auto md:border bg-white flex flex-col">
      <div className="flex items-center space-x-1 md:space-x-2 p-2 py-3 md:p-4">
        <a href="/">
          <CaretLeftIcon className="h-8 w-8 md:mr-2" />
        </a>
        <img src={logo} alt="SeaSketch Logo" className="h-8 pr-2 md:pr-0" />
        <h1 className="text-lg">SeaSketch Usage Dashboard </h1>
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
          label="Projects"
          value={(bannerData?.dashboardStats?.projects || 0).toLocaleString()}
        />
        <StatItem
          label="User Accounts"
          value={(bannerData?.dashboardStats?.users || 0).toLocaleString()}
        />
        <StatItem
          className="sm:hidden md:visible"
          label="Data Uploads"
          value={(bannerData?.dashboardStats?.uploads || 0).toLocaleString()}
        />
        <StatItem
          label="Layers Stored"
          value={bytes(
            parseInt(bannerData?.dashboardStats?.uploadedBytes || "0")
          )}
        />
        <StatItem
          label="Survey Responses"
          value={(
            bannerData?.dashboardStats?.surveyResponses || 0
          ).toLocaleString()}
        />
        <StatItem
          label="Sketches"
          value={(bannerData?.dashboardStats?.sketches || 0).toLocaleString()}
        />
        <StatItem
          className="md:rounded-r md:border-r"
          label="Forum Posts"
          value={(bannerData?.dashboardStats?.forumPosts || 0).toLocaleString()}
        />
      </div>
      <UserActivitySection
        period={period}
        onPeriodChange={setPeriod}
        loading={loading}
        visitors={data?.userActivityStats?.visitors as any}
        mapDataRequests={data?.userActivityStats?.mapDataRequests as any}
        visitorMetrics={data?.userActivityStats?.visitorMetrics as any}
        sampleInterval={(data?.userActivityStats as any)?.sampleInterval}
        onRefresh={() => refetch()}
      />
      {(period === "24h" || period === "7d" || period === "30d") && (
        <>
          <h2 className="bg-gray-100 leading-6 text-base p-2 font-semibold flex">
            <span className="flex-1">
              Active Projects in the previous{" "}
              {period === "24h"
                ? "24 hours"
                : period === "7d"
                ? "7 days"
                : "30 days"}
              .
            </span>
          </h2>
          {loading && !data?.activeProjects ? (
            <SkeletonProjectList />
          ) : (
            <ul>
              {data?.activeProjects?.length === 0 && (
                <div className="w-72 text-center p-2 text-gray-500 mt-8 mb-8 mx-auto">
                  No active projects
                </div>
              )}
              {data?.activeProjects?.map((project) => (
                <li key={project.id} className="p-2 border-t flex space-x-2">
                  <div className="flex-1 lg:flex-none text-base truncate lg:w-72">
                    <a className="hover:text-underline" href={project.url!}>
                      {project.name}
                    </a>
                  </div>
                  <div className="flex-1 space-x-4  flex items-center justify-end">
                    <IncreaseSymbol
                      title="New Users"
                      value={project.activity?.newUsers}
                    >
                      <PersonIcon />
                    </IncreaseSymbol>
                    <IncreaseSymbol
                      title="Uploaded data"
                      value={
                        project.activity?.newUploadedBytes !== "0"
                          ? project.activity?.newUploadedBytes
                            ? bytes(
                                parseInt(
                                  project.activity.newUploadedBytes || "0"
                                )
                              )
                            : null
                          : null
                      }
                    >
                      <LayersIcon className="transform scale-110" />
                    </IncreaseSymbol>
                    <IncreaseSymbol
                      title="Sketches drawn"
                      value={project.activity?.newSketches}
                    >
                      <TransformIcon />
                    </IncreaseSymbol>
                    <IncreaseSymbol
                      title="Forum posts"
                      value={project.activity?.newForumPosts}
                    >
                      <ChatIcon className="w-5 h-5" />
                    </IncreaseSymbol>
                    <IncreaseSymbol
                      title="Survey responses"
                      value={project.activity?.newSurveyResponses}
                    >
                      <ClipboardIcon className="w-4 h-4" />
                    </IncreaseSymbol>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Increase({ value }: { value?: number | string | null }) {
  if (!value) {
    return null;
  }
  return <span className="text-green-500 mx-1 font-extrabold">+{value}</span>;
}

function IncreaseSymbol({
  value,
  children,
  className,
  skipPlus,
  title,
}: {
  value: number | string | null | undefined;
  children: ReactNode;
  className?: string;
  skipPlus?: boolean;
  title?: string;
}) {
  if (!value) {
    return null;
  } else {
    return (
      <span
        title={title}
        className={`text-green-500 font-semibold inline-flex space-x-0.5 items-center ${className}`}
      >
        <span>{children}</span>
        <span className="ml-0.5">
          {skipPlus ? "" : "+"}
          {value}
        </span>
      </span>
    );
  }
}

export function StatItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div
      className={`flex md:flex-col p-4 md:px-4 lg:px-6 flex-1 border-white border-opacity-50 border text-white bg-blue-100 bg-opacity-5 ${className} md:border-r-0 items-center md:items-start border-b-0 md:border-b`}
      style={{
        backdropFilter: "blur(5px)",
      }}
      title={label}
    >
      <div className="flex-1 md:flex-none text-sm font-medium leading-6 text-white truncate">
        {label}
      </div>
      <div className="text-3xl font-bold leading-10">{value}</div>
    </div>
  );
}

export function VisitorMetrics({
  label,
  data,
  linkify,
}: {
  label: string;
  data?: { label: string; count: number }[];
  linkify?: boolean;
}) {
  if (!data) {
    return null;
  }
  const max = data.reduce((max, item) => Math.max(max, item.count), 0);
  return (
    <div className="p-2 md:p-4 flex-1 max-w-sm">
      <h4 className="font-semibold pb-1">{label}</h4>
      <ul className="w-full text-sm">
        {data.length === 0 && <li>None</li>}
        {data.map((item) => (
          <li key={item.label} className="flex items-center space-x-1">
            {linkify && item.label ? (
              <a
                href={`https://${item.label}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-36 truncate flex-none text-blue-600 hover:underline"
              >
                {item.label}
              </a>
            ) : (
              <span className="w-36 truncate flex-none">{item.label}</span>
            )}
            <div className="flex-none w-8 text-xs text-gray-500">
              {item.count}
            </div>

            <div className="text-gray-500 text-sm flex-1 relative">
              <div
                className="bg-primary-300 h-4 relative"
                style={{
                  width: `${(item.count / max) * 100}%`,
                }}
              ></div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * VisitorLineChart
 * Line chart of visitors over time, implemented with D3
 */
export function VisitorLineChart({
  data,
  period,
  mapDataRequests,
}: {
  data: { timestamp: Date; count: number }[];
  mapDataRequests: { timestamp: Date; count: number; cacheRatio: number }[];
  period: string;
}) {
  const hasMapData = mapDataRequests.length > 0;
  const chartRef = useRef<SVGSVGElement | null>(null);
  const [width, setWidth] = useState(document.body.clientWidth);
  // Update width on resize
  useEffect(() => {
    const handleResize = () => {
      setWidth(document.body.clientWidth);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!data || data.length === 0) return;
    if (chartRef.current) {
      chartRef.current.querySelectorAll("*").forEach((el) => el.remove());
    }
    const margin = { top: 20, right: 30, bottom: 60, left: 50 };
    const width = chartRef.current?.clientWidth || 0;
    const height = 300;

    const svg = d3
      .select(chartRef.current)
      .attr("width", width)
      .attr("height", height);

    const x = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => d.timestamp) as [Date, Date])
      .range([margin.left, width - margin.right]);

    const maxY = d3.max(data, (d) => d.count) as number;
    const y = d3
      .scaleLinear()
      .domain([0, maxY < 3 ? 3 : maxY])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const maxMapDataRequestsY = d3.max(
      mapDataRequests,
      (d) => d.count
    ) as number;
    const mapDataRequestsY = d3
      .scaleLinear()
      .domain([0, maxMapDataRequestsY < 3 ? 3 : maxMapDataRequestsY])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const line = d3
      .line<{ timestamp: Date; count: number }>()
      .x((d) => x(d.timestamp))
      .y((d) => y(d.count));

    const mapDataRequestsLine = d3
      .line<{ timestamp: Date; count: number }>()
      .x((d) => x(d.timestamp))
      .y((d) => mapDataRequestsY(d.count));

    svg.selectAll("*").remove();

    svg
      .on("pointerenter pointermove", pointermoved)
      .on("pointerleave", pointerleft)
      .on("touchstart", (event) => event.preventDefault());

    if (hasMapData) {
      svg
        .append("path")
        .datum(mapDataRequests)
        .attr("fill", "none")
        .attr("stroke", "rgba(16,124,17,0.4)")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5,2")
        .attr("d", mapDataRequestsLine);
    }

    svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 1.5)
      .attr("d", line);

    const xAxisScale = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => d.timestamp) as [Date, Date])
      .range([margin.left, width - margin.right]);

    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(
            xAxisScale.ticks(
              // @ts-ignore
              period === "24h"
                ? d3.utcHour.every(2)
                : period === "7d"
                ? d3.utcDay.every(1)
                : period === "180d"
                ? d3.utcWeek.every(2)
                : period === "90d"
                ? d3.utcWeek.every(1)
                : d3.utcDay.every(3)
            )
          )
          .tickFormat((d) =>
            period === "24h"
              ? new Date(d as number).toLocaleTimeString("en-US", {
                  timeStyle: "short",
                  timeZone: "PST",
                })
              : period === "7d"
              ? new Date(d as number).toLocaleDateString("en-US", {
                  month: "short",
                  weekday: "short",
                  day: "numeric",
                })
              : period === "90d" || period === "180d"
              ? new Date(d as number).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : new Date(d as number).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
          )
      );

    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3.axisLeft(y).tickFormat(function (d: any) {
          if (d % 1 == 0) {
            return Math.round(d).toString();
          } else {
            return "";
          }
        })
      );

    const area = d3
      .area<{ timestamp: Date; count: number }>()
      .x((d) => x(d.timestamp))
      .y1((d) => y(d.count))
      .y0((d) => y(0));

    const gradient = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", "mygrad") // defining an id
      .attr("x1", "0%")
      .attr("x2", "0%")
      .attr("y1", "0%")
      .attr("y2", "100%");

    gradient
      .append("stop")
      .attr("offset", "10%")
      .style("stop-color", "rgb(76,124,187)")
      .style("stop-opacity", 0.8);

    gradient
      .append("stop")
      .attr("offset", "100%")
      .style("stop-color", "white")
      .style("stop-opacity", 0.1);

    svg
      .append("path")
      .datum(data)
      .attr("d", area)
      .style("fill", "url(#mygrad)"); // assigning to defined id

    const legendContainer = svg
      .append("g")
      .attr(
        "transform",
        `translate(${width / 2 - 125},${height - margin.bottom + 40})`
      );

    const legendItems = [
      { label: "Visitors", color: "steelblue", strokeDasharray: "0" },
    ];
    if (hasMapData) {
      legendItems.push({
        label: "Hosted Layer Requests",
        color: "rgba(16,124,17,0.5)",
        strokeDasharray: "5,2",
      });
    }

    const legendEntry = legendContainer
      .selectAll("g")
      .data(legendItems)
      .join("g")
      .attr("transform", (d, i) => `translate(${i * 100}, 0)`);

    legendEntry
      .append("line")
      .attr("x1", 0)
      .attr("x2", 13)
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", (d) => d.strokeDasharray)
      .attr("y1", 0)
      .attr("y2", 0);

    legendEntry
      .append("text")
      .attr("x", 20)
      .attr("y", 0)
      .attr("dy", "0.35em")
      .attr("font-size", "12px")
      .text((d) => d.label);

    // Create the tooltip container.
    const tooltip = svg.append("g");

    function formatDate(date: Date) {
      return date.toLocaleString("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
        // timeZone: "UTC",
      });
    }

    function formatTime(date: Date) {
      return date.toLocaleTimeString("en", {
        hour: "numeric",
        minute: "numeric",
        // timeZone: "UTC",
      });
    }

    // Add the event listeners that show or hide the tooltip.
    const bisect = d3.bisector((d: any) => d.timestamp);

    function pointermoved(event: MouseEvent) {
      const i = bisect.center(data, x.invert(d3.pointer(event)[0]));
      tooltip.style("display", null);
      tooltip.attr(
        "transform",
        `translate(${x(data[i].timestamp)},${y(data[i].count)})`
      );

      const path = tooltip
        .selectAll("path")
        .data([,])
        .join("path")
        .attr("fill", "rgba(255, 255, 255, 0.9)")
        .attr("stroke", "black");

      const text = tooltip
        .selectAll("text")
        .data([,])
        .join("text")
        .call((text) =>
          text
            .selectAll("tspan")
            .data(
              (() => {
                const isDaily =
                  period === "30d" || period === "90d" || period === "180d";
                const lines: string[] = [formatDate(data[i].timestamp)];
                if (!isDaily) lines.push(formatTime(data[i].timestamp));
                lines.push(
                  data[i].count === 1
                    ? "1 visitor"
                    : `${data[i].count.toLocaleString()} visitors`
                );
                if (hasMapData) {
                  const count = mapDataRequests[i]?.count || 0;
                  lines.push(
                    count === 1
                      ? "1 map request"
                      : `${count.toLocaleString()} map requests`
                  );
                }
                return lines;
              })()
            )
            .join("tspan")
            .attr("x", 0)
            .attr("y", (_, i) => `${i * 1.1}em`)
            .attr("font-weight", (_, i) => (i === 0 ? "bold" : null))
            .attr("font-size", "12px")
            .text((d) => d)
        );

      tooltip
        .selectAll("circle")
        .data([,])
        .join("circle")
        .attr("r", 3)
        .attr("fill", "steelblue");

      size(text, path, data[i].count > maxY * 0.8 ? "bottom" : "top");
    }

    function pointerleft() {
      tooltip.style("display", "none");
    }

    // Wraps the text with a callout path of the correct size, as measured in the page.
    function size(
      text: any,
      path: any,
      orientation: "top" | "bottom" = "bottom"
    ) {
      const baseY = orientation === "bottom" ? 0 : -80;
      const { x, y, width: w, height: h } = text.node().getBBox();
      text.attr("transform", `translate(${-w / 2},${baseY + 10 - y})`);
      path.attr("d", `M${-w / 2 - 10},5H${w / 2 + 10}v${h + 10}h-${w + 20}z`);
      path.attr("transform", `translate(0,${baseY})`);
    }
  }, [data, mapDataRequests, period, width, hasMapData]);

  return <svg className="w-full" ref={chartRef}></svg>;
}

export function UserActivitySection({
  period,
  onPeriodChange,
  loading,
  visitors,
  mapDataRequests,
  visitorMetrics,
  periodOptions,
  slug,
  sampleInterval,
  onRefresh,
}: {
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  loading: boolean;
  visitors?: { timestamp: string; count: number }[];
  mapDataRequests?: {
    timestamp: string;
    count: number;
    cacheHitRatio: number;
  }[];
  visitorMetrics?: {
    topReferrers: { label: string; count: number }[];
    topCountries: { label: string; count: number }[];
    topBrowsers: { label: string; count: number }[];
    topOperatingSystems: { label: string; count: number }[];
    topDeviceTypes: { label: string; count: number }[];
  };
  periodOptions?: { value: DashboardPeriod; label: string }[];
  slug?: string;
  sampleInterval?: number;
  onRefresh?: () => Promise<any>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const isLoading = loading || refreshing;
  const totalVisitors = visitors?.reduce((acc, v) => acc + v.count, 0);
  const hasMapData = (mapDataRequests?.length ?? 0) > 0;
  const totalMapDataRequests = hasMapData
    ? mapDataRequests!.reduce((acc, v) => acc + v.count, 0)
    : 0;

  const defaultOptions: { value: DashboardPeriod; label: string }[] = [
    { value: "24h", label: "Last 24 hours" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "180d", label: "Last 6 months" },
  ];

  const options = periodOptions ?? defaultOptions;

  const exportCsv = useCallback(() => {
    if (!visitors?.length) return;

    const header = hasMapData
      ? "timestamp,visitors,map_requests,cache_hit_ratio"
      : "timestamp,visitors";
    const rows = visitors.map((v) => {
      if (!hasMapData) return `${v.timestamp},${v.count}`;
      const mr = mapDataRequests?.find((m) => m.timestamp === v.timestamp);
      return `${v.timestamp},${v.count},${mr?.count ?? 0},${
        mr?.cacheHitRatio?.toFixed(4) ?? ""
      }`;
    });

    const csv = header + "\n" + rows.join("\n") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const prefix = slug ? `${slug}-` : "";
    a.download = `${prefix}visitor-stats-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [visitors, mapDataRequests, hasMapData, period, slug]);

  return (
    <>
      <h2 className="bg-gray-100 leading-6 text-base p-2 font-semibold flex items-center space-x-4">
        {isLoading && !visitors ? (
          <>
            <span className="h-4 w-32 bg-gray-300 rounded animate-pulse" />
            <span className="h-4 w-44 bg-gray-300 rounded animate-pulse" />
          </>
        ) : (
          <>
            <span>{totalVisitors?.toLocaleString()} Total Visitors</span>
            {hasMapData && (
              <span>
                {totalMapDataRequests.toLocaleString()} Hosted Layer Requests
              </span>
            )}
          </>
        )}
        <span className="text-gray-500 italic hidden md:visible">
          Live from Cloudflare Analytics.
        </span>
        <span className="flex-1 text-right space-x-2">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-gray-400 hover:text-gray-600 align-middle disabled:opacity-40"
              title="Refresh"
            >
              <ReloadIcon
                className={`-mt-0.5 mr-2 w-3.5 h-3.5 inline${
                  refreshing ? " animate-spin" : ""
                }`}
              />
            </button>
          )}
          <button
            onClick={exportCsv}
            disabled={!visitors}
            className="py-1 px-2 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export as CSV"
          >
            Export CSV
          </button>
          <select
            value={period}
            onChange={(e) => onPeriodChange(e.target.value as DashboardPeriod)}
            className="py-1 text-sm rounded"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </span>
      </h2>
      {!isLoading && visitors ? (
        <VisitorLineChart
          period={period}
          data={visitors.map((d) => ({
            timestamp: new Date(d.timestamp),
            count: d.count,
          }))}
          mapDataRequests={(mapDataRequests || []).map((d) => ({
            timestamp: new Date(d.timestamp),
            count: d.count,
            cacheRatio: d.cacheHitRatio,
          }))}
        />
      ) : (
        <SkeletonChart />
      )}
      {!isLoading && sampleInterval != null && sampleInterval >= 40 && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
          <span>
            Data is approximate due to Cloudflare sampling (interval{" "}
            {Math.round(sampleInterval)}x).
          </span>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              className="underline hover:text-amber-900"
            >
              Refresh for more accurate results
            </button>
          )}
        </div>
      )}
      <h2 className="bg-gray-100 leading-6 text-base p-2 font-semibold flex">
        <span className="flex-1">Visitor Metrics</span>
      </h2>
      {visitorMetrics ? (
        <>
          <div className="md:flex w-full">
            <VisitorMetrics
              label="Countries"
              data={visitorMetrics.topCountries}
            />
            <VisitorMetrics
              label="Referrers"
              data={visitorMetrics.topReferrers}
              linkify
            />
            <VisitorMetrics
              label="Browsers"
              data={visitorMetrics.topBrowsers}
            />
          </div>
          <div className="md:flex">
            <VisitorMetrics
              label="Operating Systems"
              data={visitorMetrics.topOperatingSystems}
            />
            <VisitorMetrics
              label="Device Types"
              data={visitorMetrics.topDeviceTypes}
            />
          </div>
        </>
      ) : (
        <SkeletonMetrics />
      )}
    </>
  );
}

export function SkeletonChart() {
  return (
    <div className="w-full px-12 py-6" style={{ height: 300 }}>
      <div className="w-full h-full flex items-end space-x-1">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-200 rounded-t animate-pulse"
            style={{
              height: `${20 + Math.sin(i * 0.4) * 30 + Math.random() * 20}%`,
              animationDelay: `${i * 30}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonMetrics() {
  return (
    <>
      <div className="md:flex w-full">
        {[0, 1, 2].map((col) => (
          <div key={col} className="p-2 md:p-4 flex-1 max-w-sm">
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-2" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-1 mb-1">
                <div
                  className="h-4 bg-gray-200 rounded animate-pulse"
                  style={{
                    width: `${90 - i * 15}%`,
                    animationDelay: `${(col * 5 + i) * 40}ms`,
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="md:flex">
        {[0, 1].map((col) => (
          <div key={col} className="p-2 md:p-4 flex-1 max-w-sm">
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-2" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-1 mb-1">
                <div
                  className="h-4 bg-gray-200 rounded animate-pulse"
                  style={{
                    width: `${85 - i * 18}%`,
                    animationDelay: `${(col * 4 + i) * 40}ms`,
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function SkeletonProjectList() {
  return (
    <ul>
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="p-2 border-t flex space-x-2">
          <div
            className="h-5 bg-gray-200 rounded animate-pulse lg:w-72"
            style={{
              width: `${50 + Math.random() * 30}%`,
              animationDelay: `${i * 60}ms`,
            }}
          />
        </li>
      ))}
    </ul>
  );
}
