import React from "react";
import { useSimpleProjectListQuery } from "./generated/graphql";

export default () => {
  const { data, loading, error } = useSimpleProjectListQuery();
  if (loading) return <span>loading</span>;
  if (error) return <span>{error.toString()}</span>;
  return (
    <ul>
      {data!.projectsConnection!.nodes.map((p) => (
        <li key={p!.id}>
          <a title={p!.isFeatured.toString()} href={p!.url!}>
            {p!.name}
          </a>
          <p>{p?.description}</p>
        </li>
      ))}
    </ul>
  );
};
