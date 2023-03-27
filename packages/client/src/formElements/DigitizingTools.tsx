import {
  FunctionComponent,
  ReactNode,
  useContext,
  useRef,
  useState,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import Button from "../components/Button";
import {
  SketchGeometryType,
  useAllBasemapsLazyQuery,
} from "../generated/graphql";
import { AnimatePresence, motion } from "framer-motion";
import { CursorClickIcon, TrashIcon } from "@heroicons/react/outline";
import useMobileDeviceDetector from "../surveys/useMobileDeviceDetector";
import { DigitizingState } from "../draw/useMapboxGLDraw";
import MapSettingsPopup from "../draw/MapSettingsPopup";
import BowtieInstructions from "../draw/BowtieInstructions";
import { FormElementLayoutContext } from "../surveys/SurveyAppLayout";
import Spinner from "../components/Spinner";
import { XCircleIcon } from "@heroicons/react/solid";

interface DigitizingInstructionsProps {
  geometryType: SketchGeometryType;
  state: DigitizingState;
  /** Request deletion of selected feature */
  onRequestDelete: () => void;
  onRequestSubmit: () => void;
  onRequestEdit: () => void;
  onRequestFinishEditing: (hasKinks: boolean) => void;
  onRequestResetFeature: () => void;
  multiFeature?: boolean;
  /**
   * Button or buttons to display when digitizing state is UNFINISHED. Useful
   * since next steps may vary based on specifics of UI workflow, or whether the
   * user is on desktop or a mobile device. For example, in surveys on desktop
   * the feature properties form is displayed side-by-side with the map, while
   * on mobile the user needs to transition from the map to a data entry form.
   */
  unfinishedStateButtons?: ReactNode;
  noSelectionStateButtons?: ReactNode;
  /** Displayed if DigitizingState is CREATE, CAN_COMPLETE, or STARTED */
  createStateButtons?: ReactNode;
  selfIntersects?: boolean;
  /** Sketching as opposed to survey response */
  isSketchingWorkflow?: boolean;
  preprocessingError?: string;
}

const DigitizingTools: FunctionComponent<DigitizingInstructionsProps> = ({
  geometryType,
  state,
  onRequestSubmit,
  onRequestDelete,
  onRequestEdit,
  onRequestFinishEditing,
  onRequestResetFeature,
  children,
  multiFeature,
  unfinishedStateButtons,
  selfIntersects,
  noSelectionStateButtons,
  createStateButtons,
  isSketchingWorkflow,
  preprocessingError,
}) => {
  const { t } = useTranslation("surveys");
  const style = useContext(FormElementLayoutContext).style;
  const isMobile = useMobileDeviceDetector();
  const [toolsOpen, setToolsOpen] = useState(false);
  const actionsButtonAnchor = useRef<HTMLButtonElement>(null);
  const [showInvalidShapeModal, setShowInvalidShapeModal] = useState(false);

  if (state === DigitizingState.DISABLED) {
    return null;
  }

  const bottomToolbar = isMobile && style.isSmall;

  const buttons = (
    <>
      {DigitizingState.NO_SELECTION &&
        !multiFeature &&
        !isSketchingWorkflow && (
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
      {(state === DigitizingState.EDITING ||
        selfIntersects ||
        preprocessingError) && (
        <Button
          label={<TrashIcon className="w-5 h-5" />}
          onClick={onRequestDelete}
          className={`pointer-events-auto`}
          buttonClassName={
            bottomToolbar ? "py-3 flex-1 justify-center content-center" : ""
          }
        />
      )}
      {state === DigitizingState.EDITING && !selfIntersects && (
        <Button
          onClick={() => {
            if (selfIntersects) {
              setShowInvalidShapeModal(true);
            } else {
              onRequestFinishEditing(false);
            }
          }}
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
      {state === DigitizingState.PREPROCESSING_ERROR && (
        <Button
          onClick={() => {
            onRequestFinishEditing(false);
          }}
          label={t("Resubmit")}
          className={`pointer-events-auto whitespace-nowrap ${
            bottomToolbar && "flex-2 content-center max-w-1/2"
          }`}
          primary
          buttonClassName={
            bottomToolbar
              ? "py-3 text-base flex-1 text-center items-center justify-center"
              : "bg-red-500"
          }
        />
      )}
      {selfIntersects &&
        (state === DigitizingState.UNFINISHED || isSketchingWorkflow) && (
          <Button
            onClick={() => {
              setShowInvalidShapeModal(true);
            }}
            label={t("Invalid Shape")}
            className={`pointer-events-auto whitespace-nowrap ${
              bottomToolbar && "flex-2 content-center max-w-1/2"
            }`}
            buttonClassName={
              bottomToolbar
                ? "py-3 text-base flex-1 text-center items-center justify-center border-red-800 bg-red-50 text-red-900 hover:text-red-700"
                : "border-red-800 bg-red-50 text-red-900 hover:text-red-700"
            }
          />
        )}
      {state === DigitizingState.UNFINISHED && unfinishedStateButtons}
      {state === DigitizingState.NO_SELECTION && noSelectionStateButtons}
      {(state === DigitizingState.CREATE ||
        state === DigitizingState.CAN_COMPLETE ||
        state === DigitizingState.STARTED) &&
        createStateButtons}
    </>
  );

  if (isSketchingWorkflow && geometryType === SketchGeometryType.Collection) {
    return null;
  }

  if (bottomToolbar) {
    return (
      <div>
        <BowtieInstructions
          open={showInvalidShapeModal}
          onRequestClose={() => setShowInvalidShapeModal(false)}
          onRequestReset={
            state === DigitizingState.EDITING
              ? onRequestResetFeature
              : undefined
          }
        />
        <MapSettingsPopup
          open={toolsOpen}
          onRequestClose={() => setToolsOpen(false)}
        >
          {children}
        </MapSettingsPopup>
        <AnimatePresence>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: 0.1,
            }}
            style={{ maxWidth: "90%" }}
            exit={{ scale: 0.7, opacity: 0 }}
            className={`rounded-md p-1 px-2 mx-auto text-gray-800 bg-gray-200 shadow-lg flex space-x-2 rtl:space-x-reverse items-center bottom-16 tall:mb-2 absolute z-10 pointer-events-none`}
          >
            <p className="text-sm select-none">
              <DigitizingInstructions
                state={state}
                geometryType={geometryType}
                isMobile={isMobile}
                multiFeature={multiFeature || false}
                selfIntersects={selfIntersects || false}
                preprocessingError={preprocessingError}
              />
            </p>
          </motion.div>
        </AnimatePresence>
        <div className="flex-shrink-0 tall:p-2 space-x-2 items-center flex absolute z-10 bottom-0 w-full bg-gray-200 p-1 px-2 space-x-2 rtl:space-x-reverse justify-center">
          {buttons}
        </div>
      </div>
    );
  } else {
    return (
      <>
        <BowtieInstructions
          open={showInvalidShapeModal}
          onRequestClose={() => setShowInvalidShapeModal(false)}
          onRequestReset={
            state === DigitizingState.EDITING
              ? onRequestResetFeature
              : undefined
          }
        />

        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{ maxWidth: "90%" }}
          transition={{
            duration: 0.1,
          }}
          // exit={{ scale: 0 }}
          className={`rounded-md p-2 pl-4 my-4 mx-auto text-gray-800 bg-gray-200 shadow-lg flex space-x-2 rtl:space-x-reverse items-center transition-all bottom-16 absolute z-10 pointer-events-none`}
        >
          <p className="text-sm select-none">
            {isSketchingWorkflow &&
            state === DigitizingState.NO_SELECTION &&
            geometryType !== SketchGeometryType.Collection ? (
              <Trans ns="digitizing">Click your sketch to edit geometry</Trans>
            ) : (
              <DigitizingInstructions
                state={state}
                geometryType={geometryType}
                isMobile={isMobile}
                multiFeature={multiFeature || false}
                selfIntersects={selfIntersects || false}
                preprocessingError={preprocessingError}
              />
            )}
          </p>
          <div className="flex-shrink-0 space-x-2 items-center flex">
            {buttons}
          </div>
        </motion.div>
        <MapSettingsPopup
          anchor={actionsButtonAnchor.current || undefined}
          open={toolsOpen}
          onRequestClose={() => setToolsOpen(false)}
        >
          {children}
        </MapSettingsPopup>
        {/* </div> */}
      </>
    );
  }
};

export default DigitizingTools;

export function DigitizingInstructions({
  state,
  isMobile,
  multiFeature,
  geometryType,
  selfIntersects,
  preprocessingError,
}: {
  state: DigitizingState;
  isMobile: boolean;
  multiFeature: boolean;
  geometryType: SketchGeometryType;
  selfIntersects: boolean;
  preprocessingError?: string;
}) {
  if (selfIntersects) {
    return <Trans ns="surveys">Invalid shape</Trans>;
  }

  if (state === DigitizingState.PREPROCESSING) {
    return (
      <span className="flex items-center">
        <span>
          <Trans ns="sketching">
            Processing your sketch. This should only take a moment.
          </Trans>
        </span>
        <Spinner className="ml-2" />
      </span>
    );
  }
  if (state === DigitizingState.PREPROCESSING_ERROR) {
    return (
      <>
        <span className="flex items-center">
          <XCircleIcon className="w-6 h-6 text-red-600 mr-2" />
          <span className="block">
            {preprocessingError
              ? preprocessingError.replace(/\.$/, "")
              : "Error: Unknown"}
          </span>
        </span>
        {/* <span>
          <span className="flex items-center">
            <span className="block">
              <Trans ns="sketching">
                There was a problem processing you sketch. You may need to edit
                and resubmit your shape to resolve it.
              </Trans>
            </span>
          </span>
        </span> */}
      </>
    );
  }

  switch (geometryType) {
    case SketchGeometryType.Polygon:
      return (
        <PolygonInstructions
          state={state}
          isMobile={isMobile}
          multiFeature={multiFeature}
        />
      );
    case SketchGeometryType.Point:
      return (
        <PointInstructions
          state={state}
          isMobile={isMobile}
          multiFeature={multiFeature}
        />
      );
    case SketchGeometryType.Linestring:
      return (
        <LineInstructions
          state={state}
          isMobile={isMobile}
          multiFeature={multiFeature}
        />
      );
    default:
      return null;
  }
}

function PointInstructions({
  state,
  isMobile,
  multiFeature,
}: {
  state: DigitizingState;
  isMobile: boolean;
  multiFeature: boolean;
}) {
  switch (state) {
    case DigitizingState.CREATE && !isMobile:
      return (
        <div>
          <CursorClickIcon className="w-6 h-6 inline-block mr-2" />
          <span>
            <Trans ns="digitizing" i18nKey="StartPoint">
              Click on the map to place a point
            </Trans>
          </span>
        </div>
      );
    case DigitizingState.CREATE && isMobile:
      return (
        <div>
          <CursorClickIcon className="w-6 h-6 inline-block mr-2" />
          <span>
            <Trans ns="digitizing" i18nKey="StartPointTouch">
              Tap the map to place a point
            </Trans>
          </span>
        </div>
      );
    case DigitizingState.STARTED:
      throw new Error(
        "Point can not be in state STARTED in desktop digitizing mode"
      );
    case DigitizingState.CAN_COMPLETE:
      throw new Error("Point can not be in state CAN_COMPLETE");
    // case DigitizingState.CREATED:
    //   return <Trans ns="digitizing">Point placed</Trans>;
    case DigitizingState.UNFINISHED:
    case DigitizingState.EDITING:
      return (
        <span>
          <Trans ns="digitizing" i18nKey="DragPoint">
            Drag point to modify
          </Trans>
        </span>
      );
    case DigitizingState.NO_SELECTION:
      return (
        <span>
          <Trans ns="digitizing" i18nKey="NoSelectionPoint">
            Click a point to edit
          </Trans>
        </span>
      );
    default:
      return null;
  }
}

function LineInstructions({
  state,
  isMobile,
  multiFeature,
}: {
  state: DigitizingState;
  isMobile: boolean;
  multiFeature: boolean;
}) {
  switch (state) {
    case DigitizingState.CREATE:
      return (
        <div>
          <CursorClickIcon className="w-6 h-6 inline-block mr-2" />
          <span>
            <Trans ns="digitizing" i18nKey="StartLine">
              Click on the map to start a line
            </Trans>
          </span>
        </div>
      );
    case DigitizingState.STARTED:
      return (
        <span>
          <Trans ns="digitizing" i18nKey="ContinueDrawLine">
            Click to add more points, Double-Click to finish
          </Trans>
        </span>
      );
    case DigitizingState.CAN_COMPLETE:
      return (
        <span>
          <Trans ns="digitizing" i18nKey="CanCompleteLine">
            Click to add more points, Double-Click to finish
          </Trans>
        </span>
      );
    case DigitizingState.UNFINISHED:
    case DigitizingState.EDITING:
      return (
        <span>
          <Trans ns="digitizing" i18nKey="DragVertex">
            Click and drag points to modify
          </Trans>
        </span>
      );
    case DigitizingState.NO_SELECTION:
      return (
        <span>
          <Trans ns="digitizing">Click a line to edit</Trans>
        </span>
      );
    default:
      return null;
  }
}

function PolygonInstructions({
  state,
  isMobile,
  multiFeature,
}: {
  state: DigitizingState;
  isMobile: boolean;
  multiFeature: boolean;
}) {
  if (isMobile) {
    switch (state) {
      case DigitizingState.CREATE:
        return (
          <>
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
              <rect width="24" height="24" fill="none"></rect>
              <path d="M9 9.24V5.5a2.5 2.5 0 015 0v3.74c1.21-.81 2-2.18 2-3.74C16 3.01 13.99 1 11.5 1S7 3.01 7 5.5c0 1.56.79 2.93 2 3.74z"></path>
              <path d="M14.5 11.71c-.28-.14-.58-.21-.89-.21H13v-6c0-.83-.67-1.5-1.5-1.5S10 4.67 10 5.5v10.74l-3.44-.72a1.12 1.12 0 00-1.02 1.89l4.01 4.01c.37.37.88.58 1.41.58h6.41c1 0 1.84-.73 1.98-1.72l.63-4.46c.12-.85-.32-1.69-1.09-2.07l-4.39-2.04z"></path>
            </svg>
            <span>
              <Trans ns="digitizing" i18nKey="StartPolygonTouch">
                Tap the map to start a polygon
              </Trans>
            </span>
          </>
        );
      case DigitizingState.STARTED:
        return (
          <span>
            <Trans ns="digitizing" i18nKey="ContinuePolygonTouch">
              Tap to add more points
            </Trans>
          </span>
        );
      case DigitizingState.CAN_COMPLETE:
        return (
          <span>
            <Trans ns="digitizing" i18nKey="CanCompletePolygonTouch">
              Tap start point or double tap to finish
            </Trans>
          </span>
        );
      case DigitizingState.NO_SELECTION:
        if (multiFeature) {
          return (
            <span>
              <Trans ns="digitizing" i18nKey="EditPolygonTouch">
                Tap a shape to edit
              </Trans>
            </span>
          );
        } else {
          return null;
        }
      case DigitizingState.EDITING:
      case DigitizingState.UNFINISHED:
        return (
          <span>
            <Trans ns="digitizing" i18nKey="DragVertexPolygonTouch">
              Drag points to modify
            </Trans>
          </span>
        );
      default:
        break;
    }
  } else {
    switch (state) {
      case DigitizingState.CREATE:
        return (
          <>
            <CursorClickIcon className="w-6 h-6 inline-block mr-2" />
            <span>
              <Trans ns="digitizing" i18nKey="StartPolygon">
                Click on the map to start a polygon
              </Trans>
            </span>
          </>
        );
      case DigitizingState.STARTED:
        return (
          <span>
            <Trans ns="digitizing" i18nKey="ContinuePolygon">
              Click to add more points
            </Trans>
          </span>
        );
      case DigitizingState.CAN_COMPLETE:
        return (
          <span>
            <Trans ns="digitizing" i18nKey="FinishPolygonDesktop">
              Click the starting point or double-click the last point to finish
            </Trans>
          </span>
        );
      case DigitizingState.NO_SELECTION:
        if (multiFeature) {
          return (
            <span>
              <Trans ns="digitizing" i18nKey="ClickToEditPolygonDesktop">
                Click a shape to edit
              </Trans>
            </span>
          );
        } else {
          return null;
        }

      case DigitizingState.EDITING:
      case DigitizingState.UNFINISHED:
        return (
          <span>
            <Trans ns="digitizing" i18nKey="EditPolygonDesktop">
              Drag points to modify
            </Trans>
          </span>
        );
      default:
        return null;
    }
  }
  return null;
}
