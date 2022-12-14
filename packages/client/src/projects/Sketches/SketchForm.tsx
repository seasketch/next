import {
  FormElementTextVariant,
  SketchFormElementFragment,
  useUpdateFormElementOrderMutation,
} from "../../generated/graphql";
import { ReactNode, useCallback, useState } from "react";
import FormElementFactory from "../../surveys/FormElementFactory";
import { FormElementLayoutContext } from "../../surveys/SurveyAppLayout";
import { defaultStyle } from "../../surveys/appearance";
import {
  DragDropContext,
  Draggable,
  DraggableProvidedDragHandleProps,
  Droppable,
} from "react-beautiful-dnd";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
require("./sketching.css");

type SketchProperties = { name?: string } & { [id: number]: string };

export default function SketchForm({
  startingProperties,
  onChange,
  submissionAttempted,
  formElements,
  editable,
  buttons,
  ...props
}: {
  startingProperties: { [id: number]: any };
  onChange?: (
    properties: SketchProperties,
    hasValidationErrors: boolean
  ) => void;
  submissionAttempted: boolean;
  formElements: SketchFormElementFragment[];
  editable?: boolean;
  buttons?: (
    element: SketchFormElementFragment,
    dragHandleProps: DraggableProvidedDragHandleProps | undefined
  ) => ReactNode;
  renderElement?: (
    children: ReactNode,
    element: SketchFormElementFragment,
    index: number
  ) => ReactNode;
}) {
  const [state, setState] = useState<{
    [id: number]: {
      value: any;
      error?: boolean;
    };
  }>(
    Object.keys(startingProperties).reduce(
      (state, id) => {
        state[parseInt(id)] = {
          value: startingProperties[parseInt(id)],
        };
        return state;
      },
      {} as {
        [id: number]: {
          value: any;
          error?: boolean;
        };
      }
    )
  );

  const noop = useCallback(() => {}, []);

  const renderElement = useCallback(
    (element) => {
      return (
        <FormElementFactory
          key={element.id}
          typeName={element.type!.componentName}
          componentSettings={element.componentSettings}
          value={state[element.id] ? state[element.id].value : undefined}
          id={element.id}
          isRequired={element.isRequired}
          alternateLanguageSettings={element.alternateLanguageSettings}
          body={element.body}
          onChange={(value, validationErrors) => {
            setState((prev) => ({
              ...prev,
              [element.id]: {
                value,
                errors: validationErrors,
              },
            }));
            if (onChange) {
              const hasErrors =
                validationErrors ||
                Object.values(state).find((v) => v.error) !== undefined;
              const newProperties: { [id: number]: any } = {
                [element.id]: value,
              };
              for (const strId in state) {
                const id = parseInt(strId);
                if (id !== element.id) {
                  newProperties[id] = state[id].value;
                }
              }
              onChange(newProperties, hasErrors);
            }
          }}
          submissionAttempted={submissionAttempted}
          onSubmit={noop}
          isSpatial={false}
          featureNumber={0}
          onRequestStageChange={noop}
          onRequestNext={noop}
          onRequestPrevious={noop}
          stage={0}
          autoFocus={false}
          isSketchWorkflow={true}
          editable={editable}
        />
      );
    },
    [editable, noop, onChange, state, submissionAttempted]
  );

  return (
    <div className="SketchForm" dir="ltr">
      <FormElementLayoutContext.Provider
        value={{
          mapPortal: null,
          style: {
            ...defaultStyle,
            isDark: false,
            textClass: "text-black",
            backgroundColor: "#eee",
            secondaryColor: "#999",
            secondaryColor2: "#aaa",
            isSmall: false,
            compactAppearance: true,
          },
          navigatingBackwards: false,
        }}
      >
        <div>
          {formElements.map((element, i) => {
            if (props.renderElement) {
              return props.renderElement(renderElement(element), element, i);
            } else {
              return renderElement(element);
            }
          })}
        </div>
      </FormElementLayoutContext.Provider>
    </div>
  );
}
