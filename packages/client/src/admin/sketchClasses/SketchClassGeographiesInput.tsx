import { Trans, useTranslation } from "react-i18next";
import { useCallback, useState } from "react";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  GeographyDetailsFragment,
  SketchClassGeographyEditorDetailsDocument,
  SketchFragmentStatusDocument,
  useSketchClassGeographyEditorDetailsQuery,
  useUpdateSketchClassGeographiesMutation,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import Spinner from "../../components/Spinner";
import Modal from "../../components/Modal";

interface SketchClassGeographiesInputProps {
  sketchClassId: number;
  projectGeographies: GeographyDetailsFragment[];
}

export default function SketchClassGeographiesInput({
  sketchClassId,
  projectGeographies,
}: SketchClassGeographiesInputProps) {
  const { t } = useTranslation("admin:sketching");
  const slug = getSlug();
  const onError = useGlobalErrorHandler();
  const [pendingGeographyId, setPendingGeographyId] = useState<number | null>(
    null
  );
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    newGeographyId: number | null;
    currentGeographyId: number | null;
  } | null>(null);

  const [updateGeographies, { loading: isUpdating }] =
    useUpdateSketchClassGeographiesMutation({
      onError,
    });

  const { data, loading } = useSketchClassGeographyEditorDetailsQuery({
    variables: { slug },
  });

  const sketchClass = data?.projectBySlug?.sketchClasses.find(
    (sc) => sc.id === sketchClassId
  );

  const selectedGeographyId = sketchClass?.clippingGeographies?.[0]?.id;

  const applyGeographyChange = useCallback(
    (newGeographyId: number | null) => {
      setPendingGeographyId(newGeographyId);
      updateGeographies({
        variables: {
          id: sketchClassId,
          geographyIds: newGeographyId ? [newGeographyId] : [],
        },
        refetchQueries: [
          {
            query: SketchClassGeographyEditorDetailsDocument,
            variables: { slug },
          },
          {
            query: SketchFragmentStatusDocument,
            variables: { slug },
          },
        ],
        awaitRefetchQueries: true,
      }).finally(() => {
        setPendingGeographyId(null);
      });
    },
    [sketchClassId, slug, updateGeographies]
  );

  const handleGeographyChange = useCallback(
    (newGeographyId: number | null) => {
      if (newGeographyId === selectedGeographyId) {
        return;
      }

      // Only show confirmation when changing from one geography to another.
      if (selectedGeographyId && newGeographyId) {
        setPendingChange({
          newGeographyId,
          currentGeographyId: selectedGeographyId,
        });
        setShowConfirmModal(true);
        return;
      }

      applyGeographyChange(newGeographyId);
    },
    [applyGeographyChange, selectedGeographyId]
  );

  const handleConfirmChange = useCallback(() => {
    if (!pendingChange) return;
    applyGeographyChange(pendingChange.newGeographyId);
    setShowConfirmModal(false);
    setPendingChange(null);
  }, [applyGeographyChange, pendingChange]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="">{t("Geography")}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {t(
              "Choose a geography to associate with this sketch class. Polygons will be clipped to the geography bounds."
            )}
          </p>
        </div>
        <Spinner />
      </div>
    );
  }

  const currentGeography = pendingChange?.currentGeographyId
    ? projectGeographies.find((g) => g.id === pendingChange.currentGeographyId)
    : null;
  const newGeography = pendingChange?.newGeographyId
    ? projectGeographies.find((g) => g.id === pendingChange.newGeographyId)
    : null;

  return (
    <>
      <select
        value={selectedGeographyId || ""}
        onChange={(e) => {
          const selectedId = e.target.value ? Number(e.target.value) : null;
          handleGeographyChange(selectedId);
        }}
        disabled={isUpdating}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md disabled:opacity-50"
      >
        <option value="">{t("Select a geography...")}</option>
        {projectGeographies.map((geography) => (
          <option key={geography.id} value={geography.id}>
            {geography.name}
          </option>
        ))}
      </select>
      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-md">
          <Spinner />
        </div>
      )}

      {showConfirmModal && (
        <Modal
          title={t("Change Geography")}
          onRequestClose={() => {
            setShowConfirmModal(false);
            setPendingChange(null);
          }}
          footer={[
            {
              label: t("Cancel"),
              onClick: () => {
                setShowConfirmModal(false);
                setPendingChange(null);
              },
              disabled: isUpdating,
            },
            {
              label: t("Change Geography"),
              variant: "primary",
              onClick: handleConfirmChange,
              loading: isUpdating,
              disabled: isUpdating,
            },
          ]}
        >
          <div className="space-y-4 mb-2">
            <p>
              <Trans ns="admin:sketching">
                Are you sure you want to change the geography from{" "}
                <b className="font-medium">
                  {currentGeography?.name || "current geography"}
                </b>{" "}
                to{" "}
                <b className="font-medium">
                  {newGeography?.name || "new geography"}
                </b>
                ? Existing user geometries will need to be re-clipped to this
                new geography, which may slow report calculation until
                reprocessing is complete.
              </Trans>
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
