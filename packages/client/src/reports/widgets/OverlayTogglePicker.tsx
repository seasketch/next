import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import getSlug from "../../getSlug";
import { useOverlaysForReportLayerTogglesQuery } from "../../generated/graphql";
import { LayerPickerList } from "./LayerPickerDropdown";

type OverlayTogglePickerProps = {
  onSelect: (
    stableId: string,
    title: string,
    helpers?: {
      apply: (item: any) => void;
      closePopover: () => void;
      focusPalette?: () => void;
    }
  ) => void;
  helpers?: {
    apply: (item: any) => void;
    closePopover: () => void;
    focusPalette?: () => void;
  };
  required?: boolean;
  onlyReportingLayers?: boolean;
  hideSearch?: boolean;
};

export function OverlayTogglePicker({
  onSelect,
  helpers,
  required = true,
  onlyReportingLayers = false,
  hideSearch = false,
}: OverlayTogglePickerProps) {
  const { t } = useTranslation("reports");
  const { data } = useOverlaysForReportLayerTogglesQuery({
    variables: { slug: getSlug() },
  });

  const optionsOverride = useMemo(() => {
    const items =
      data?.projectBySlug?.draftTableOfContentsItems?.filter(
        (i): i is NonNullable<typeof i> => !!i?.stableId
      ) || [];
    return items.map((item) => ({
      stableId: item.stableId!,
      title: item.title || t("Unknown layer"),
      tableOfContentsItemId: typeof item.id === "number" ? item.id : undefined,
      reporting: !!item.reportingOutput,
    }));
  }, [data, t]);

  return (
    <LayerPickerList
      required={required}
      onlyReportingLayers={onlyReportingLayers}
      hideSearch={hideSearch}
      optionsOverride={optionsOverride}
      className="w-72"
      onSelect={(val) => {
        console.log("onSelect", val);
        if (!val?.stableId) return;
        onSelect(val.stableId, val.title, helpers);
      }}
    />
  );
}
