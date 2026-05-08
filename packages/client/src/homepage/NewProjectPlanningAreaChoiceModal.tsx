import React from "react";
import { Trans, useTranslation } from "react-i18next";
import Modal from "../components/Modal";

export type PlanningAreaFlow = "eez" | "high_seas" | "skip";

function PlanningAreaChoiceRow({
  title,
  description,
  onClick,
}: {
  title: React.ReactNode;
  description: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="p-4 hover:bg-indigo-300/5 w-full text-left"
      onClick={onClick}
    >
      <div className="flex-1 space-y-1">
        <h4 className="font-semibold text-gray-900">{title}</h4>
        <div className="text-sm text-gray-500 leading-snug">{description}</div>
      </div>
    </button>
  );
}

export default function NewProjectPlanningAreaChoiceModal({
  open,
  onRequestClose,
  onChoose,
}: {
  open: boolean;
  onRequestClose: () => void;
  onChoose: (flow: PlanningAreaFlow) => void;
}) {
  const { t } = useTranslation("homepage");

  return (
    <Modal
      open={open}
      onRequestClose={onRequestClose}
      title={t("Where will your project be used?")}
      panelClassName="max-w-lg"
    >
      <p className="text-sm -mt-8 pb-4 text-gray-700">
        <Trans ns="homepage">
          SeaSketch uses <i>Geographies</i> to represent significant areas for
          planning in your project. Using Geographies, you can clip user-drawn
          polygons to boundaries. Analytical reports also use Geographies to
          show statistics relative to the planning area. For example, you might
          report percent of an Exclusive Economic Zone covered by a given plan.
        </Trans>
      </p>
      <div className="rounded-md border border-gray-200 divide-y divide-gray-200 overflow-hidden bg-white">
        <PlanningAreaChoiceRow
          title={t("Exclusive Economic Zones or Territorial Seas")}
          description={
            <Trans ns="homepage">
              After making country selections, SeaSketch will create geographies
              using the Flanders Marine Institute's Marine Regions dataset.
            </Trans>
          }
          onClick={() => onChoose("eez")}
        />
        <PlanningAreaChoiceRow
          title={t("The High Seas")}
          description={t(
            "A single geography will be created for your project representing areas beyond national jurisdiction."
          )}
          onClick={() => onChoose("high_seas")}
        />
        <PlanningAreaChoiceRow
          title={t("Within some other boundary")}
          description={t(
            "For smaller or custom planning areas, you can skip geography creation now. After your project is created, you can upload a boundary layer and create geographies using the administrative tools."
          )}
          onClick={() => onChoose("skip")}
        />
      </div>
    </Modal>
  );
}
