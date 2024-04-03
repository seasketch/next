/* eslint-disable i18next/no-literal-string */
import { useDashboardStatsQuery } from "./generated/graphql";
import bytes from "bytes";
import logo from "./header/seasketch-logo.png";
import bgBlur from "./bg-blur.jpg";
import {
  CaretLeftIcon,
  LayersIcon,
  Pencil1Icon,
  PersonIcon,
  TransformIcon,
} from "@radix-ui/react-icons";
import { ReactNode } from "react";
import { ChatIcon } from "@heroicons/react/outline";

export default function Dashboard() {
  const { data, loading, error } = useDashboardStatsQuery();
  if (error) {
    return <div>Error: {error.message}</div>;
  }
  return (
    <div className="w-full xl:max-w-6xl mx-auto md:border bg-white flex flex-col md:h-screen">
      <div className="flex items-center space-x-1 md:space-x-2 p-2 py-3 md:p-4">
        <button>
          <CaretLeftIcon className="h-8 w-8 md:mr-2" />
        </button>
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
          label="Data Uploads"
          value={(data?.dashboardStats?.uploads || 0).toLocaleString()}
        />
        <StatItem
          label="Layers Stored"
          value={bytes(parseInt(data?.dashboardStats?.uploadedBytes || "0"))}
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
      <h2 className="bg-gray-100 leading-6 text-base p-2 font-semibold flex">
        <span className="flex-1">
          Active Projects in the previous 24 hours.
        </span>
        <span className="text-gray-500 italic">Updated every minute.</span>
      </h2>
      <ul>
        {data?.activeProjects?.map((project) => (
          <li key={project.id} className="p-2 border-t flex space-x-2">
            <div className="flex-1 lg:flex-none text-base truncate lg:w-72">
              {project.name}
            </div>
            {/* <div className="flex-1 hidden md:visible">
              {project.numUsers || 0}{" "}
              {project.numUsers === 1 ? "user" : "users"}
              <Increase value={project.activity?.newUsers} />
            </div>
            <div className="flex-1 hidden md:visible">
              {project.numUploads || 0}{" "}
              {project.numUploads === 1 ? "upload" : "uploads"}
              <Increase value={project.activity?.newDataSources} />
            </div>
            <div className="flex-1 hidden md:visible">
              {bytes(parseInt(project.dataHostingQuotaUsed || "0"), {
                decimalPlaces: 0,
              })}
              <Increase
                value={
                  project.activity?.newUploadedBytes
                    ? bytes(
                        parseInt(project.activity?.newUploadedBytes || "0"),
                        { decimalPlaces: 0 }
                      )
                    : null
                }
              />
            </div>
            <div className="flex-1 hidden md:visible">
              {project.numSketches || 0}{" "}
              {project.numSketches === 1 ? "sketch" : "sketches"}
              <Increase value={project.activity?.newSketches} />
            </div>
            <div className="flex-1 hidden md:visible">
              {project.numForumPosts || 0}{" "}
              {project.numForumPosts === 1 ? "post" : "posts"}
              <Increase value={project.activity?.newForumPosts} />
            </div> */}
            <div className="flex-1 space-x-4  flex items-center justify-end">
              <IncreaseSymbol value={project.activity?.newUsers}>
                <PersonIcon />
              </IncreaseSymbol>
              <IncreaseSymbol
                value={
                  project.activity?.newUploadedBytes
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
              <IncreaseSymbol value={project.activity?.newSketches}>
                <TransformIcon />
              </IncreaseSymbol>
              <IncreaseSymbol value={project.activity?.newForumPosts}>
                <ChatIcon className="w-5 h-5" />
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
}: {
  value: number | string | null | undefined;
  children: ReactNode;
  className?: string;
  skipPlus?: boolean;
}) {
  if (!value) {
    return null;
  } else {
    return (
      <span
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

function StatItem({
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
    >
      <div className="flex-1 md:flex-none text-sm font-medium leading-6 text-white truncate">
        {label}
      </div>
      <div className="text-3xl font-bold leading-10">{value}</div>
    </div>
  );
}
