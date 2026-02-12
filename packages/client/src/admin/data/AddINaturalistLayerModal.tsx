import { Trans, useTranslation } from "react-i18next";
import AddRemoteServiceMapModal from "./AddRemoteServiceMapModal";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Map, Popup } from "mapbox-gl";
import Warning from "../../components/Warning";
import Spinner from "../../components/Spinner";
import INaturalistProjectAutocomplete from "./INaturalistProjectAutocomplete";
import INaturalistTaxonAutocomplete from "./INaturalistTaxonAutocomplete";
import { CaretDownIcon } from "@radix-ui/react-icons";
import { useLocalForage } from "../../useLocalForage";
import INaturalistLegendContent from "../../dataLayers/legends/INaturalistLegendContent";
import INaturalistProjectCallToAction from "./INaturalistProjectCallToAction";
import { DraftTableOfContentsDocument } from "../../generated/graphql";
import * as GeneratedGraphql from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import getSlug from "../../getSlug";
import { MapManagerContext } from "../../dataLayers/MapContextManager";

import {
  DEFAULT_ZOOM_CUTOFF,
  buildInaturalistSourcesAndLayers,
  normalizeInaturalistParams,
} from "../../dataLayers/inaturalist";
import {
  fetchInaturalistUtfgrid,
  renderInaturalistPopup,
} from "../../dataLayers/inaturalistInteractivity";
import INaturalistLayerOptionsForm from "./INaturalistLayerOptionsForm";

interface ProjectResult {
  id: number;
  title: string;
  description?: string;
  icon?: string;
  slug?: string;
}

interface TaxonResult {
  id: number;
  name: string;
  preferred_common_name?: string;
  default_photo?: {
    square_url?: string;
    medium_url?: string;
  };
}

type LayerType =
  | "grid+points"
  | "points"
  | "grid"
  | "heatmap"
  | "heatmap+points";

type INaturalistLayerConfig = {
  projectId: string | null;
  taxonIds: number[];
  d1: string | null;
  d2: string | null;
  verifiable: boolean;
  useCustomColor: boolean;
  color: string | null;
  type: LayerType;
  zoomCutoff: number;
  showCallToAction: boolean;
};

const INATURALIST_LEGEND_STATE_KEY = "inaturalist-legend-collapsed";

export default function AddINaturalistLayerModal({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  // Access generated hook via the compiled module to avoid type/export mismatches
  const useCreateINaturalistTableOfContentsItemMutation = (
    GeneratedGraphql as any
  ).useCreateINaturalistTableOfContentsItemMutation as any;
  const { t } = useTranslation("admin:data");
  const slug = getSlug();
  const [map, setMap] = useState<Map | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number | null>(null);

  const { manager } = useContext(MapManagerContext);
  const onError = useGlobalErrorHandler();
  const [mutation, mutationState] =
    useCreateINaturalistTableOfContentsItemMutation({
      // onError,
      refetchQueries: slug
        ? [
            {
              query: DraftTableOfContentsDocument,
              variables: { slug },
            },
          ]
        : [],
    });

  const [config, setConfig] = useState<INaturalistLayerConfig>({
    projectId: null,
    taxonIds: [],
    d1: null,
    d2: null,
    verifiable: true,
    useCustomColor: false,
    color: null,
    type: "grid+points",
    zoomCutoff: DEFAULT_ZOOM_CUTOFF,
    showCallToAction: false,
  });

  const [selectedProject, setSelectedProject] = useState<ProjectResult | null>(
    null
  );
  const [selectedTaxa, setSelectedTaxa] = useState<TaxonResult[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const currentSourceIds = useRef<string[]>([]);
  const currentLayerIds = useRef<string[]>([]);
  const currentPopupRef = useRef<Popup | null>(null);
  const currentPopupDatasetRef = useRef<"grid" | "points" | null>(null);
  const configRef = useRef<INaturalistLayerConfig>(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Update map layers when configuration changes
  useEffect(() => {
    if (!map) return;

    // Remove all existing layers and sources
    currentLayerIds.current.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    });
    currentSourceIds.current.forEach((sourceId) => {
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    });
    currentSourceIds.current = [];
    currentLayerIds.current = [];

    // Validate that at least project or taxon is selected
    if (!config.projectId && config.taxonIds.length === 0) {
      return;
    }

    const normalizedConfig = normalizeInaturalistParams({
      ...config,
      color: config.useCustomColor ? config.color : null,
    });
    const { sources, layers } = buildInaturalistSourcesAndLayers(
      normalizedConfig,
      {
        sourceIdBase: "inaturalist-layer-source",
        layerIdBase: "inaturalist-layer",
        attribution:
          '<a href="https://www.inaturalist.org" target="_blank" rel="noopener noreferrer">iNaturalist</a>',
      }
    );

    Object.entries(sources).forEach(([id, sourceDef]) => {
      map.addSource(id, sourceDef);
    });
    layers.forEach((layerDef) => {
      map.addLayer(layerDef);
    });

    currentSourceIds.current = Object.keys(sources);
    currentLayerIds.current = layers.map((l) => l.id);
  }, [map, config]);

  // Update config when project/taxa change
  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      projectId:
        selectedProject?.id.toString() || selectedProject?.slug || null,
      taxonIds: selectedTaxa.map((t) => t.id),
    }));
  }, [selectedProject, selectedTaxa]);

  const handleMapLoad = useCallback((loadedMap: Map) => {
    setMap(loadedMap);
    setCurrentZoom(loadedMap.getZoom());
    loadedMap.on("zoomend", () => {
      const zoom = loadedMap.getZoom();
      setCurrentZoom(zoom);
      const cfg = normalizeInaturalistParams(configRef.current);
      if (
        currentPopupRef.current &&
        currentPopupDatasetRef.current === "grid" &&
        (cfg.type === "grid+points" || cfg.type === "heatmap+points") &&
        zoom >= cfg.zoomCutoff
      ) {
        currentPopupRef.current.remove();
        currentPopupRef.current = null;
        currentPopupDatasetRef.current = null;
      }
    });
  }, []);

  // Attach UTFGrid hover/click interaction for grid and point tiles
  useEffect(() => {
    if (!map) {
      return;
    }

    const handleMouseMove = async (
      e: mapboxgl.MapMouseEvent & mapboxgl.EventData
    ) => {
      const result = await fetchInaturalistUtfgrid(
        map,
        normalizeInaturalistParams({
          ...configRef.current,
          color: configRef.current.useCustomColor
            ? configRef.current.color
            : null,
        }),
        e
      );
      if (result) {
        map.getCanvas().style.cursor = "pointer";
      } else {
        map.getCanvas().style.cursor = "";
      }
    };

    const handleClick = async (
      e: mapboxgl.MapMouseEvent & mapboxgl.EventData
    ) => {
      const result = await fetchInaturalistUtfgrid(
        map,
        normalizeInaturalistParams({
          ...configRef.current,
          color: configRef.current.useCustomColor
            ? configRef.current.color
            : null,
        }),
        e
      );
      if (!result) {
        return;
      }

      if (currentPopupRef.current) {
        currentPopupRef.current.remove();
      }

      const popup = await renderInaturalistPopup(map, result);
      currentPopupRef.current = popup;
      currentPopupDatasetRef.current = result.dataset;
    };

    map.on("mousemove", handleMouseMove);
    map.on("click", handleClick);
    return () => {
      map.off("mousemove", handleMouseMove);
      map.off("click", handleClick);
      map.getCanvas().style.cursor = "";
      if (currentPopupRef.current) {
        currentPopupRef.current.remove();
        currentPopupRef.current = null;
        currentPopupDatasetRef.current = null;
      }
    };
  }, [map, t]);

  /* eslint-disable i18next/no-literal-string */
  const handleSave = () => {
    // Validate
    if (!config.projectId && config.taxonIds.length === 0) {
      setValidationError(
        t("Please select at least one project or taxon to continue.")
      );
      return;
    }

    setValidationError(null);
    setSaveError(null);

    // Output configuration object
    const layerConfig = {
      projectId: config.projectId,
      taxonIds: config.taxonIds,
      d1: config.d1,
      d2: config.d2,
      verifiable: config.verifiable,
      color: config.useCustomColor ? config.color : null,
      type: config.type,
      zoomCutoff: config.zoomCutoff,
      showCallToAction: config.showCallToAction,
    };

    // eslint-disable-next-line no-console
    console.log("iNaturalist Layer Configuration:", layerConfig);

    if (!slug) {
      setValidationError(
        t("Project slug is missing. Please reload the page and try again.")
      );
      return;
    }

    // Derive bounds from current map view if available, otherwise fall back to
    // a global extent
    let bounds: number[] | null = null;
    if (map) {
      const b = map.getBounds().toArray();
      bounds = [b[0][0], b[0][1], b[1][0], b[1][1]];
    } else {
      bounds = [-180, -90, 180, 90];
    }

    // Build a human-readable title from project/taxa selections
    const taxonNames = selectedTaxa.map(
      (t) => t.preferred_common_name || t.name
    );
    const firstTaxonName = taxonNames[0];
    // eslint-disable-next-line i18next/no-literal-string
    let titleText = "iNaturalist observations";

    if (selectedProject && firstTaxonName) {
      if (taxonNames.length === 1) {
        // eslint-disable-next-line i18next/no-literal-string
        titleText = `${firstTaxonName} – ${selectedProject.title}`;
      } else {
        // eslint-disable-next-line i18next/no-literal-string
        titleText = `${selectedProject.title} – ${firstTaxonName} + ${
          taxonNames.length - 1
        } more taxa`;
      }
    } else if (selectedProject) {
      // eslint-disable-next-line i18next/no-literal-string
      titleText = selectedProject.title;
    } else if (firstTaxonName) {
      if (taxonNames.length === 1) {
        // eslint-disable-next-line i18next/no-literal-string
        titleText = `${firstTaxonName} observations`;
      } else {
        // eslint-disable-next-line i18next/no-literal-string
        titleText = `${firstTaxonName} and ${taxonNames.length - 1} more taxa`;
      }
    }

    // Build ProseMirror metadata document with links to iNaturalist
    const content: any[] = [];

    content.push({
      type: "paragraph",
      content: [
        {
          type: "text",
          text:
            // eslint-disable-next-line i18next/no-literal-string
            "This layer is generated from an iNaturalist API query. The selections below summarize the project, taxa, and filters used.",
        },
      ],
    });

    let primaryLinkLabel: "project" | "taxon" | null = null;
    let primaryLinkHref: string | null = null;

    if (selectedProject) {
      const projectUrl = `https://www.inaturalist.org/projects/${
        selectedProject.slug || selectedProject.id
      }`;
      primaryLinkLabel = "project";
      primaryLinkHref = projectUrl;

      if (selectedProject.description) {
        content.push({
          type: "paragraph",
          content: [
            {
              type: "text",
              // eslint-disable-next-line i18next/no-literal-string
              text: selectedProject.description,
            },
          ],
        });
      }
    }

    if (selectedTaxa.length > 0) {
      const taxaNodes: any[] = [];
      selectedTaxa.forEach((taxon, index) => {
        const taxonUrl = `https://www.inaturalist.org/taxa/${taxon.id}`;
        const label = taxon.preferred_common_name || taxon.name;
        if (index > 0) {
          taxaNodes.push({
            type: "text",
            text: ", ",
          });
        }
        taxaNodes.push({
          type: "text",
          text: label,
          marks: [
            {
              type: "link",
              attrs: { href: taxonUrl, title: null },
            },
          ],
        });
      });

      if (!primaryLinkHref) {
        const firstTaxon = selectedTaxa[0];
        primaryLinkLabel = "taxon";
        primaryLinkHref = `https://www.inaturalist.org/taxa/${firstTaxon.id}`;
      }

      content.push({
        type: "paragraph",
        content: taxaNodes,
      });
    }

    const paramsSummaryParts: string[] = [];
    if (layerConfig.projectId) {
      // eslint-disable-next-line i18next/no-literal-string
      paramsSummaryParts.push(`project_id=${layerConfig.projectId}`);
    }
    if (layerConfig.taxonIds.length > 0) {
      // eslint-disable-next-line i18next/no-literal-string
      paramsSummaryParts.push(`taxon_id=${layerConfig.taxonIds.join(",")}`);
    }
    if (layerConfig.d1 || layerConfig.d2) {
      paramsSummaryParts.push(
        // eslint-disable-next-line i18next/no-literal-string
        `date_range=${layerConfig.d1 || "…"} to ${layerConfig.d2 || "…"}`
      );
    }
    paramsSummaryParts.push(
      // eslint-disable-next-line i18next/no-literal-string
      `verifiable=${layerConfig.verifiable ? "true" : "false"}`
    );
    if (layerConfig.color) {
      // eslint-disable-next-line i18next/no-literal-string
      paramsSummaryParts.push(`color=${layerConfig.color}`);
    }
    // eslint-disable-next-line i18next/no-literal-string
    paramsSummaryParts.push(`presentation=${layerConfig.type}`);
    if (
      layerConfig.type === "grid+points" ||
      layerConfig.type === "heatmap+points"
    ) {
      // eslint-disable-next-line i18next/no-literal-string
      paramsSummaryParts.push(`zoom_cutoff=${layerConfig.zoomCutoff}`);
    }
    if (layerConfig.showCallToAction) {
      // eslint-disable-next-line i18next/no-literal-string
      paramsSummaryParts.push("show_call_to_action=true");
    }

    if (paramsSummaryParts.length > 0) {
      if (primaryLinkHref) {
        const linkText =
          primaryLinkLabel === "project"
            ? "View this project on iNaturalist.org"
            : "View this taxon on iNaturalist.org";
        content.push({
          type: "paragraph",
          content: [
            {
              type: "text",
              text: linkText,
              marks: [
                {
                  type: "link",
                  attrs: { href: primaryLinkHref, title: null },
                },
              ],
            },
          ],
        });
      }

      content.push({
        type: "paragraph",
        content: [
          {
            type: "text",
            // eslint-disable-next-line i18next/no-literal-string
            text: `Filters: ${paramsSummaryParts.join("; ")}.`,
          },
        ],
      });
    }

    const metadataDoc = {
      type: "doc",
      content,
    };

    mutation({
      variables: {
        slug,
        params: layerConfig,
        bounds,
        title: titleText,
        metadata: metadataDoc,
      },
    })
      .then((response: unknown) => {
        const result: any = response;
        const stableId =
          result.data?.createInaturalistTableOfContentsItem?.tableOfContentsItem
            ?.stableId;
        if (stableId && manager) {
          manager.showTocItems([stableId]);
        }
        onRequestClose();
      })
      .catch((err: unknown) => {
        onError(err as Error);
        setSaveError(
          t(
            "There was a problem saving this iNaturalist layer. Please try again."
          )
        );
      });
  };
  /* eslint-enable i18next/no-literal-string */

  const canSave = config.projectId !== null || config.taxonIds.length > 0;
  const hasProject = config.projectId !== null;

  let visualizationType: "grid" | "points" | "heatmap" = "grid";
  if (
    config.type === "grid" ||
    config.type === "points" ||
    config.type === "heatmap"
  ) {
    visualizationType = config.type;
  } else {
    const zoom = currentZoom ?? config.zoomCutoff;
    if (config.type === "grid+points") {
      visualizationType = zoom < config.zoomCutoff ? "grid" : "points";
    } else if (config.type === "heatmap+points") {
      visualizationType = zoom < config.zoomCutoff ? "heatmap" : "points";
    }
  }

  return (
    <AddRemoteServiceMapModal
      title={t("Add iNaturalist Layer")}
      onRequestClose={onRequestClose}
      onMapLoad={handleMapLoad}
      basemap="google-earth"
      legendContent={<INaturalistLegend type={visualizationType} />}
      bottomCenterContent={
        config.showCallToAction && config.projectId ? (
          <INaturalistProjectCallToAction projectId={config.projectId} />
        ) : undefined
      }
    >
      <div className="flex flex-col h-full">
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <p className="text-sm">
            <Trans ns="admin:data">
              Select at least one project or taxa to create a layer of{" "}
              <a
                className="text-primary-500 hover:underline"
                href="https://www.inaturalist.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                iNaturalist
              </a>{" "}
              observations. Adjust options to update the preview layer on the
              map. Click save when you are ready to add this layer to your
              project's Overlay Layers list.
            </Trans>
          </p>

          {validationError && (
            <Warning level="error">{validationError}</Warning>
          )}
          {saveError && <Warning level="error">{saveError}</Warning>}

          <div className="space-y-4">
            <INaturalistProjectAutocomplete
              value={selectedProject}
              onChange={setSelectedProject}
            />

            <INaturalistTaxonAutocomplete
              value={selectedTaxa}
              onChange={setSelectedTaxa}
            />

            <INaturalistLayerOptionsForm
              value={{ ...config, hasProject }}
              onChange={(partial) =>
                setConfig((prev) => ({ ...prev, ...partial }))
              }
            />
          </div>
        </div>

        <div className="bg-gray-100 p-4 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onRequestClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || mutationState.loading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-500 border border-transparent rounded-md shadow-sm hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="inline-flex items-center space-x-2">
              <span>
                {mutationState.loading
                  ? t("Adding iNaturalist layer…")
                  : t("Add Layer to Project Overlays")}
              </span>
              {mutationState.loading && <Spinner mini color="white" />}
            </span>
          </button>
        </div>
      </div>
    </AddRemoteServiceMapModal>
  );
}

function INaturalistLegend({ type }: { type: "grid" | "points" | "heatmap" }) {
  const [hidden, setHidden] = useLocalForage<boolean>(
    INATURALIST_LEGEND_STATE_KEY,
    true,
    true
  );
  return (
    <div className="rounded w-72 shadow text-xs sm:text-sm flex flex-col overflow-hidden bg-white/95 ring-2 ring-black/10">
      <button
        type="button"
        className="flex items-center w-full px-3 py-2 border-b border-black border-opacity-10 bg-gray-50 font-semibold text-gray-800 text-left"
        onClick={() => {
          setHidden((prev) => !prev);
        }}
      >
        <span className="flex-1">
          <Trans ns="admin:data">Map Legend</Trans>
        </span>
        <CaretDownIcon
          className={`w-4 h-4 transform transition-transform ${
            hidden ? "-rotate-90 text-black" : "rotate-0 text-gray-500"
          }`}
          aria-hidden
        />
      </button>
      {!hidden && (
        <div className="p-3 space-y-4 max-h-[360px] overflow-y-auto bg-white/95">
          <INaturalistLegendContent type={type} />
        </div>
      )}
    </div>
  );
}
