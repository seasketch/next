import {
  SketchingDetailsFragment,
  useSketchFragmentStatusQuery,
  useSketchClassGeographyEditorDetailsQuery,
} from "../../generated/graphql";
import { Trans, useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import SketchClassGeographiesInput from "./SketchClassGeographiesInput";
import getSlug from "../../getSlug";
import Warning from "../../components/Warning";
import GeographyRequiredForReportsPrompt from "../../components/GeographyRequiredForReportsPrompt";
import SketchFragmentStatusModal from "../Geography/SketchFragmentStatusModal";

export default function GeographyClippingTab({
  sketchClass,
}: {
  sketchClass: SketchingDetailsFragment;
}) {
  const { t } = useTranslation("admin:sketching");
  const slug = getSlug();
  const [showFragmentStatusModal, setShowFragmentStatusModal] = useState(false);

  const { data: geographyData, loading: geographyLoading } =
    useSketchClassGeographyEditorDetailsQuery({
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

  const projectGeographyCount =
    geographyData?.projectBySlug?.geographies?.length ?? 0;
  const hasProjectGeographies = projectGeographyCount > 0;

  const showMissingFragmentsWarning =
    !fragmentStatusLoading &&
    missingSketchCountForClass > 0 &&
    hasProjectGeographies;

  const warningText =
    missingSketchCountForClass === 1
      ? t("{{n}} sketch in this class requires clipping.", {
          n: missingSketchCountForClass,
        })
      : t("{{n}} sketches in this class require clipping.", {
          n: missingSketchCountForClass,
        });

  const shouldShowStatusModal = showFragmentStatusModal && Boolean(slug);

  return (
    <div className="space-y-4">
      <p className="mt-1 text-sm text-gray-500">
        {t(
          "Sketches will be clipped to the geography you choose. For example, you can clip polygons to an EEZ, removing land."
        )}
      </p>
      <div className="relative">
        {!geographyLoading && !hasProjectGeographies && slug ? (
          <div className="max-w-xl w-full">
            <GeographyRequiredForReportsPrompt
              // eslint-disable-next-line i18next/no-literal-string -- admin route
              to={`/${slug}/admin/geography`}
            >
              <Trans ns="admin:sketching">
                At least one geography is required to assign clipping rules and
                configure analytical reports.
                <br />
                <span className="font-medium text-primary-700">
                  View Geography administration
                </span>
                .
              </Trans>
            </GeographyRequiredForReportsPrompt>
          </div>
        ) : null}
        {!geographyLoading && hasProjectGeographies ? (
          <SketchClassGeographiesInput
            sketchClassId={sketchClass.id}
            projectGeographies={geographyData?.projectBySlug?.geographies ?? []}
          />
        ) : null}
      </div>
      {showMissingFragmentsWarning ? (
        <Warning level="info" className="py-2">
          {warningText}
          <button
            type="button"
            className="ml-1 underline decoration-dotted underline-offset-2"
            onClick={() => setShowFragmentStatusModal(true)}
          >
            {t("View details")}
          </button>
        </Warning>
      ) : null}
      {shouldShowStatusModal ? (
        <SketchFragmentStatusModal
          slug={slug}
          onRequestClose={() => setShowFragmentStatusModal(false)}
        />
      ) : null}
    </div>
  );
}
