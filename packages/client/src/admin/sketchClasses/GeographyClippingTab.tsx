import {
  SketchingDetailsFragment,
  useSketchClassGeographyEditorDetailsQuery,
} from "../../generated/graphql";
import { useTranslation } from "react-i18next";
import SketchClassGeographiesInput from "./SketchClassGeographiesInput";
import getSlug from "../../getSlug";

interface GeographyClippingTabProps {
  sketchClass: SketchingDetailsFragment;
}

export default function GeographyClippingTab({
  sketchClass,
}: GeographyClippingTabProps) {
  const { t } = useTranslation("admin:sketching");

  const { data: geographyData } = useSketchClassGeographyEditorDetailsQuery({
    variables: { slug: getSlug() },
  });

  return (
    <div className="p-4 space-y-6 bg-white max-w-144 shadow border-r min-h-full">
      <div className="space-y-4">
        <div>
          <p className="mt-1 text-sm text-gray-500">
            {t(
              "Choose a geography to associate with this sketch class. Sketches will be clipped to the inside of the geography bounds, while those drawn completely outside the bounds will be rejected. This can be used to remove land from ocean polygons, or aid users in digitizing a plan that follows an administrative boundary, such as the EEZ."
            )}
          </p>
        </div>
        <div className="relative">
          {geographyData?.projectBySlug?.geographies && (
            <SketchClassGeographiesInput
              sketchClassId={sketchClass.id}
              projectGeographies={geographyData.projectBySlug.geographies ?? []}
            />
          )}
        </div>
        <p className="text-sm text-gray-500">
          {t(
            "Once submitted, sketches will also be unioned with all Geography boundaries in this project so that metrics displayed in Reports can be summed and grouped by Geography."
          )}
        </p>
      </div>
    </div>
  );
}
