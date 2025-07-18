import {
  SketchGeometryType,
  SketchingDetailsFragment,
} from "../../generated/graphql";
import { useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import PreprocessorInput from "./PreprocessorInput";
import GeoprocessingClientInput from "./GeoprocessingClientInput";

interface GeoprocessingTabProps {
  sketchClass: SketchingDetailsFragment;
}

export default function GeoprocessingTab({
  sketchClass,
}: GeoprocessingTabProps) {
  const { t } = useTranslation("admin:sketching");
  const onError = useGlobalErrorHandler();
  return (
    <div className="p-4 space-y-6 bg-white max-w-144 shadow border-r min-h-full">
      {sketchClass.geometryType !== SketchGeometryType.Collection &&
        sketchClass.geometryType !== SketchGeometryType.ChooseFeature && (
          <PreprocessorInput sketchClass={sketchClass} />
        )}
      <GeoprocessingClientInput sketchClass={sketchClass} />
    </div>
  );
}
