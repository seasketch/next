import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useProjectSlugExistsQuery,
  useCreateProjectMutation,
} from "../generated/graphql";
import useDebounce from "../useDebounce";
import slugify from "slugify";
import { useHistory } from "react-router-dom";

export default function NewProjectForm() {
  const history = useHistory();
  const { t } = useTranslation("frontpage");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const debouncedSlug = useDebounce(slug, 200) as string;
  const [createProject] = useCreateProjectMutation({
    refetchQueries: ["SimpleProjectList"],
  });

  const { loading, error, data } = useProjectSlugExistsQuery({
    variables: {
      slug: debouncedSlug,
    },
  });

  if (error) {
    return <span>{error.message}</span>;
  }
  return (
    <>
      <div className="mt-6">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (name && debouncedSlug && !loading && !data?.projectBySlug) {
              try {
                const result = await createProject({
                  variables: {
                    name: name,
                    slug: debouncedSlug,
                  },
                });
                if (result.data?.createProject?.project) {
                  const slug = result.data.createProject.project.slug;
                  setTimeout(() => {
                    history.push(`/${slug}/admin`);
                  }, 100);
                }
              } catch (e) {
                setMutationError(e.toString());
              }
            }
          }}
          className="space-y-6"
        >
          <div>
            <label className="sr-only">{t("Project name")}</label>
            <div className="rounded-md shadow-sm">
              <input
                id="name"
                type="text"
                placeholder={t("Project name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="block w-full border-gray-300 rounded-md focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5"
              />
            </div>
          </div>

          <div className="mt-1 sm:mt-0 sm:col-span-2">
            <div className="max-w-lg flex rounded-md shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm font-mono">
                {
                  // eslint-disable-next-line
                }
                {window.location.host}/
              </span>
              <input
                type="text"
                id="slug"
                placeholder="project-url"
                required
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value.toLowerCase()))}
                className={`flex-1 block w-full border-gray-300 rounded-r-md focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 ${
                  !!data?.projectBySlug ? "bg-red-200" : ""
                }`}
              />
            </div>
          </div>

          <p
            className={`text-sm text-gray-500 text-center relative bottom-3 ${
              mutationError ? "text-red-800" : ""
            }`}
          >
            {mutationError
              ? mutationError
              : !!data?.projectBySlug
              ? "This URL is already in use"
              : "Please choose wisely. URLs cannot be changed"}
          </p>

          <div className="relative bottom-2">
            <span className="block w-full rounded-md shadow-md">
              <button
                id="create-project-btn"
                className="w-full flex justify-center py-2 px-4 border border-transparent text-lg sm:text-base rounded-md text-white bg-primary-500 focus:outline-none focus:shadow-outline-indigo hover:bg-primary-600 transition duration-150 ease-in-out"
              >
                {t("Create your project")}
              </button>
            </span>
          </div>
        </form>
      </div>
    </>
  );
}
