/* eslint-disable i18next/no-literal-string */
import {
  ActivityStatsPeriod,
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
  TransformIcon,
} from "@radix-ui/react-icons";
import { ReactNode, useMemo, useState } from "react";
import { ChatIcon } from "@heroicons/react/outline";
import { useRef, useEffect } from "react";
import * as d3 from "d3";
import Warning from "./components/Warning";

export default function Dashboard() {
  const [period, setPeriod] = useState<ActivityStatsPeriod>(
    ActivityStatsPeriod["24Hrs"]
  );
  const isSuperUserQuery = useUserIsSuperuserQuery();
  const { data, loading, error } = useDashboardStatsQuery({
    variables: {
      period,
    },
    pollInterval: 60000,
  });
  const totalVisitors = useMemo(() => {
    return data?.visitors?.reduce((acc, v) => acc + v.count, 0);
  }, [data?.visitors]);

  const totalMapDataRequests = useMemo(() => {
    return data?.mapDataRequests?.reduce((acc, v) => acc + v.count, 0);
  }, [data?.mapDataRequests]);
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
          value={(data?.dashboardStats?.projects || 0).toLocaleString()}
        />
        <StatItem
          label="User Accounts"
          value={(data?.dashboardStats?.users || 0).toLocaleString()}
        />
        <StatItem
          className="sm:hidden md:visible"
          label="Data Uploads"
          value={(data?.dashboardStats?.uploads || 0).toLocaleString()}
        />
        <StatItem
          label="Layers Stored"
          value={bytes(parseInt(data?.dashboardStats?.uploadedBytes || "0"))}
        />
        <StatItem
          label="Survey Responses"
          value={(data?.dashboardStats?.surveyResponses || 0).toLocaleString()}
        />
        <StatItem
          label="Sketches"
          value={(data?.dashboardStats?.sketches || 0).toLocaleString()}
        />
        <StatItem
          className="md:rounded-r md:border-r"
          label="Forum Posts"
          value={(data?.dashboardStats?.forumPosts || 0).toLocaleString()}
        />
      </div>
      <h2 className="bg-gray-100 leading-6 text-base p-2 font-semibold flex items-center space-x-4">
        <span className="">
          {totalVisitors?.toLocaleString()} Total Visitors
        </span>
        <span className="">
          {totalMapDataRequests?.toLocaleString()} Hosted Layer Requests
        </span>
        <span className="text-gray-500 italic hidden md:visible">
          Updated every minute.
        </span>
        <span className="flex-1 text-right">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as ActivityStatsPeriod)}
            className="ml-auto py-1 text-sm rounded"
          >
            <option value={ActivityStatsPeriod["24Hrs"]}>Last 24 hours</option>
            <option value={ActivityStatsPeriod["7Days"]}>Last 7 days</option>
            <option value={ActivityStatsPeriod["30Days"]}>Last 30 days</option>
          </select>
        </span>
      </h2>
      {data?.visitors && (
        <VisitorLineChart
          period={period}
          data={data?.visitors.map((d) => ({
            timestamp: new Date(d.timestamp),
            count: d.count,
          }))}
          mapDataRequests={(data?.mapDataRequests || []).map((d) => ({
            timestamp: new Date(d.timestamp),
            count: d.count,
            cacheRatio: d.cacheHitRatio,
          }))}
        />
      )}
      <h2 className="bg-gray-100 leading-6 text-base p-2 font-semibold flex">
        <span className="flex-1">Visitor Metrics</span>
      </h2>
      <div className="md:flex w-full">
        <VisitorMetrics
          label="Countries"
          data={data?.visitorMetrics?.[0]?.topCountries}
        />
        <VisitorMetrics
          label="Referrers"
          data={data?.visitorMetrics?.[0]?.topReferrers}
        />
        <VisitorMetrics
          label="Browsers"
          data={data?.visitorMetrics?.[0]?.topBrowsers}
        />
      </div>
      <div className="md:flex">
        <VisitorMetrics
          label="Operating Systems"
          data={data?.visitorMetrics?.[0]?.topOperatingSystems}
        />
        <VisitorMetrics
          label="Device Types"
          data={data?.visitorMetrics?.[0]?.topDeviceTypes}
        />
      </div>

      <h2 className="bg-gray-100 leading-6 text-base p-2 font-semibold flex">
        <span className="flex-1">
          Active Projects in the previous{" "}
          {period === ActivityStatsPeriod["24Hrs"]
            ? "24 hours"
            : period === ActivityStatsPeriod["7Days"]
            ? "7 days"
            : "30 days"}
          .
        </span>
      </h2>
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
                          parseInt(project.activity.newUploadedBytes || "0")
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
}: {
  label: string;
  data?: { label: string; count: number }[];
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
            <span className="w-36 truncate flex-none">{item.label}</span>
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
  period: ActivityStatsPeriod;
}) {
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

    svg
      .append("path")
      .datum(mapDataRequests)
      .attr("fill", "none")
      .attr("stroke", "rgba(16,124,17,0.4)")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "5,2")
      .attr("d", mapDataRequestsLine);

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
              period === ActivityStatsPeriod["24Hrs"]
                ? d3.utcHour.every(2)
                : period === ActivityStatsPeriod["7Days"]
                ? d3.utcDay.every(1)
                : d3.utcDay.every(3)
            )
          )
          .tickFormat((d) =>
            period === ActivityStatsPeriod["24Hrs"]
              ? new Date(d as number).toLocaleTimeString("en-US", {
                  timeStyle: "short",
                  timeZone: "PST",
                })
              : period === ActivityStatsPeriod["7Days"]
              ? new Date(d as number).toLocaleDateString("en-US", {
                  month: "short",
                  weekday: "short",
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

    // Add a legend to the bottom, identifying the symbols for the two lines.
    const legend = svg
      .append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 10)
      .attr("text-anchor", "end")
      .selectAll("g")
      .data([
        { label: "Visitors", color: "steelblue" },
        { label: "Hosted Layer Requests", color: "rgba(16,124,17, 1)" },
      ])
      .join("g")
      .attr("transform", (d, i) => `translate(${width - 100},${i * 20})`);

    const legendContainer = svg
      .append("g")
      .attr(
        "transform",
        `translate(${width / 2 - 125},${height - margin.bottom + 40})`
      );

    const legendEntry = legendContainer
      .selectAll("g")
      .data([
        { label: "Visitors", color: "steelblue", strokeDasharray: "0" },
        {
          label: "Hosted Layer Requests",
          color: "rgba(16,124,17,0.5)",
          strokeDasharray: "5,2",
        },
      ])
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
              period === ActivityStatsPeriod["30Days"]
                ? [
                    formatDate(data[i].timestamp),
                    data[i].count === 1
                      ? "1 visitor"
                      : `${data[i].count.toLocaleString()} visitors`,
                    mapDataRequests[i].count === 1
                      ? "1 map request"
                      : `${mapDataRequests[
                          i
                        ].count.toLocaleString()} map requests`,
                  ]
                : [
                    formatDate(data[i].timestamp),
                    formatTime(data[i].timestamp),
                    data[i].count === 1
                      ? "1 visitor"
                      : `${data[i].count.toLocaleString()} visitors`,
                    mapDataRequests[i].count === 1
                      ? "1 map request"
                      : `${mapDataRequests[
                          i
                        ].count.toLocaleString()} map requests`,
                  ]
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
  }, [data, mapDataRequests, period, width]);

  return <svg className="w-full" ref={chartRef}></svg>;
}
