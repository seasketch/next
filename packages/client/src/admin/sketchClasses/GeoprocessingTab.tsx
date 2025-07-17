import {
  SketchGeometryType,
  SketchingDetailsFragment,
  useToggleSketchClassGeographyClippingMutation,
  useSketchClassGeographyEditorDetailsQuery,
} from "../../generated/graphql";
import { Trans, useTranslation } from "react-i18next";
import { useCallback } from "react";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import PreprocessorInput from "./PreprocessorInput";
import GeoprocessingClientInput from "./GeoprocessingClientInput";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import SketchClassGeographiesInput from "./SketchClassGeographiesInput";
import getSlug from "../../getSlug";

interface GeoprocessingTabProps {
  sketchClass: SketchingDetailsFragment;
}

export default function GeoprocessingTab({
  sketchClass,
}: GeoprocessingTabProps) {
  const { t } = useTranslation("admin:sketching");
  const onError = useGlobalErrorHandler();
  const [toggleClipping] = useToggleSketchClassGeographyClippingMutation({
    onError,
  });

  const { data: geographyData } = useSketchClassGeographyEditorDetailsQuery({
    variables: { slug: getSlug() },
  });

  const handleLegacyReportingToggle = useCallback(
    (enabled: boolean) => {
      toggleClipping({
        variables: {
          id: sketchClass.id,
          isGeographyClippingEnabled: !enabled,
        },
      });
    },
    [sketchClass.id, toggleClipping]
  );

  const isReportBuilderEnabled =
    geographyData?.projectBySlug?.enableReportBuilder;
  const showLegacySystem = !sketchClass.isGeographyClippingEnabled;

  // Show new system by default while loading
  if (!geographyData) {
    return (
      <div className="p-4 space-y-6">
        <SketchClassGeographiesInput
          sketchClassId={sketchClass.id}
          projectGeographies={[]}
        />
      </div>
    );
  }

  // After loading, show legacy system only if report builder is explicitly disabled
  if (!isReportBuilderEnabled) {
    return (
      <div className="p-4 space-y-4">
        {sketchClass.geometryType !== SketchGeometryType.Collection &&
          sketchClass.geometryType !== SketchGeometryType.ChooseFeature && (
            <PreprocessorInput sketchClass={sketchClass} />
          )}
        <GeoprocessingClientInput sketchClass={sketchClass} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 bg-white max-w-144 shadow border-r min-h-full">
      {!showLegacySystem && geographyData?.projectBySlug?.geographies && (
        <SketchClassGeographiesInput
          sketchClassId={sketchClass.id}
          projectGeographies={geographyData.projectBySlug.geographies ?? []}
        />
      )}

      {showLegacySystem && (
        <>
          {sketchClass.geometryType !== SketchGeometryType.Collection &&
            sketchClass.geometryType !== SketchGeometryType.ChooseFeature && (
              <PreprocessorInput sketchClass={sketchClass} />
            )}
          <GeoprocessingClientInput sketchClass={sketchClass} />
        </>
      )}

      <InputBlock
        input={
          <Switch
            isToggled={showLegacySystem}
            onClick={(enabled) => handleLegacyReportingToggle(enabled)}
          />
        }
        title={t("Enable Legacy Reporting System")}
        description={t(
          "When enabled, uses the traditional preprocessing and geoprocessing services for reporting instead of the new geography-based system."
        )}
      />
    </div>
  );
}
