/* eslint-disable i18next/no-literal-string */
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/outline";
import { useMediaQuery } from "beautiful-react-hooks";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useHistory, useLocation, useRouteMatch } from "react-router-dom";
import Button from "../components/Button";
import Skeleton from "../components/Skeleton";
import { useProjectListingQuery } from "../generated/graphql";
import FeaturedProjectItem from "./FeaturedProjectItem";

const LIST_SIZE = 12;

export default function ProjectsPage() {
  const { t } = useTranslation("frontpage");

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isSmall = useMediaQuery("(max-width: 767px)");

  const first = searchParams.get("first")
    ? parseInt(searchParams.get("first")!)
    : undefined;
  const last = searchParams.get("last")
    ? parseInt(searchParams.get("last")!)
    : undefined;
  const after = searchParams.get("after");
  const before = searchParams.get("before");

  const { data, loading } = useProjectListingQuery({
    fetchPolicy: "cache-and-network",
    returnPartialData: true,
    variables: isSmall
      ? {}
      : first
      ? {
          first,
          after,
        }
      : last
      ? {
          last,
          before,
        }
      : {
          first: LIST_SIZE,
        },
  });

  const { lastCursor, firstCursor } = useMemo(() => {
    if (data?.projects?.edges?.length) {
      return {
        firstCursor: data.projects.edges[0]!.cursor!,
        lastCursor:
          data.projects.edges[data.projects.edges.length - 1]!.cursor!,
      };
    } else {
      return {
        lastCursor: undefined,
        firstCursor: undefined,
      };
    }
  }, [data?.projects?.edges]);

  return (
    <div className="lg:flex w-full max-w-6xl sm:p-4 mx-auto">
      <div className="flex-1 px-2 sm:px-4">
        <h1 className="mt-4 text-xl tracking-tight font-extrabold ">
          Featured Projects
        </h1>
        <div className="">
          {data?.featuredProjects?.nodes && (
            <div>
              {data.featuredProjects.nodes.map((p) => (
                <FeaturedProjectItem key={p.id} project={p} />
              ))}
            </div>
          )}
          {!data?.featuredProjects && loading && (
            <div>
              <div className="bg-white border flex items-center p-2 gap-3 my-2 rounded h-14">
                <Skeleton className="h-5 w-1/2" />
              </div>
              <div className="bg-white border flex items-center p-2 gap-3 my-2 rounded h-14">
                <Skeleton className="h-5 w-3/4" />
              </div>
              <div className="bg-white border flex items-center p-2 gap-3 my-2 rounded h-14">
                <Skeleton className="h-5 w-1/2" />
              </div>
            </div>
          )}
        </div>
        <Button
          id="new-project-btn"
          primary
          href="/new-project"
          label={t("Create a Project")}
        />
      </div>
      <div className="flex-1 px-2 sm:px-4">
        <h1 className="mt-4 text-xl tracking-tight font-extrabold ">
          All Projects
        </h1>
        <div className=" bg-white shadow sm:rounded-md mt-2 w-full lg:w-128">
          <ul>
            {data?.projects &&
              data?.projects!.edges.map(({ node: p }) => (
                <Link
                  className="hover:bg-gray-50"
                  to={`/${p!.slug!}/app`}
                  key={p!.id}
                >
                  <li
                    className="px-4 py-2 border-t border-gray-200 flex flex-col justify-center h-16"
                    style={{ minHeight: 48 }}
                  >
                    {p.isFeatured}
                    <h3 className="text-primary-500 font-bold block">
                      {p?.name}
                    </h3>
                    <p className="truncate text-sm">{p?.description}</p>
                  </li>
                </Link>
              ))}
            {!data?.projects &&
              loading &&
              Array.apply(null, Array(LIST_SIZE)).map((el, i) => (
                <li
                  key={i}
                  className="px-4 border-t border-gray-200 flex items-center h-16"
                >
                  <Skeleton className="w-3/4 h-4" />
                </li>
              ))}
          </ul>
        </div>

        {!isSmall && (
          <div className="mt-2">
            <nav
              className="isolate inline-flex -space-x-px rounded-md shadow-sm"
              aria-label="Pagination"
            >
              <Link
                to={`/projects?last=${LIST_SIZE}&before=${firstCursor}}`}
                className={`${
                  data?.projects?.pageInfo?.hasPreviousPage && firstCursor
                    ? ""
                    : "pointer-events-none opacity-25"
                } relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-20`}
              >
                <span className="sr-only">Previous</span>
                <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link
                to={`/projects?first=${LIST_SIZE}&after=${lastCursor}}`}
                className={`${
                  data?.projects?.pageInfo?.hasNextPage && lastCursor
                    ? ""
                    : "pointer-events-none opacity-25"
                } relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-20`}
              >
                <span className="sr-only">Next</span>
                <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
              </Link>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
