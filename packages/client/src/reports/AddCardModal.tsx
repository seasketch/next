import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../components/Modal";
import { getAvailableCardTypes, getCardRegistration } from "./registerCard";
import { ReportConfiguration, ReportCardType } from "./cards/cards";
import { CheckIcon, SearchIcon } from "@heroicons/react/solid";
import { CheckIcon as RadixCheckIcon } from "@radix-ui/react-icons";
import AttributeSelect from "../admin/data/styleEditor/AttributeSelect";
import { GeostatsLayer, isGeostatsLayer } from "@seasketch/geostats-types";
import { categoricalAttributes } from "../admin/data/styleEditor/visualizationTypes";
import * as RadixCheckbox from "@radix-ui/react-checkbox";
import Badge from "../components/Badge";
import { useParams } from "react-router-dom";
import {
  DataSourceTypes,
  ReportingLayerDetailsFragment,
  TableOfContentsItem,
  useAvailableReportLayersQuery,
} from "../generated/graphql";

type LayerSelection = {
  layer: ReportingLayerDetailsFragment;
  parameters: any;
};

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (cardType: string, layers: LayerSelection[]) => void;
  report?: ReportConfiguration;
}

// Helper function to create a ReportingLayerDetailsFragment from a TableOfContentsItem
function createReportLayer(
  layer: TableOfContentsItem
): ReportingLayerDetailsFragment {
  return {
    __typename: "ReportCardLayer",
    tableOfContentsItemId: layer.id!,
    layerParameters: {},
    tableOfContentsItem: {
      __typename: "TableOfContentsItem",
      id: layer.id!,
      title: layer.title,
      dataSourceType: layer.dataSourceType,
    },
  } as any;
}

// Helper function to create a LayerSelection from a layer
function createLayerSelection(layer: TableOfContentsItem): LayerSelection {
  return {
    layer: createReportLayer(layer),
    parameters: {},
  };
}

export function AddCardModal({
  isOpen,
  onClose,
  onSelect,
  report,
}: AddCardModalProps) {
  const { t } = useTranslation("admin:sketching");

  const availableCardTypes = getAvailableCardTypes();

  const [modalState, setModalState] = useState({
    step: "chooseType" as "chooseType" | "chooseLayers",
    selectedType: null as string | null,
    selectedLayers: [] as LayerSelection[],
  });

  const registration = useMemo(() => {
    return modalState.selectedType
      ? getCardRegistration(modalState.selectedType as any)
      : null;
  }, [modalState.selectedType]);

  // Always start on type selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setModalState({
        step: "chooseType",
        selectedType: null,
        selectedLayers: [],
      });
    }
  }, [isOpen]);

  // Get all card types currently in use across all tabs
  const usedCardTypes = useMemo(() => {
    const used = new Set<string>();
    report?.tabs?.forEach((tab) => {
      tab.cards?.forEach((card) => {
        used.add(card.type);
      });
    });
    return used;
  }, [report]);

  const handleCardTypeSelect = useCallback(
    (cardType: string) => {
      const reg = getCardRegistration(cardType as ReportCardType);
      if (reg && reg.minimumReportingLayerCount > 0) {
        setModalState((prev) => ({
          ...prev,
          selectedType: cardType,
          step: "chooseLayers",
        }));
      } else {
        onSelect(cardType, []);
        onClose();
      }
    },
    [onSelect, onClose]
  );

  const handleBack = useCallback(() => {
    setModalState({
      step: "chooseType",
      selectedType: null,
      selectedLayers: [],
    });
  }, []);

  const handleAdd = useCallback(() => {
    if (!modalState.selectedType) return;
    onSelect(modalState.selectedType, modalState.selectedLayers);
    onClose();
  }, [modalState.selectedType, modalState.selectedLayers, onSelect, onClose]);

  const canAdd = useMemo(() => {
    if (!registration) return false;
    const min = registration.minimumReportingLayerCount || 0;
    const max = registration.maximumReportingLayerCount;
    const count = modalState.selectedLayers.length;
    if (count < min) return false;
    if (typeof max === "number" && count > max) return false;

    // Check required layer parameters
    const requiredParams = (registration as any).requiredLayerParameters || [];
    if (requiredParams.length > 0) {
      const allLayersHaveRequiredParams = modalState.selectedLayers.every(
        (layer) => {
          return requiredParams.every(
            (paramName: string) => layer.parameters?.[paramName]
          );
        }
      );
      if (!allLayersHaveRequiredParams) return false;
    }

    return true;
  }, [registration, modalState.selectedLayers]);

  const footerButtons = useMemo(() => {
    if (modalState.step === "chooseType") {
      return [
        {
          label: t("Cancel"),
          onClick: onClose,
          variant: "secondary" as const,
        },
      ];
    }
    return [
      {
        label: t("Back"),
        onClick: handleBack,
        variant: "secondary" as const,
      },
      {
        label: t("Add"),
        variant: "primary" as const,
        onClick: handleAdd,
        disabled: !canAdd,
      },
    ];
  }, [modalState.step, canAdd, t, onClose, handleBack, handleAdd]);

  return (
    <Modal
      open={isOpen}
      onRequestClose={onClose}
      title={t("Add a Card")}
      autoWidth
      disableBackdropClick={true}
      footerClassName="border-t"
      zeroPadding={true}
      footer={footerButtons}
    >
      <div className="w-128">
        {modalState.step === "chooseType" ? (
          <CardTypeSelectionStep
            availableCardTypes={availableCardTypes}
            usedCardTypes={usedCardTypes}
            onSelect={handleCardTypeSelect}
          />
        ) : (
          <LayerSelectionStep
            registration={registration}
            selectedLayers={modalState.selectedLayers}
            setSelectedLayers={(value) =>
              setModalState((prev) => ({
                ...prev,
                selectedLayers:
                  typeof value === "function"
                    ? value(prev.selectedLayers)
                    : value,
              }))
            }
          />
        )}
      </div>
    </Modal>
  );
}

function getCategoricalAttributesForLayer(layer: TableOfContentsItem) {
  const meta = layer?.dataLayer?.dataSource?.geostats;
  const layers: GeostatsLayer[] | undefined =
    meta && isGeostatsLayer(meta)
      ? [meta as GeostatsLayer]
      : Array.isArray(meta?.layers) && meta.layers.length
      ? (meta.layers as GeostatsLayer[])
      : undefined;

  if (!layers || layers.length === 0) return [];
  const first = layers[0];
  return categoricalAttributes(first.attributes as any);
}

function getNumericAttributesForLayer(layer: TableOfContentsItem) {
  const meta = layer?.dataLayer?.dataSource?.geostats;
  const layers: GeostatsLayer[] | undefined =
    meta && isGeostatsLayer(meta)
      ? [meta as GeostatsLayer]
      : Array.isArray(meta?.layers) && meta.layers.length
      ? (meta.layers as GeostatsLayer[])
      : undefined;

  if (!layers || layers.length === 0) return [];
  const first = layers[0];
  return (first.attributes || []).filter((a: any) => a.type === "number");
}

interface LayerItemProps {
  layer: TableOfContentsItem;
  checked: boolean;
  disabled: boolean;
  selected: LayerSelection | undefined;
  onToggle: () => void;
  onGroupByChange: (value: any) => void;
  onValueColumnChange?: (value: any) => void;
  cardType?: string | null;
}

function LayerItem({
  layer,
  checked,
  disabled,
  selected,
  onToggle,
  onGroupByChange,
  onValueColumnChange,
  cardType,
}: LayerItemProps) {
  const { t } = useTranslation("admin:sketching");
  const registration = cardType
    ? getCardRegistration(cardType as ReportCardType)
    : null;
  const requiresValueColumn =
    (registration as any)?.requiredLayerParameters?.includes("valueColumn") ??
    false;
  const numericAttributes = requiresValueColumn
    ? getNumericAttributesForLayer(layer)
    : [];

  return (
    <div
      role="button"
      className={`flex flex-col rounded px-3 py-2 cursor-pointer border relative ${
        checked ? "bg-blue-50 border-blue-500" : "bg-white border-transparent"
      } ${disabled ? "opacity-60" : ""}`}
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) {
          onToggle();
        }
      }}
    >
      <div className="flex items-center space-x-3">
        <RadixCheckbox.Root
          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400 ${
            checked ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300"
          }`}
          checked={checked}
          disabled={disabled}
          aria-label={layer.title || t("Untitled layer")}
          onCheckedChange={(val) => {
            if (!disabled && (val === true) !== checked) {
              onToggle();
            }
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <RadixCheckbox.Indicator asChild>
            <RadixCheckIcon
              className={`w-3 h-3 ${
                checked ? "text-white" : "text-transparent"
              }`}
            />
          </RadixCheckbox.Indicator>
        </RadixCheckbox.Root>
        <div className="flex-1 truncate">
          <div
            className={`text-sm ${checked ? "text-blue-900" : "text-gray-800"}`}
          >
            {layer.title || t("Untitled layer")}
          </div>
        </div>
      </div>
      {checked && (
        <div className="mt-2 space-y-2 pl-7">
          {requiresValueColumn && onValueColumnChange && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-blue-600 font-medium">
                {t("Column to analyze")} *
              </span>
              <AttributeSelect
                appearance="light"
                attributes={numericAttributes}
                includeNone={false}
                placeholder={t("Select a numeric column")}
                placeholderDescription={t(
                  "Choose which numeric column to calculate statistics for"
                )}
                value={selected?.parameters?.valueColumn}
                onChange={onValueColumnChange}
              />
            </div>
          )}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-blue-600">{t("Group by")}</span>
            <AttributeSelect
              appearance="light"
              attributes={getCategoricalAttributesForLayer(layer)}
              includeNone={true}
              placeholder={t("None")}
              placeholderDescription={t("Analyze all features as a group")}
              value={selected?.parameters?.groupBy}
              onChange={onGroupByChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface CardTypeSelectionStepProps {
  availableCardTypes: string[];
  usedCardTypes: Set<string>;
  onSelect: (cardType: string) => void;
}

function CardTypeSelectionStep({
  availableCardTypes,
  usedCardTypes,
  onSelect,
}: CardTypeSelectionStepProps) {
  const { t } = useTranslation("admin:sketching");

  if (availableCardTypes.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-4">
          <svg
            className="w-12 h-12 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-gray-500">{t("No card types available.")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 flex flex-col">
      <p className="text-sm text-gray-500 flex-none px-6">
        {t("Choose a card type to add to the current tab.")}
      </p>
      <div className="grid grid-cols-1 gap-3 bg-gray-100 p-4 flex-1 border-t">
        {availableCardTypes.map((cardType) => {
          const registration = getCardRegistration(cardType as ReportCardType);
          if (!registration) return null;
          const IconComponent = registration.icon;
          const isAlreadyUsed = usedCardTypes.has(cardType);
          return (
            <div
              key={cardType}
              role="button"
              className="bg-white rounded-lg p-4 hover:outline outline-blue-500 cursor-pointer transition-colors duration-150 relative"
              onClick={() => onSelect(cardType)}
            >
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-8 h-8 rounded overflow-hidden">
                  <IconComponent
                    componentSettings={registration.defaultSettings}
                    sketchClass={null}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <div className="text-base font-medium text-gray-800 flex-1">
                      {registration.label}
                    </div>
                    {isAlreadyUsed && (
                      <Badge variant="secondary" className="space-x-1">
                        <span>{t("Added")}</span>
                        <CheckIcon className="w-3 h-3" />
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {registration.description}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface LayerSelectionStepProps {
  registration: ReturnType<typeof getCardRegistration> | null;
  selectedLayers: LayerSelection[];
  setSelectedLayers: React.Dispatch<React.SetStateAction<LayerSelection[]>>;
}

function LayerSelectionStep({
  registration,
  selectedLayers,
  setSelectedLayers,
}: LayerSelectionStepProps) {
  const { t } = useTranslation("admin:sketching");
  const { slug } = useParams<{ slug: string }>();
  const { data, loading } = useAvailableReportLayersQuery({
    variables: { slug },
    fetchPolicy: "cache-and-network",
  });
  const [search, setSearch] = useState("");

  const maxLayers = registration?.maximumReportingLayerCount;
  const isMaxed =
    typeof maxLayers === "number" && selectedLayers.length >= maxLayers;

  // Filter and search layers
  const filteredLayers = useMemo(() => {
    const allLayers = data?.projectBySlug?.availableReportLayers || [];
    const supported = (registration?.supportedReportingLayerTypes ||
      []) as DataSourceTypes[];

    return allLayers
      .filter((l) =>
        supported.length > 0
          ? l.dataSourceType && supported.includes(l.dataSourceType)
          : true
      )
      .filter((l) =>
        (l.title || "").toLowerCase().includes(search.toLowerCase())
      );
  }, [data, registration, search]);

  // Helper function to toggle layer selection
  const toggleLayerSelection = (layer: TableOfContentsItem) => {
    const layerId = layer.id!;
    const isSelected = selectedLayers.some(
      (s) => s.layer.tableOfContentsItemId === layerId
    );

    if (!isSelected && isMaxed) {
      return; // Can't add more layers
    }

    setSelectedLayers((prev) => {
      if (isSelected) {
        // Remove layer
        return prev.filter((s) => s.layer.tableOfContentsItemId !== layerId);
      } else {
        // Add layer
        const newSelection = createLayerSelection(layer);
        if (typeof maxLayers === "number" && maxLayers === 1) {
          return [newSelection];
        }
        return [...prev, newSelection];
      }
    });
  };

  return (
    <div className="flex flex-col">
      <div className="px-6 pt-4 pb-2">
        <div className="text-sm text-gray-700 font-medium">
          {registration?.label}
        </div>
        <div className="text-xs text-gray-500">
          {(registration?.maximumReportingLayerCount || Infinity) > 1
            ? t("Select one or more layers to analyze in this card.")
            : t("Select a layer to analyze in this card.")}
        </div>
      </div>
      <div className="px-6 pb-2">
        <div className="relative">
          <input
            type="text"
            className="w-full border rounded pl-9 pr-3 py-2 text-sm"
            placeholder={t("Search layers by name")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </div>
      </div>
      <div
        className="bg-gray-100 border-t px-4 py-2 overflow-y-auto h-96"
        style={{ maxHeight: 340 }}
      >
        {loading && !data?.projectBySlug?.availableReportLayers ? (
          <div className="text-sm text-gray-500 px-2 py-4">
            {t("Loading layers...")}
          </div>
        ) : filteredLayers.length === 0 ? (
          <div className="text-sm text-gray-500 px-2 py-4">
            {search
              ? t("No layers match your search.")
              : t("No compatible layers available.")}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLayers.map((layer) => {
              const layerId = layer.id!;
              const selected = selectedLayers.find(
                (s) => s.layer.tableOfContentsItemId === layerId
              );
              const checked = !!selected;
              const disableCheck = !checked && isMaxed;

              return (
                <LayerItem
                  key={layerId}
                  layer={layer as TableOfContentsItem}
                  checked={checked}
                  disabled={disableCheck}
                  selected={selected}
                  cardType={registration?.type || null}
                  onToggle={() =>
                    toggleLayerSelection(layer as TableOfContentsItem)
                  }
                  onGroupByChange={(value) =>
                    setSelectedLayers((prev) =>
                      prev.map((s) =>
                        s.layer.tableOfContentsItemId === layerId
                          ? {
                              ...s,
                              parameters: {
                                ...s.parameters,
                                groupBy: value,
                              },
                            }
                          : s
                      )
                    )
                  }
                  onValueColumnChange={(value) =>
                    setSelectedLayers((prev) =>
                      prev.map((s) =>
                        s.layer.tableOfContentsItemId === layerId
                          ? {
                              ...s,
                              parameters: {
                                ...s.parameters,
                                valueColumn: value,
                              },
                            }
                          : s
                      )
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
