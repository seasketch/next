import { ReactNode, useContext } from "react";
import { Trans, useTranslation } from "react-i18next";
import Button from "../components/Button";
import { SketchGeometryType } from "../generated/graphql";
import { SurveyStyleContext } from "../surveys/appearance";
import { motion } from "framer-motion";
import { CursorClickIcon } from "@heroicons/react/outline";

export enum DigitizingState {
  /** User has not yet started drawing */
  BLANK,
  /** User has started drawing a non-point feature */
  STARTED,
  /**
   * Shape can be completed in a single action, such as when there are 3
   * vertices in a polygon, and the user can connect to the origin or
   * double-click to finish
   */
  CAN_COMPLETE,
  /** A complete shape has been created */
  FINISHED,
  /** Finished shape has been put into an editable state */
  EDITING,
}

interface DigitizingInstructionsProps {
  geometryType: SketchGeometryType;
  state: DigitizingState;
  /** Request deletion of selected feature */
  onRequestTrash: () => void;
  onRequestSubmit: () => void;
}

export default function DigitizingInstructions({
  geometryType,
  state,
  onRequestTrash,
  onRequestSubmit,
}: DigitizingInstructionsProps) {
  const { t } = useTranslation("surveys");
  const style = useContext(SurveyStyleContext);
  let instructions: ReactNode;
  switch (geometryType) {
    case SketchGeometryType.Point:
      instructions = getPointInstructions(state, style.isSmall);
      break;
    case SketchGeometryType.Linestring:
      instructions = getLineInstructions(state, style.isSmall);
      break;
    case SketchGeometryType.Polygon:
      instructions = getPolygonInstructions(state, style.isSmall);
      break;
    default:
      break;
  }
  return (
    // <div className="absolute bottom-16 z-10 w-full flex">
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      // exit={{ scale: 0 }}
      className={`rounded-md p-2 pl-4 my-4 mx-auto text-gray-800 bg-gray-200 shadow-lg flex space-x-2 items-center transition-all bottom-16 absolute z-10 pointer-events-none`}
    >
      <p className="mr-2">{instructions}</p>
      {(state === DigitizingState.FINISHED ||
        state === DigitizingState.EDITING) && (
        <>
          <Button
            label={t("Clear")}
            onClick={onRequestTrash}
            className="pointer-events-auto"
          />
          <Button
            onClick={onRequestSubmit}
            primary
            label={t("Submit")}
            className="pointer-events-auto"
          />
        </>
      )}
    </motion.div>
    // </div>
  );
}

function getPointInstructions(state: DigitizingState, isSmall: boolean) {
  // if (isSmall) {
  //   throw new Error("Not implemented");
  // }
  switch (state) {
    case DigitizingState.BLANK:
      return (
        <Trans ns="surveys">
          <CursorClickIcon className="w-6 h-6 inline-block mr-2" />
          Click on the map to place a point{" "}
        </Trans>
      );
    case DigitizingState.STARTED:
      throw new Error(
        "Point can not be in state STARTED in desktop digitizing mode"
      );
    case DigitizingState.CAN_COMPLETE:
      throw new Error("Point can not be in state CAN_COMPLETE");
    case DigitizingState.FINISHED:
      return <Trans ns="surveys">Point placed</Trans>;
    case DigitizingState.EDITING:
      return <Trans ns="surveys">Drag point to modify</Trans>;
    default:
      break;
  }
}

function getLineInstructions(state: DigitizingState, isSmall: boolean) {
  // if (isSmall) {
  //   throw new Error("Not implemented");
  // }
  switch (state) {
    case DigitizingState.BLANK:
      return (
        <Trans ns="surveys">
          <CursorClickIcon className="w-6 h-6 inline-block mr-2" />
          Click on the map to start a line
        </Trans>
      );
    case DigitizingState.STARTED:
      return (
        <Trans ns="surveys">
          Click to add more points, Double-Click to finish
        </Trans>
      );
    case DigitizingState.CAN_COMPLETE:
      return (
        <Trans ns="surveys">
          Click to add more points, Double-Click to finish
        </Trans>
      );
    case DigitizingState.FINISHED:
      return <Trans ns="surveys">Click line to edit</Trans>;
    case DigitizingState.EDITING:
      return <Trans ns="surveys">Click and drag points to modify</Trans>;
    default:
      break;
  }
}

function getPolygonInstructions(state: DigitizingState, isSmall: boolean) {
  // if (isSmall) {
  //   throw new Error("Not implemented");
  // }
  switch (state) {
    case DigitizingState.BLANK:
      return (
        <Trans ns="surveys">
          <CursorClickIcon className="w-6 h-6 inline-block mr-2" />
          Click on the map to start a polygon
        </Trans>
      );
    case DigitizingState.STARTED:
      return <Trans ns="surveys">Click to add more points</Trans>;
    case DigitizingState.CAN_COMPLETE:
      return (
        <Trans ns="surveys">
          Click the starting point or double-click the last point to finish
        </Trans>
      );
    case DigitizingState.FINISHED:
      return <Trans ns="surveys">Click polygon to edit</Trans>;
    case DigitizingState.EDITING:
      return <Trans ns="surveys">Click and drag points to modify</Trans>;
    default:
      break;
  }
}
