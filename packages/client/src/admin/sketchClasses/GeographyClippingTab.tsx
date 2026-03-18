import {
  SketchingDetailsFragment,
  useSketchFragmentStatusQuery,
  useSketchClassGeographyEditorDetailsQuery,
} from "../../generated/graphql";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import SketchClassGeographiesInput from "./SketchClassGeographiesInput";
import getSlug from "../../getSlug";
import Warning from "../../components/Warning";
import SketchFragmentStatusModal from "../Geography/SketchFragmentStatusModal";

interface GeographyClippingTabProps {
  sketchClass: SketchingDetailsFragment;
}

export default function GeographyClippingTab({
  sketchClass,
}: GeographyClippingTabProps) {
  const { t } = useTranslation("admin:sketching");
  const slug = getSlug();
  const [showFragmentStatusModal, setShowFragmentStatusModal] = useState(false);

  const { data: geographyData } = useSketchClassGeographyEditorDetailsQuery({
    variables: { slug },
  });

  const { data: fragmentStatusData, loading: fragmentStatusLoading } =
    useSketchFragmentStatusQuery({
      variables: { slug },
      skip: !slug,
    });

  const missingSketchCountForClass = useMemo(() => {
    const counts =
      fragmentStatusData?.projectBySlug?.sketchClassMissingFragmentCounts ?? [];
    const classCount = counts.find(
      (item) => item?.sketchClassId === sketchClass.id
    );
    return classCount?.missingCount ?? 0;
  }, [
    fragmentStatusData?.projectBySlug?.sketchClassMissingFragmentCounts,
    sketchClass.id,
  ]);

  const showMissingFragmentsWarning =
    !fragmentStatusLoading && missingSketchCountForClass > 0;

  const warningText =
    missingSketchCountForClass === 1
      ? t("{{n}} sketch in this class requires clipping.", {
          n: missingSketchCountForClass,
        })
      : t("{{n}} sketches in this class require clipping.", {
          n: missingSketchCountForClass,
        });

  const onCloseFragmentModal = () => {
    setShowFragmentStatusModal(false);
  };

  const onOpenFragmentModal = () => {
    setShowFragmentStatusModal(true);
  };

  const hasGeographies = Boolean(geographyData?.projectBySlug?.geographies);

  const shouldShowStatusModal = showFragmentStatusModal && Boolean(slug);

  const renderFragmentWarning = showMissingFragmentsWarning ? (
    <Warning level="info" className="py-2">
      {warningText}
      <button
        type="button"
        className="ml-1 underline decoration-dotted underline-offset-2"
        onClick={onOpenFragmentModal}
      >
        {t("View details")}
      </button>
    </Warning>
  ) : null;

  const renderFragmentModal = shouldShowStatusModal ? (
    <SketchFragmentStatusModal slug={slug} onRequestClose={onCloseFragmentModal} />
  ) : null;

  const renderGeographiesInput = hasGeographies ? (
    <SketchClassGeographiesInput
      sketchClassId={sketchClass.id}
      projectGeographies={geographyData?.projectBySlug?.geographies ?? []}
    />
  ) : null;

  const renderExplanatoryText = (
    <p className="text-sm text-gray-500">
      {t(
        "Once submitted, sketches will also be unioned with all Geography boundaries in this project so that metrics displayed in Reports can be summed and grouped by Geography."
      )}
    </p>
  );

  const renderDescription = (
    <p className="mt-1 text-sm text-gray-500">
      {t(
        "Choose a geography to associate with this sketch class. Sketches will be clipped to the inside of the geography bounds, while those drawn completely outside the bounds will be rejected. This can be used to remove land from ocean polygons, or aid users in digitizing a plan that follows an administrative boundary, such as the EEZ."
      )}
    </p>
  );

  const renderContent = (
    <div className="space-y-4">
      <div>{renderDescription}</div>
      <div className="relative">{renderGeographiesInput}</div>
      {renderExplanatoryText}
      {renderFragmentWarning}
    </div>
  );

  const renderPanel = (
    <div className="p-4 space-y-6 bg-white max-w-144 shadow border-r min-h-full">
      {renderContent}
      {renderFragmentModal}
    </div>
  );

  return renderPanel;
}
