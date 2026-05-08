import React, { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  useProjectSlugExistsQuery,
  useCreateProjectMutation,
  useCreateProjectWithGeographiesMutation,
} from "../generated/graphql";
import useDebounce from "../useDebounce";
import slugify from "slugify";
import { useHistory } from "react-router-dom";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Cross2Icon,
  ExternalLinkIcon,
  QuestionMarkCircledIcon,
} from "@radix-ui/react-icons";
import Switch from "../components/Switch";
import Spinner from "../components/Spinner";
import NewProjectGeographiesModal, {
  buildCreateProjectGeographiesForEEZs,
  buildHighSeasProjectGeography,
  defaultProjectGeographyConfig,
  normalizeProjectGeographyConfig,
  ProjectGeographyConfig,
  ProjectGeographySelection,
} from "./NewProjectGeographiesModal";
import NewProjectPlanningAreaChoiceModal from "./NewProjectPlanningAreaChoiceModal";

type ProjectPlanningState =
  | null
  | { flow: "skip" }
  | { flow: "high_seas" }
  | { flow: "eez"; selection: ProjectGeographySelection | null };

/** Compact chip: same colors as map modal select; height stays within form control row */
const PLANNING_CHIP_CLASS =
  "inline-flex max-w-full items-center rounded-full bg-blue-100 px-2 text-sm font-medium leading-5 text-blue-800";

export default function NewProjectForm() {
  const history = useHistory();
  const { t } = useTranslation("homepage");
  const newProjectGeographyLayerNames = useMemo(
    () => ({
      exclusiveEconomicZone: t("Exclusive Economic Zone"),
      territorialSeas: t("Territorial Seas"),
      offshore: t("Offshore"),
    }),
    [t]
  );
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const debouncedSlug = useDebounce(slug, 200) as string;
  const [createProject] = useCreateProjectMutation({
    refetchQueries: ["SimpleProjectList"],
  });
  const [createProjectWithGeographies] =
    useCreateProjectWithGeographiesMutation({
      refetchQueries: ["SimpleProjectList"],
    });
  const [choiceModalOpen, setChoiceModalOpen] = useState(false);
  const [eezModalOpen, setEezModalOpen] = useState(false);
  const [planningState, setPlanningState] =
    useState<ProjectPlanningState>(null);
  const [isCreating, setIsCreating] = useState(false);

  const openPlanningUi = () => {
    if (
      planningState === null ||
      planningState.flow === "skip" ||
      planningState.flow === "high_seas"
    ) {
      setChoiceModalOpen(true);
    } else {
      setEezModalOpen(true);
    }
  };

  const clearPlanningSelection = () => {
    setPlanningState(null);
    setChoiceModalOpen(false);
    setEezModalOpen(false);
  };

  const updateGeographyConfig = (updates: Partial<ProjectGeographyConfig>) => {
    setPlanningState((prev) => {
      if (prev?.flow !== "eez" || !prev.selection) {
        return prev;
      }
      const config = normalizeProjectGeographyConfig({
        ...prev.selection.config,
        ...updates,
      });
      return {
        ...prev,
        selection: {
          ...prev.selection,
          config,
          geographies: buildCreateProjectGeographiesForEEZs(
            prev.selection.eezChoices,
            config,
            newProjectGeographyLayerNames
          ),
        },
      };
    });
  };
  const { loading, error, data } = useProjectSlugExistsQuery({
    variables: {
      slug: debouncedSlug,
    },
    // After create succeeds, the slug exists — refetches would flash duplicate validation
    // until redirect. Skip while submitting / redirecting.
    skip: isCreating,
  });

  const eezHasSelection =
    planningState?.flow === "eez" &&
    !!planningState.selection &&
    planningState.selection.labels.length > 0;
  const showPlanningChip =
    planningState !== null &&
    (planningState.flow === "skip" ||
      planningState.flow === "high_seas" ||
      eezHasSelection);

  const planningAreaLabel =
    planningState === null ? (
      <Trans ns="homepage">Choose a planning area...</Trans>
    ) : planningState.flow === "skip" ? (
      <Trans ns="homepage">Skipping geography creation</Trans>
    ) : planningState.flow === "high_seas" ? (
      t("High Seas")
    ) : planningState.selection && planningState.selection.labels.length > 0 ? (
      planningState.selection.labels.length === 1 ? (
        planningState.selection.labels[0]
      ) : (
        t("{{count}} planning areas selected", {
          count: planningState.selection.labels.length,
        })
      )
    ) : (
      t("Select countries…")
    );

  const completeProjectCreation = (
    result: {
      errors?: ReadonlyArray<{ message: string }>;
      data?: unknown;
    },
    usedGeographiesMutation: boolean
  ): boolean => {
    if (result.errors?.length) {
      setMutationError(
        result.errors.map((e) => e.message).join(
          // eslint-disable-next-line i18next/no-literal-string
          "; "
        )
      );
      return false;
    }
    const payload = result.data as
      | {
          createProjectWithGeographies?: {
            project?: { slug?: string | null } | null;
          } | null;
          createProject?: {
            project?: { slug?: string | null } | null;
          } | null;
        }
      | null
      | undefined;
    const slugFromPayload = usedGeographiesMutation
      ? payload?.createProjectWithGeographies?.project?.slug
      : payload?.createProject?.project?.slug;
    const slugToUse = slugFromPayload || debouncedSlug;
    if (!slugToUse) {
      setMutationError(t("Could not determine the new project's URL."));
      return false;
    }
    // Do not set mutationError here: redirect uses slugToUse (payload or debounced slug).
    // Showing a warning would flash red text-red-800 briefly before history.push.
    setTimeout(() => {
      // eslint-disable-next-line i18next/no-literal-string -- route path
      history.push(`/${slugToUse}/admin`);
    }, 100);
    return true;
  };

  // Skip can abort the slug query when isCreating becomes true; ignore transient errors then.
  if (error && !isCreating) {
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
                setMutationError(null);
                setIsCreating(true);
                let scheduledRedirect = false;
                if (planningState?.flow === "high_seas") {
                  const result = await createProjectWithGeographies({
                    variables: {
                      input: {
                        name: name,
                        slug: debouncedSlug,
                        geographies: [
                          buildHighSeasProjectGeography(t("High Seas")),
                        ],
                      },
                    },
                  });
                  scheduledRedirect = completeProjectCreation(result, true);
                } else if (
                  planningState?.flow === "eez" &&
                  planningState.selection &&
                  planningState.selection.eezChoices.length > 0
                ) {
                  const geographyConfig = normalizeProjectGeographyConfig(
                    planningState.selection.config ||
                      defaultProjectGeographyConfig()
                  );
                  const geographies = buildCreateProjectGeographiesForEEZs(
                    planningState.selection.eezChoices,
                    geographyConfig,
                    newProjectGeographyLayerNames
                  );
                  const result = await createProjectWithGeographies({
                    variables: {
                      input: {
                        name: name,
                        slug: debouncedSlug,
                        geographies,
                      },
                    },
                  });
                  scheduledRedirect = completeProjectCreation(result, true);
                } else {
                  const result = await createProject({
                    variables: {
                      name: name,
                      slug: debouncedSlug,
                    },
                  });
                  scheduledRedirect = completeProjectCreation(result, false);
                }
                if (!scheduledRedirect) {
                  setIsCreating(false);
                }
              } catch (e) {
                setMutationError(e.toString());
                setIsCreating(false);
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
                autoComplete="off"
                placeholder={t("Project name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isCreating}
                className="block w-full border-gray-300 rounded-md focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                autoComplete="off"
                disabled={isCreating}
                onChange={(e) => setSlug(slugify(e.target.value.toLowerCase()))}
                className={`flex-1 block w-full border-gray-300 rounded-r-md focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  !!data?.projectBySlug && !isCreating ? "bg-red-200" : ""
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
              : isCreating
              ? t("Creating your project…")
              : !!data?.projectBySlug
              ? "This URL is already in use"
              : "Please choose wisely. URLs cannot be changed"}
          </p>

          <div className="sm:col-span-2 -top-5 relative">
            <div className="flex h-10 min-h-10 max-w-lg items-stretch rounded-md border border-gray-300 bg-white shadow-sm focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-200 focus-within:ring-opacity-50 sm:text-sm sm:leading-5">
              <button
                type="button"
                disabled={isCreating}
                className={`flex min-h-0 min-w-0 flex-1 items-center gap-2 pl-3 pr-1 text-left text-sm leading-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-60 ${
                  showPlanningChip ? "" : "text-gray-400"
                }`}
                onClick={openPlanningUi}
              >
                <span className="flex min-w-0 flex-1 items-center">
                  {showPlanningChip ? (
                    <span className={PLANNING_CHIP_CLASS}>
                      <span className="truncate">{planningAreaLabel}</span>
                    </span>
                  ) : (
                    <span className="truncate">{planningAreaLabel}</span>
                  )}
                </span>
              </button>
              {planningState !== null && (
                <button
                  type="button"
                  disabled={isCreating}
                  className="flex shrink-0 items-center justify-center rounded-sm px-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={t("Clear planning area choice")}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearPlanningSelection();
                  }}
                >
                  <Cross2Icon className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
              <button
                type="button"
                disabled={isCreating}
                className={`flex shrink-0 items-center pr-3 pl-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                  showPlanningChip ? "text-blue-700" : "text-gray-400"
                }`}
                aria-label={t("Choose planning area")}
                onClick={openPlanningUi}
              >
                <ExternalLinkIcon className="h-3 w-3" aria-hidden />
              </button>
            </div>
          </div>

          {planningState?.flow === "eez" &&
            planningState.selection &&
            planningState.selection.eezChoices.length > 0 && (
              <div className="sm:col-span-2 -top-7 relative max-w-lg -mb-2 pb-0  bg-white">
                <div className="flex items-start">
                  <span className="text-xs text-gray-700 leading-snug flex-1 inline-flex items-center gap-1">
                    {t("Create offshore and nearshore zones")}
                    <Tooltip.Provider delayDuration={200}>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <button
                            type="button"
                            className="inline-flex shrink-0 rounded-full text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                            aria-label={t("About nearshore and offshore zones")}
                          >
                            <QuestionMarkCircledIcon
                              className="w-3.5 h-3.5"
                              aria-hidden
                            />
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            className="z-[60] max-w-sm rounded-md bg-gray-900 px-3 py-2 text-xs leading-snug text-white shadow-lg"
                            side="top"
                            sideOffset={6}
                          >
                            {t(
                              "Creates a nearshore zone out to 12 nautical miles representing the Territorial Sea and an Offshore Zone beyond. Sketches can then be clipped or reported on based on the Exclusive Economic, Nearshore, or Offshore Zone (or all 3)."
                            )}
                            <Tooltip.Arrow className="fill-gray-900" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  </span>
                  <Switch
                    mini
                    disabled={isCreating}
                    isToggled={
                      planningState.selection.config.territorialSeaHandling ===
                      "split"
                    }
                    onClick={() =>
                      updateGeographyConfig({
                        territorialSeaHandling:
                          planningState.selection!.config
                            .territorialSeaHandling === "split"
                            ? "none"
                            : "split",
                      })
                    }
                  />
                </div>
              </div>
            )}

          <div className="relative bottom-2">
            <span className="block w-full rounded-md shadow-md">
              <button
                type="submit"
                id="create-project-btn"
                disabled={isCreating}
                aria-busy={isCreating}
                className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent text-lg sm:text-base rounded-md text-white bg-primary-500 focus:outline-none focus:shadow-outline-indigo hover:bg-primary-600 transition duration-150 ease-in-out disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-primary-500"
              >
                {isCreating && (
                  <span aria-hidden className="inline-flex">
                    <Spinner color="white" className="!opacity-100" />
                  </span>
                )}
                {isCreating ? t("Creating…") : t("Create your project")}
              </button>
            </span>
          </div>
        </form>
      </div>
      <NewProjectPlanningAreaChoiceModal
        open={choiceModalOpen}
        onRequestClose={() => setChoiceModalOpen(false)}
        onChoose={(flow) => {
          setChoiceModalOpen(false);
          if (flow === "eez") {
            setPlanningState({ flow: "eez", selection: null });
            setEezModalOpen(true);
          } else if (flow === "high_seas") {
            setPlanningState({ flow: "high_seas" });
          } else {
            setPlanningState({ flow: "skip" });
          }
        }}
      />
      <NewProjectGeographiesModal
        open={eezModalOpen}
        onRequestClose={() => setEezModalOpen(false)}
        selection={
          planningState?.flow === "eez" ? planningState.selection : null
        }
        onSelectionChange={(selection) => {
          setPlanningState((prev) => {
            if (prev?.flow !== "eez") {
              return prev;
            }
            if (!selection) {
              return { flow: "eez", selection: null };
            }
            const config = normalizeProjectGeographyConfig(
              selection.config || defaultProjectGeographyConfig()
            );
            return {
              flow: "eez",
              selection: {
                ...selection,
                config,
                geographies: buildCreateProjectGeographiesForEEZs(
                  selection.eezChoices,
                  config,
                  newProjectGeographyLayerNames
                ),
              },
            };
          });
        }}
      />
    </>
  );
}
