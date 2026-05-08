/* eslint-disable i18next/no-literal-string */
import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import Select from "react-select";
import {
  labelForEEZ,
  MARINE_REGIONS_JOIN_COLUMN,
  TERRITORIAL_SEAS_JOIN_COLUMN,
} from "../admin/Geography/CreateGeographyWizard";
import useFeaturePicker from "../admin/Geography/hooks/useFeaturePicker";
import Button from "../components/Button";
import GoogleMapsAttribution, {
  useGoogleMapsViewportCopyright,
} from "../components/GoogleMapsAttribution";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import Warning from "../components/Warning";
import {
  ClippingDataSourceDetailsFragment,
  ClippingLayerDetailsFragment,
  CreateProjectGeographyInput,
  GeographyLayerOperation,
  useGeographyPickerDataQuery,
} from "../generated/graphql";

const GOOGLE_MAPS_TILE_URL =
  "https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}";
const EEZ = "MARINE_REGIONS_EEZ_LAND_JOINED";
const COASTLINE = "DAYLIGHT_COASTLINE";
const TERRITORIAL_SEA = "MARINE_REGIONS_TERRITORIAL_SEA";
const HIGH_SEAS = "MARINE_REGIONS_HIGH_SEAS";

type GeographyTemplateLayer = ClippingLayerDetailsFragment & {
  dataSource: ClippingDataSourceDetailsFragment;
};

export type ProjectGeographyConfig = {
  eraseLand: boolean;
  multipleFeatureHandling: "separate" | "combine";
  territorialSeaHandling: "none" | "single" | "split";
};

export type ProjectGeographyChoice = {
  value: number;
  label: string;
  data: any;
};

export type ProjectGeographySelection = {
  geographies: CreateProjectGeographyInput[];
  labels: string[];
  selectedEEZs: number[];
  eezChoices: ProjectGeographyChoice[];
  config: ProjectGeographyConfig;
};

/** TOC / clipping-layer titles for geographies created only via new-project onboarding */
export type NewProjectGeographyLayerNames = {
  exclusiveEconomicZone: string;
  territorialSeas: string;
  offshore: string;
};

export default function NewProjectGeographiesModal({
  open,
  onRequestClose,
  selection,
  onSelectionChange,
}: {
  open: boolean;
  onRequestClose: () => void;
  selection: ProjectGeographySelection | null;
  onSelectionChange: (selection: ProjectGeographySelection | null) => void;
}) {
  const { t } = useTranslation("homepage");
  const { data, loading, error } = useGeographyPickerDataQuery({
    skip: !open,
  });
  const coastline = data?.geographyClippingLayers?.find(
    (l) => l.dataSource?.dataLibraryTemplateId === COASTLINE
  );
  const eez = data?.geographyClippingLayers?.find(
    (l) => l.dataSource?.dataLibraryTemplateId === EEZ
  );
  const territorialSea = data?.geographyClippingLayers?.find(
    (l) => l.dataSource?.dataLibraryTemplateId === TERRITORIAL_SEA
  );

  return (
    <Modal
      zeroPadding
      open={open}
      autoWidth={false}
      tipyTop
      panelClassName="!max-w-6xl w-[92vw] h-[90vh] overflow-hidden flex"
      bodyClassName="p-0 flex-1 min-h-0"
      onRequestClose={onRequestClose}
      title={
        <div className="text-slate-100">
          <div>{t("Choose a planning area")}</div>
          <div className="text-sm font-normal text-slate-300 mt-1">
            {t(
              "Use the list below to select areas, or click polygons on the map."
            )}
          </div>
        </div>
      }
      dark
    >
      {loading && (
        <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
          <Spinner color="white" large />
        </div>
      )}
      {error && (
        <div className="w-full h-full p-6 bg-white">
          <Warning level="error">{error.message}</Warning>
        </div>
      )}
      {!loading &&
        !error &&
        data?.gmapssatellitesession?.session &&
        eez?.dataSource &&
        eez?.dataSource?.url &&
        eez?.sourceLayer &&
        eez?.vectorObjectKey &&
        coastline?.dataSource &&
        territorialSea?.dataSource && (
          <NewProjectGeographyPicker
            open={open}
            googleMapsSession={data.gmapssatellitesession.session}
            eezLayer={eez as GeographyTemplateLayer}
            initialSelection={selection}
            onRequestClose={onRequestClose}
            onSelectionChange={onSelectionChange}
          />
        )}
      {!loading &&
        !error &&
        (!data?.gmapssatellitesession?.session ||
          !eez?.dataSource?.url ||
          !eez?.sourceLayer ||
          !eez?.vectorObjectKey ||
          !coastline ||
          !territorialSea) && (
          <div className="w-full h-full p-6 bg-white">
            <Warning level="error">
              <Trans ns="homepage">
                SeaSketch could not load the built-in Marine Regions layers.
              </Trans>
            </Warning>
          </div>
        )}
    </Modal>
  );
}

function NewProjectGeographyPicker({
  open,
  googleMapsSession,
  eezLayer,
  initialSelection,
  onRequestClose,
  onSelectionChange,
}: {
  open: boolean;
  googleMapsSession: string;
  eezLayer: GeographyTemplateLayer;
  initialSelection: ProjectGeographySelection | null;
  onRequestClose: () => void;
  onSelectionChange: (selection: ProjectGeographySelection | null) => void;
}) {
  const { t } = useTranslation("homepage");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const googleMapsCopyright = useGoogleMapsViewportCopyright(
    map,
    googleMapsSession
  );

  const featurePicker = useFeaturePicker({
    map,
    sourceId: "project-creation-eez",
    sourceUrl: eezLayer.dataSource.url!,
    sourceLayer: eezLayer.sourceLayer!,
    idProperty: MARINE_REGIONS_JOIN_COLUMN,
    customLabelFn: labelForEEZ,
    initialSelection: initialSelection?.selectedEEZs || [],
    dataset: eezLayer.vectorObjectKey!,
    includeProperties: [
      MARINE_REGIONS_JOIN_COLUMN,
      "UNION",
      "POL_TYPE",
      "SOVEREIGN1",
      "MRGID_SOV1",
    ],
  });

  useEffect(() => {
    if (!open) {
      featurePicker.stopPicking();
      return;
    }
    featurePicker.updateSelection(initialSelection?.selectedEEZs || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || mapInstanceRef.current || !mapRef.current) {
      return;
    }
    const newMap = new mapboxgl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
        sources: {
          satellite: {
            type: "raster",
            tiles: [
              `${GOOGLE_MAPS_TILE_URL}?session=${googleMapsSession}&key=${process.env.REACT_APP_GOOGLE_MAPS_2D_TILE_API_KEY}`,
            ],
            format: "jpeg",
            attribution: "Map data © Google Maps",
            tileSize: 512,
          },
        },
        layers: [
          {
            id: "satellite-layer",
            type: "raster",
            source: "satellite",
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
      center: [0, 15],
      zoom: 2.2,
      attributionControl: false,
      // @ts-ignore
      projection: "globe",
    });
    mapInstanceRef.current = newMap;
    newMap.on("load", () => {
      setMap(newMap);
      newMap.setFog({
        range: [1, 5],
        color: "rgba(255, 255, 255, 0.4)",
        "horizon-blend": 0.1,
        "high-color": "rgba(55, 120, 255, 0.5)",
        "space-color": "rgba(0, 0, 0, 1)",
        "star-intensity": 0.5,
      });
    });
    return () => {
      newMap.remove();
      mapInstanceRef.current = null;
      setMap(null);
    };
  }, [googleMapsSession, open]);

  useEffect(() => {
    if (open && map) {
      featurePicker.startPicking();
      setTimeout(() => map.resize(), 100);
    } else {
      featurePicker.stopPicking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, map, featurePicker.startPicking, featurePicker.stopPicking]);

  const selectedChoices = featurePicker.state.selection
    .map((id) =>
      featurePicker.state.choices.find((choice) => choice.value === id)
    )
    .filter(Boolean) as ProjectGeographyChoice[];

  const onSelectionIdsChange = (selectedIds: number[]) => {
    featurePicker.updateSelection(selectedIds);
    if (selectedIds.length > 0) {
      const lastSelected = featurePicker.state.choices.find(
        (choice) => choice.value === selectedIds[selectedIds.length - 1]
      );
      if (lastSelected?.data.__bbox && map) {
        map.fitBounds(
          [
            [lastSelected.data.__bbox[0], lastSelected.data.__bbox[1]],
            [lastSelected.data.__bbox[2], lastSelected.data.__bbox[3]],
          ],
          { padding: 80, maxZoom: 7 }
        );
      }
    }
  };

  const applySelection = () => {
    if (selectedChoices.length === 0) {
      onSelectionChange(null);
    } else {
      const config = normalizeProjectGeographyConfig({
        ...(initialSelection?.config || defaultProjectGeographyConfig()),
      });
      onSelectionChange({
        geographies: buildCreateProjectGeographiesForEEZs(selectedChoices, config, {
          exclusiveEconomicZone: t("Exclusive Economic Zone"),
          territorialSeas: t("Territorial Seas"),
          offshore: t("Offshore"),
        }),
        labels: selectedChoices.map((choice) => choice.label),
        selectedEEZs: featurePicker.state.selection,
        eezChoices: selectedChoices,
        config,
      });
    }
    onRequestClose();
  };

  return (
    <div className="relative w-full h-full bg-slate-900">
      <div ref={mapRef} className="absolute inset-0" />
      <GoogleMapsAttribution copyright={googleMapsCopyright} />
      <div className="absolute inset-x-0 top-0 p-4 pointer-events-none">
        <div className="max-w-4xl mx-auto bg-gradient-to-b from-gray-50 to-gray-200 rounded-md shadow-xl pointer-events-auto text-left border border-white/70">
          <div className="p-3 flex items-center space-x-2">
            <label className="sr-only">{t("Exclusive Economic Zones")}</label>
            <Select
              filterOption={(option, rawInput) => {
                const input = rawInput.toLowerCase();
                return (
                  option.label.toLowerCase().includes(input) ||
                  option.value.toString().includes(input)
                );
              }}
              isMulti
              menuPortalTarget={document.body}
              menuPosition="absolute"
              menuPlacement="auto"
              styles={selectStyles}
              className="flex-1 min-w-0 react-select"
              isLoading={featurePicker.state.loading}
              options={featurePicker.state.choices}
              value={selectedChoices.map((choice) => ({
                value: choice.value,
                label: choice.label,
              }))}
              onChange={(selected) =>
                onSelectionIdsChange(selected.map((choice) => choice.value))
              }
            />
            <Button
              label={t("Cancel")}
              onClick={onRequestClose}
              buttonClassName="h-[38px]"
            />
            <Button
              primary
              label={t("Submit")}
              onClick={applySelection}
              buttonClassName="h-[38px]"
            />
          </div>
          {featurePicker.state.error && (
            <div className="px-3 pb-3">
              <Warning level="error">
                {featurePicker.state.error.message}
              </Warning>
            </div>
          )}
        </div>
      </div>
      {!map && (
        <div className="absolute inset-0 flex items-center justify-center text-white pointer-events-none">
          <Spinner color="white" large />
        </div>
      )}
    </div>
  );
}

const selectStyles = {
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
  control: (base: any) => ({
    ...base,
    minHeight: 38,
  }),
  valueContainer: (base: any) => ({
    ...base,
    paddingTop: 2,
    paddingBottom: 2,
  }),
  multiValue: (base: any) => ({
    ...base,
    backgroundColor: "rgba(219, 234, 254, 1)",
    color: "rgba(30, 64, 175, 1)",
    borderRadius: 99,
    paddingLeft: 5,
    paddingRight: 5,
  }),
  multiValueRemove: () => ({
    ":hover": { backgroundColor: "transparent" },
  }),
};

export function defaultProjectGeographyConfig(): ProjectGeographyConfig {
  return {
    eraseLand: true,
    multipleFeatureHandling: "combine",
    territorialSeaHandling: "none",
  };
}

/** EEZ-only flow: single combined EEZ geography; land always clipped; seas split or none */
export function normalizeProjectGeographyConfig(
  config: ProjectGeographyConfig
): ProjectGeographyConfig {
  return {
    ...config,
    eraseLand: true,
    multipleFeatureHandling: "combine",
    territorialSeaHandling:
      config.territorialSeaHandling === "split" ? "split" : "none",
  };
}

export function buildHighSeasProjectGeography(
  name: string
): CreateProjectGeographyInput {
  return {
    name,
    clientTemplate: "high_seas",
    clippingLayers: [
      {
        templateId: HIGH_SEAS,
        operationType: GeographyLayerOperation.Intersect,
      },
    ],
  };
}

export function buildCreateProjectGeographiesForEEZs(
  eezChoices: ProjectGeographyChoice[],
  config: ProjectGeographyConfig,
  layerNames: NewProjectGeographyLayerNames
): CreateProjectGeographyInput[] {
  if (eezChoices.length === 0) {
    return [];
  }

  const geographies: CreateProjectGeographyInput[] = [];
  if (config.multipleFeatureHandling === "separate") {
    for (const eez of eezChoices) {
      geographies.push(
        buildCreateProjectGeographyInputForEEZ(
          [eez.value],
          layerNames.exclusiveEconomicZone,
          config.eraseLand
        )
      );
      addTerritorialSeaGeographies(geographies, [eez], config, layerNames);
    }
  } else {
    geographies.push(
      buildCreateProjectGeographyInputForEEZ(
        eezChoices.map((choice) => choice.value),
        layerNames.exclusiveEconomicZone,
        config.eraseLand
      )
    );
    addTerritorialSeaGeographies(geographies, eezChoices, config, layerNames);
  }
  return geographies;
}

function addTerritorialSeaGeographies(
  geographies: CreateProjectGeographyInput[],
  eezChoices: { value: number; label?: string; data: any }[],
  config: ProjectGeographyConfig,
  layerNames: NewProjectGeographyLayerNames
) {
  if (config.territorialSeaHandling === "split") {
    geographies.push(
      buildCreateProjectGeographyInputForTerritorialSeas(
        eezChoices.map((choice) => choice.data[TERRITORIAL_SEAS_JOIN_COLUMN]),
        layerNames.territorialSeas,
        config.eraseLand
      )
    );
    geographies.push(
      buildCreateProjectGeographyInputForOffshore(
        eezChoices,
        layerNames.offshore
      )
    );
  } else if (config.territorialSeaHandling === "single") {
    geographies.push(
      buildCreateProjectGeographyInputForTerritorialSeas(
        eezChoices.map((choice) => choice.data[TERRITORIAL_SEAS_JOIN_COLUMN]),
        layerNames.territorialSeas,
        config.eraseLand
      )
    );
  }
}

function buildCreateProjectGeographyInputForEEZ(
  choices: number[],
  name: string,
  clipToLand: boolean
): CreateProjectGeographyInput {
  return {
    name,
    clientTemplate: "eez",
    clippingLayers: [
      {
        templateId: EEZ,
        operationType: GeographyLayerOperation.Intersect,
        cql2Query: buildCql2(MARINE_REGIONS_JOIN_COLUMN, choices),
      },
      ...(clipToLand
        ? [
            {
              templateId: COASTLINE,
              operationType: GeographyLayerOperation.Difference,
            },
          ]
        : []),
    ],
  };
}

function buildCreateProjectGeographyInputForTerritorialSeas(
  choices: number[],
  name: string,
  clipToLand: boolean
): CreateProjectGeographyInput {
  return {
    name,
    clientTemplate: "territorial_sea",
    clippingLayers: [
      {
        templateId: TERRITORIAL_SEA,
        operationType: GeographyLayerOperation.Intersect,
        cql2Query: buildCql2(TERRITORIAL_SEAS_JOIN_COLUMN, choices),
      },
      ...(clipToLand
        ? [
            {
              templateId: COASTLINE,
              operationType: GeographyLayerOperation.Difference,
            },
          ]
        : []),
    ],
  };
}

function buildCreateProjectGeographyInputForOffshore(
  eezChoices: { value: number; data: any }[],
  name: string
): CreateProjectGeographyInput {
  return {
    name,
    clientTemplate: "eez",
    clippingLayers: [
      {
        templateId: EEZ,
        operationType: GeographyLayerOperation.Intersect,
        cql2Query: buildCql2(
          MARINE_REGIONS_JOIN_COLUMN,
          eezChoices.map((choice) => choice.value)
        ),
      },
      {
        templateId: TERRITORIAL_SEA,
        operationType: GeographyLayerOperation.Difference,
        cql2Query: buildCql2(
          TERRITORIAL_SEAS_JOIN_COLUMN,
          eezChoices.map((choice) => choice.data[TERRITORIAL_SEAS_JOIN_COLUMN])
        ),
      },
    ],
  };
}

function buildCql2(property: string, choices: number[]) {
  return JSON.stringify(
    choices.length === 1
      ? {
          op: "=",
          args: [{ property }, choices[0]],
        }
      : {
          op: "in",
          args: [{ property }, choices],
        }
  );
}
