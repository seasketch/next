import {
  FormElementTextVariant,
  SketchFormElementFragment,
} from "../../generated/graphql";
import { ReactNode, useCallback, useState } from "react";
import FormElementFactory from "../../surveys/FormElementFactory";
import { FormElementLayoutContext } from "../../surveys/SurveyAppLayout";
import { defaultStyle } from "../../surveys/appearance";
require("./sketching.css");

type SketchProperties = { name?: string } & { [id: number]: string };

export default function SketchForm({
  startingProperties,
  onChange,
  submissionAttempted,
  formElements,
  editable,
  buttons,
}: {
  startingProperties: { [id: number]: any };
  onChange?: (
    properties: SketchProperties,
    hasValidationErrors: boolean
  ) => void;
  submissionAttempted: boolean;
  formElements: SketchFormElementFragment[];
  editable?: boolean;
  buttons?: (element: SketchFormElementFragment) => ReactNode;
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
            // textVariant: FormElementTextVariant.Dynamic,
          },
          navigatingBackwards: false,
        }}
      >
        {formElements.map((element) => (
          <div className="flex items-center group">
            <div className="flex-1">
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
            </div>
            {buttons && (
              <div className="h-full flex flex-col pl-3 border-l opacity-10 group-hover:opacity-100 z-0">
                {buttons(element)}
              </div>
            )}
          </div>
        ))}
      </FormElementLayoutContext.Provider>
    </div>
  );
}
