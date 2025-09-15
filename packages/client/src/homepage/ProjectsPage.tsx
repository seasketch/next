/* eslint-disable i18next/no-literal-string */
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/outline";
import { useMediaQuery } from "beautiful-react-hooks";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import Button from "../components/Button";
import Skeleton from "../components/Skeleton";
import { useProjectListingQuery } from "../generated/graphql";
import { useTranslatedProps } from "../components/TranslatedPropControl";
import { Helmet } from "react-helmet";
import ProjectsMap from "./ProjectsMap";
import ProjectSearchBar from "./ProjectSearchBar";
import { caseStudies } from "./caseStudies";

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

  const getTranslatedProp = useTranslatedProps();

  const projects =
    data?.projects?.edges.filter((p) => p?.node?.slug !== "superuser") || [];

  return (
    <div className="bg-slate-800 text-slate-50">
      {/* Hero map section */}
      <section className="relative isolate overflow-hidden">
        <ProjectsMap />
        <div className="absolute inset-x-0 top-8 z-10 flex justify-center pointer-events-none">
          <div className="w-full max-w-xl px-4 pointer-events-auto">
            <ProjectSearchBar />
          </div>
        </div>
        {/* Featured overlay at bottom of map */}
        <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none">
          {(() => {
            const csBySlug = new Map(caseStudies.map((c) => [c.slug, c]));
            const items: Array<{
              key: string;
              name: string;
              description?: string | null;
              slug: string;
              caseStudyPath?: string;
            }> = [];
            const seen = new Set<string>();
            if (data?.featuredProjects?.nodes) {
              for (const p of data.featuredProjects.nodes) {
                if (!p?.slug) continue;
                const cs = csBySlug.get(p.slug);
                items.push({
                  key: String(p.id),
                  name: p.name,
                  description: p.description || (cs ? cs.o : undefined),
                  slug: p.slug,
                  caseStudyPath: cs?.caseStudyPath,
                });
                seen.add(p.slug);
              }
            }
            for (const cs of caseStudies) {
              if (seen.has(cs.slug)) continue;
              items.push({
                key: `cs-${cs.slug}`,
                name: cs.r,
                description: cs.o,
                slug: cs.slug,
                caseStudyPath: cs.caseStudyPath,
              });
            }
            if (items.length === 0 && loading) return null;
            if (items.length === 0) return null;
            return (
              <div className="px-0">
                <div className="flex items-center justify-between mb-2">
                  <h2
                    className="text-lg font-semibold tracking-tight text-slate-100 px-4 sm:px-6 lg:px-8"
                    style={{
                      textShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
                    }}
                  >
                    Featured Projects
                  </h2>
                </div>
                <div className="overflow-x-auto pb-2 px-4 ">
                  <ul className="flex space-x-3 p-1 md:p-2 pointer-events-auto">
                    {items.map((it) => (
                      <li
                        key={it.key}
                        className="flex items-center rounded-xl px-3 py-3 border border-white/10 backdrop-blur-sm bg-white/10 hover:bg-white/15 transition-colors shrink-0 w-72 text-slate-50 space-x-4"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold truncate">{it.name}</h3>
                          {it.description && (
                            <p className="mt-1 text-sm text-slate-200/80 truncate">
                              {it.description}
                            </p>
                          )}
                          <div className="mt-2 flex space-x-4 text-sm">
                            <a
                              className="text-sky-300 hover:underline"
                              href={`/${it.slug}/app`}
                            >
                              Open project →
                            </a>
                            {it.caseStudyPath && (
                              <a
                                className="text-slate-200 hover:underline"
                                href={it.caseStudyPath}
                              >
                                Case study →
                              </a>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })()}
        </div>
      </section>
      <div className="w-full max-w-4xl sm:p-4 mx-auto ">
        <Helmet>
          <title>SeaSketch Projects</title>
          <meta
            name="description"
            content="Find a SeaSketch project in your region."
          />
          <link rel="canonical" href={`https://www.seasketch.org/projects/`} />
        </Helmet>
        <div className="flex-1 px-2 sm:px-4 pt-4">
          <div className="flex items-center">
            <h1 className="text-xl tracking-tight font-extrabold flex-1">
              All Projects
            </h1>
            <div className="px-2 sm:px-4 flex-none">
              <button
                id="new-project-btn"
                onClick={() => {
                  window.location.href = "/new-project";
                }}
                className="outline-none border-none text-primary-300"
              >
                {t("Create a Project")}
              </button>
            </div>
          </div>
          <div className=" bg-white/5 overflow-hidden mt-6">
            <ul className="divide-y divide-slate-200/10">
              {projects.map(({ node: p }) => (
                <li key={p!.id}>
                  <Link
                    to={`/${p!.slug!}/app`}
                    className="flex items-center space-x-3 px-4 py-3 hover:bg-white/5"
                  >
                    {p!.logoUrl && (
                      <img
                        src={p!.logoUrl!}
                        alt=""
                        className="h-8 w-8 rounded object-contain flex-none"
                      />
                    )}
                    <h3 className="text-slate-200 font-semibold truncate">
                      {p?.name}
                    </h3>
                    {(() => {
                      const d = getTranslatedProp("description", p);
                      return d ? (
                        <p className="flex-1 text-sm text-slate-400 text-right truncate">
                          {d}
                        </p>
                      ) : null;
                    })()}
                  </Link>
                </li>
              ))}
              {!data?.projects &&
                loading &&
                Array.from({ length: LIST_SIZE }).map((_, i) => (
                  <li key={i} className="px-4 py-3">
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-8 w-8" />
                      <div className="flex-1">
                        <Skeleton className="w-1/2 h-4" />
                        <Skeleton className="w-3/4 h-3 mt-2" />
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          </div>

          {!isSmall && data?.projects?.pageInfo?.hasNextPage && lastCursor && (
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
    </div>
  );
}
