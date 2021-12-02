import {
  FunctionComponent,
  ReactNode,
  ReactNodeArray,
  useContext,
  useRef,
  useState,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import Button from "../components/Button";
import { SketchGeometryType } from "../generated/graphql";
import { SurveyStyleContext } from "../surveys/appearance";
import { AnimatePresence, motion } from "framer-motion";
import {
  CursorClickIcon,
  DotsCircleHorizontalIcon,
  DotsHorizontalIcon,
  TrashIcon,
} from "@heroicons/react/outline";
import useMobileDeviceDetector from "../surveys/useMobileDeviceDetector";
import { DigitizingState } from "../draw/useMapboxGLDraw";
import DigitizingActionsPopup, {
  DigitizingActionItem,
  NextQuestion,
} from "../draw/DigitizingActionsPopup";

interface DigitizingInstructionsProps {
  geometryType: SketchGeometryType;
  state: DigitizingState;
  /** Request deletion of selected feature */
  onRequestReset: () => void;
  onRequestSubmit: () => void;
  onRequestEdit: () => void;
  onRequestFinishEditing: () => void;
}

const DigitizingTools: FunctionComponent<DigitizingInstructionsProps> = ({
  geometryType,
  state,
  onRequestSubmit,
  onRequestReset,
  onRequestEdit,
  onRequestFinishEditing,
  children,
}) => {
  const { t } = useTranslation("surveys");
  const style = useContext(SurveyStyleContext);
  const isMobile = useMobileDeviceDetector();
  const [toolsOpen, setToolsOpen] = useState(false);
  const actionsButtonAnchor = useRef<HTMLButtonElement>(null);

  let instructions: ReactNode;
  switch (geometryType) {
    case SketchGeometryType.Point:
      instructions = getPointInstructions(state, isMobile);
      break;
    case SketchGeometryType.Linestring:
      instructions = getLineInstructions(state, isMobile);
      break;
    case SketchGeometryType.Polygon:
      instructions = getPolygonInstructions(state, isMobile);
      break;
    default:
      break;
  }

  const bottomToolbar = isMobile && style.isSmall;

  const buttons = (
    <>
      <button
        title="Options"
        ref={actionsButtonAnchor}
        onClick={() => {
          setToolsOpen(true);
        }}
        className="pointer-events-auto rounded-full bg-gray-300 hover:text-gray-500 p-2 border border-gray-300"
      >
        <DotsHorizontalIcon className={bottomToolbar ? "w-6 h-6" : "w-5 h-5"} />
      </button>
      {(state === DigitizingState.FINISHED ||
        state === DigitizingState.CREATED) && (
        <Button
          label={t("Edit")}
          onClick={onRequestEdit}
          className={`pointer-events-auto ${
            bottomToolbar && "content-center flex-1"
          }`}
          buttonClassName={
            bottomToolbar
              ? "py-3 text-base flex-1 text-center items-center justify-center"
              : ""
          }
        />
      )}
      {state === DigitizingState.EDITING && (
        <Button
          label={<TrashIcon className="w-5 h-5" />}
          onClick={onRequestReset}
          className={`pointer-events-auto`}
          buttonClassName={
            bottomToolbar ? "py-3 flex-1 justify-center content-center" : ""
          }
        />
      )}
      {(state === DigitizingState.FINISHED ||
        state === DigitizingState.CREATED) && (
        <Button
          onClick={onRequestSubmit}
          primary
          label={t("Continue Survey")}
          className={`pointer-events-auto whitespace-nowrap ${
            bottomToolbar && "flex-2 content-center"
          }`}
          buttonClassName={
            bottomToolbar
              ? "py-3 text-base flex-1 text-center items-center justify-center"
              : ""
          }
        />
      )}
      {state === DigitizingState.EDITING && (
        <Button
          onClick={onRequestFinishEditing}
          primary
          label={t("Done Editing")}
          className={`pointer-events-auto whitespace-nowrap ${
            bottomToolbar && "flex-2 content-center max-w-1/2"
          }`}
          buttonClassName={
            bottomToolbar
              ? "py-3 text-base flex-1 text-center items-center justify-center"
              : ""
          }
        />
      )}
      {state === DigitizingState.CAN_COMPLETE && isMobile && (
        <Button
          onClick={onRequestFinishEditing}
          label={t("Finish Shape")}
          primary
          className={`pointer-events-auto whitespace-nowrap ${
            bottomToolbar && "flex-1 content-center max-w-1/2"
          }`}
          buttonClassName={
            bottomToolbar
              ? "py-3 text-base flex-1 text-center items-center justify-center"
              : ""
          }
        />
      )}
    </>
  );

  if (bottomToolbar) {
    return (
      <>
        <DigitizingActionsPopup
          open={toolsOpen}
          onRequestClose={() => setToolsOpen(false)}
        >
          {children}
        </DigitizingActionsPopup>
        <AnimatePresence>
          {instructions && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{ maxWidth: "90%" }}
              exit={{ scale: 0.7, opacity: 0 }}
              className={`rounded-md p-1 px-2 mx-auto text-gray-800 bg-gray-200 shadow-lg flex space-x-2 items-center bottom-16 tall:mb-2 absolute z-10 pointer-events-none`}
            >
              <p className="text-sm select-none">{instructions}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex-shrink-0 tall:p-2 space-x-2 items-center flex absolute z-10 bottom-0 w-full bg-gray-200 p-1 px-2 space-x-2 justify-center">
          {buttons}
        </div>
      </>
    );
  } else {
    return (
      <>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{ maxWidth: "90%" }}
          // exit={{ scale: 0 }}
          className={`rounded-md p-2 pl-4 my-4 mx-auto text-gray-800 bg-gray-200 shadow-lg flex space-x-2 items-center transition-all bottom-16 absolute z-10 pointer-events-none`}
        >
          {instructions && (
            <p className="text-sm select-none">{instructions}</p>
          )}
          <div className="flex-shrink-0 space-x-2 items-center flex">
            {buttons}
          </div>
        </motion.div>
        <DigitizingActionsPopup
          anchor={actionsButtonAnchor.current || undefined}
          open={toolsOpen}
          onRequestClose={() => setToolsOpen(false)}
        >
          {children}
        </DigitizingActionsPopup>
      </>
      // </div>
    );
  }
};

export default DigitizingTools;

function getPointInstructions(state: DigitizingState, isMobile: boolean) {
  switch (state) {
    case DigitizingState.BLANK && !isMobile:
      return (
        <Trans ns="surveys">
          <CursorClickIcon className="w-6 h-6 inline-block mr-2" />
          Click on the map to place a point{" "}
        </Trans>
      );
    case DigitizingState.BLANK && isMobile:
      return (
        <Trans ns="surveys">
          <CursorClickIcon className="w-6 h-6 inline-block mr-2" />
          Tap the map to place a point{" "}
        </Trans>
      );
    case DigitizingState.STARTED:
      throw new Error(
        "Point can not be in state STARTED in desktop digitizing mode"
      );
    case DigitizingState.CAN_COMPLETE:
      throw new Error("Point can not be in state CAN_COMPLETE");
    case DigitizingState.CREATED:
      return <Trans ns="surveys">Point placed</Trans>;
    case DigitizingState.EDITING:
      return <Trans ns="surveys">Drag point to modify</Trans>;
    case DigitizingState.FINISHED:
      return null;
    default:
      return null;
  }
}

function getLineInstructions(state: DigitizingState, isMobile: boolean) {
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
    case DigitizingState.CREATED:
      return <Trans ns="surveys">Line created</Trans>;
    case DigitizingState.EDITING:
      return <Trans ns="surveys">Click and drag points to modify</Trans>;
    case DigitizingState.FINISHED:
      return null;
    // return <Trans ns="surveys">Click line to edit</Trans>;
    default:
      return null;
  }
}

function getPolygonInstructions(state: DigitizingState, isMobile: boolean) {
  if (isMobile) {
    switch (state) {
      case DigitizingState.BLANK:
        return (
          <Trans ns="surveys">
            <svg
              viewBox="0 0 24 24"
              height="48"
              width="48"
              focusable="false"
              role="img"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              className="text-gray-700 w-6 h-6 inline-block mr-2"
            >
              <title>TouchApp icon</title>
              <rect width="24" height="24" fill="none"></rect>
              <path d="M9 9.24V5.5a2.5 2.5 0 015 0v3.74c1.21-.81 2-2.18 2-3.74C16 3.01 13.99 1 11.5 1S7 3.01 7 5.5c0 1.56.79 2.93 2 3.74z"></path>
              <path d="M14.5 11.71c-.28-.14-.58-.21-.89-.21H13v-6c0-.83-.67-1.5-1.5-1.5S10 4.67 10 5.5v10.74l-3.44-.72a1.12 1.12 0 00-1.02 1.89l4.01 4.01c.37.37.88.58 1.41.58h6.41c1 0 1.84-.73 1.98-1.72l.63-4.46c.12-.85-.32-1.69-1.09-2.07l-4.39-2.04z"></path>
            </svg>
            {/* <CursorClickIcon className="w-6 h-6 inline-block mr-2" /> */}
            Tap the map to start a polygon
          </Trans>
        );
      case DigitizingState.STARTED:
        return <Trans ns="surveys">Tap to add more points</Trans>;
      case DigitizingState.CAN_COMPLETE:
        return (
          <Trans ns="surveys">Tap start point or double tap to finish</Trans>
        );
      case DigitizingState.CREATED:
        return <Trans ns="surveys">Shape saved</Trans>;
      case DigitizingState.FINISHED:
        return null;
      case DigitizingState.EDITING:
        return <Trans ns="surveys">Drag points to modify</Trans>;
      default:
        break;
    }
  } else {
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
        return null;
      case DigitizingState.CREATED:
        return <Trans ns="surveys">Shape saved</Trans>;
      case DigitizingState.EDITING:
        return <Trans ns="surveys">Click and drag points to modify</Trans>;
      default:
        break;
    }
  }
}
