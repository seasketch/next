/* eslint-disable i18next/no-literal-string */
import { useDashboardStatsQuery } from "./generated/graphql";
import bytes from "bytes";
import logo from "./header/seasketch-logo.png";
import bgBlur from "./bg-blur.jpg";
import { CaretLeftIcon } from "@radix-ui/react-icons";

export default function Dashboard() {
  const { data, loading, error } = useDashboardStatsQuery();
  if (error) {
    return <div>Error: {error.message}</div>;
  }
  return (
    <div className="w-full xl:max-w-6xl mx-auto border bg-white flex flex-col lg:h-screen">
      <div className="flex items-center space-x-2 p-4">
        <button>
          <CaretLeftIcon className="h-8 w-8 mr-2" />
        </button>
        <img src={logo} alt="SeaSketch Logo" className="h-8" />
        <h1 className="text-lg">SeaSketch Usage Dashboard</h1>
      </div>
      <div
        style={{
          backgroundImage: `url(${bgBlur})`,
          backgroundPosition: "center",
        }}
        className="bg-blue-600 w-full flex p-4 py-8"
      >
        <StatItem
          className="rounded-l"
          label="Projects"
          value={(data?.dashboardStats?.projects || 0).toLocaleString()}
        />
        <StatItem
          label="Registered Users"
          value={(data?.dashboardStats?.users || 0).toLocaleString()}
        />
        <StatItem
          label="Uploaded Layers"
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
          className="rounded-r"
          label="Forum Posts"
          value={(data?.dashboardStats?.forumPosts || 0).toLocaleString()}
        />
      </div>
      {/* <dl>
        <dt>Users</dt>
        <dd>{data?.dashboardStats?.users?.toLocaleString()}</dd>
        <dt>Projects</dt>
        <dd>{data?.dashboardStats?.projects?.toLocaleString()}</dd>
        <dt>Uploads</dt>
        <dd>{data?.dashboardStats?.uploads?.toLocaleString()}</dd>
        <dt>Uploaded Bytes</dt>
        <dd>{bytes(parseInt(data?.dashboardStats?.uploadedBytes || "0"))}</dd>
        <dt>Sketches</dt>
        <dd>{data?.dashboardStats?.sketches?.toLocaleString()}</dd>
        <dt>Forum Posts</dt>
        <dd>{data?.dashboardStats?.forumPosts?.toLocaleString()}</dd>
      </dl> */}
    </div>
  );
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
      className={`flex flex-col p-4 px-6 flex-1 border-white border-opacity-50 border text-white bg-white bg-opacity-5 ${className}`}
    >
      <div className="text-sm font-medium leading-6 text-white">{label}</div>
      <div className="text-3xl font-bold leading-10">{value}</div>
    </div>
  );
}
