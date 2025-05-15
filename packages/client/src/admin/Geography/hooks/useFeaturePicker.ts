import { useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import useFeatureChoices from "./useFeatureChoices";

export type FeaturePickerOptions = {
  map: mapboxgl.Map | null;
  sourceId: string;
  sourceUrl: string;
  sourceLayer: string;
  idProperty: string;
  labelProperty?: string;
  customLabelFn?: (properties: any) => string;
  initialSelection?: number[];
  dataset?: string;
  includeProperties: string[];
};

export type FeaturePickerState = {
  active: boolean;
  selection: number[];
  saving: boolean;
  error?: Error;
  loading: boolean;
  choices: { label: string; value: number; data: any }[];
};

export default function useFeaturePicker(options: FeaturePickerOptions) {
  const [state, setState] = useState<FeaturePickerState>({
    active: false,
    selection: options.initialSelection || [],
    saving: false,
    loading: true,
    choices: [],
  });

  const featureChoices = useFeatureChoices({
    idProperty: options.idProperty,
    labelProperty: options.labelProperty,
    customLabelFn: options.customLabelFn,
    includeProperties: options.includeProperties,
    dataset: options.dataset,
  });

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      loading: featureChoices.loading,
      error: featureChoices.error,
      choices: featureChoices.choices,
    }));
  }, [featureChoices.loading, featureChoices.error, featureChoices.choices]);

  useEffect(() => {
    if (!options.map || !state.active) return;

    // Add source if it doesn't exist
    if (!options.map.getSource(options.sourceId)) {
      options.map.addSource(options.sourceId, {
        type: "vector",
        url: options.sourceUrl + ".json",
      });
    }

    // Add fill layer
    // eslint-disable-next-line i18next/no-literal-string
    const fillLayerId = `${options.sourceId}-fill`;
    if (!options.map.getLayer(fillLayerId)) {
      options.map.addLayer({
        id: fillLayerId,
        type: "fill",
        source: options.sourceId,
        "source-layer": options.sourceLayer,
        paint: {
          "fill-opacity": 0.2,
          "fill-color": [
            "case",
            ["in", ["get", options.idProperty], ["literal", state.selection]],
            "yellow",
            "#007cbf",
          ],
        },
      });
    }

    // Add line layer
    // eslint-disable-next-line i18next/no-literal-string
    const lineLayerId = `${options.sourceId}-line`;
    if (!options.map.getLayer(lineLayerId)) {
      options.map.addLayer({
        id: lineLayerId,
        type: "line",
        source: options.sourceId,
        "source-layer": options.sourceLayer,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-opacity": 0.5,
          "line-color": [
            "case",
            ["in", ["get", options.idProperty], ["literal", state.selection]],
            "#ffc107",
            "grey",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            2,
            1,
          ],
        },
      });
    }

    // Setup tooltip
    const tooltip = document.createElement("div");
    tooltip.className =
      "absolute bg-white border border-gray-300 rounded-md p-1 text-sm bg-opacity-80 shadow-lg -left-12 -top-12";
    document.body.appendChild(tooltip);

    let hoveredFeatureId: number | null = null;

    const handleMouseMove = (
      e: mapboxgl.MapMouseEvent & mapboxgl.EventData
    ) => {
      const feature = e.features?.[0];
      if (feature && feature.properties) {
        const label = options.customLabelFn
          ? options.customLabelFn(feature.properties)
          : feature.properties[options.labelProperty || options.idProperty];

        tooltip.innerHTML = label;

        const mapContainer = options.map!.getContainer();
        const rect = mapContainer.getBoundingClientRect();
        // eslint-disable-next-line i18next/no-literal-string
        tooltip.style.left = `${rect.left + e.point.x + 16}px`;
        // eslint-disable-next-line i18next/no-literal-string
        tooltip.style.top = `${rect.top + e.point.y + 16}px`;
        tooltip.style.display = "block";

        // eslint-disable-next-line i18next/no-literal-string
        options.map!.getCanvas().style.cursor = "pointer";

        if (hoveredFeatureId !== null) {
          options.map!.setFeatureState(
            {
              source: options.sourceId,
              sourceLayer: options.sourceLayer,
              id: hoveredFeatureId,
            },
            { hover: false }
          );
        }
        hoveredFeatureId = feature.id as number;
        options.map!.setFeatureState(
          {
            source: options.sourceId,
            sourceLayer: options.sourceLayer,
            id: hoveredFeatureId,
          },
          { hover: true }
        );
      }
    };

    const handleMouseLeave = () => {
      tooltip.style.display = "none";
      options.map!.getCanvas().style.cursor = "";

      if (hoveredFeatureId !== null) {
        options.map!.setFeatureState(
          {
            source: options.sourceId,
            sourceLayer: options.sourceLayer,
            id: hoveredFeatureId,
          },
          { hover: false }
        );
        hoveredFeatureId = null;
      }
    };

    const handleClick = (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
      const feature = e.features?.[0];
      if (feature && feature.properties) {
        const featureId = feature.properties[options.idProperty];
        setState((prev) => {
          const isSelected = prev.selection.includes(featureId);
          return {
            ...prev,
            selection: isSelected
              ? prev.selection.filter((id) => id !== featureId)
              : [...prev.selection, featureId],
          };
        });
      }
    };

    options.map.on("mousemove", fillLayerId, handleMouseMove);
    options.map.on("mouseleave", fillLayerId, handleMouseLeave);
    options.map.on("click", fillLayerId, handleClick);

    return () => {
      options.map!.off("mousemove", fillLayerId, handleMouseMove);
      options.map!.off("mouseleave", fillLayerId, handleMouseLeave);
      options.map!.off("click", fillLayerId, handleClick);

      if (options.map!.getLayer(fillLayerId)) {
        options.map!.removeLayer(fillLayerId);
      }
      if (options.map!.getLayer(lineLayerId)) {
        options.map!.removeLayer(lineLayerId);
      }

      tooltip.remove();
    };
  }, [
    options.map,
    state.active,
    state.selection,
    options.sourceId,
    options.sourceLayer,
    options.idProperty,
  ]);

  const startPicking = () => {
    setState((prev) => ({ ...prev, active: true }));
  };

  const stopPicking = () => {
    setState((prev) => ({ ...prev, active: false }));
  };

  const updateSelection = (selectedIds: number[]) => {
    setState((prev) => ({ ...prev, selection: selectedIds }));
  };

  const getSelectedFeatures = () => {
    return state.selection.map((id) => {
      return {
        label: state.choices.find((c) => c.value === id)?.label,
        value: id,
        data: state.choices.find((c) => c.value === id)?.data,
      };
    });
  };

  return {
    state,
    startPicking,
    stopPicking,
    updateSelection,
    getSelectedFeatures,
  };
}
