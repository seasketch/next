import React from "react";
import { useSimpleProjectListQuery } from "../generated/graphql";
import { Link } from "react-router-dom";
import { Trans } from "react-i18next";

export default function SimpleProjectList() {
  const { data, loading, error } = useSimpleProjectListQuery();
  if (loading)
    return (
      <span>
        <Trans>loading...</Trans>
      </span>
    );
  if (error) return <span>{error.toString()}</span>;
  return (
    <div className="mx-auto bg-white shadow sm:rounded-md sm:my-4 max-w-lg">
      <ul>
        {data!.projectsConnection!.nodes.map((p) => (
          <Link
            className="hover:bg-gray-50"
            to={`/${p!.slug!}/app`}
            key={p!.id}
          >
            <li
              className="px-4 py-2 border-t border-gray-200"
              style={{ minHeight: 48 }}
            >
              <h3 className="text-primary-500 font-bold block">{p?.name}</h3>
              <p className="truncate">{p?.description}</p>
            </li>
          </Link>
        ))}
      </ul>
    </div>
  );
}
