/* eslint-disable i18next/no-literal-string */
import { useDashboardStatsQuery } from "./generated/graphql";
import bytes from "bytes";

export default function Dashboard() {
  const { data, loading, error } = useDashboardStatsQuery();
  if (error) {
    return <div>Error: {error.message}</div>;
  }
  return (
    <div>
      <h1>Dashboard</h1>
      <dl>
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
      </dl>
    </div>
  );
}
