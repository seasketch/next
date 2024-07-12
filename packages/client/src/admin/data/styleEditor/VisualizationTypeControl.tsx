import { CaretDownIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import * as Editor from "./Editors";
import { ReactNode, useContext, useEffect } from "react";
import { Trans } from "react-i18next";
import { VisualizationTypeDescriptions } from "./visualizationTypes";

export default function VisualizationTypeControl({
  buttons,
  buttonsContainerRef,
}: {
  buttons?: ReactNode;
  buttonsContainerRef?: (ref: HTMLDivElement) => void;
}) {
  const { type, setVisualizationType, supportedTypes, t } = useContext(
    Editor.GUIEditorContext
  );
  const Select = Editor.Select;

  return (
    <Editor.CardTitle
      buttons={buttons}
      buttonsContainerRef={buttonsContainerRef}
    >
      <Select.Root value={type} onValueChange={setVisualizationType}>
        <Select.Trigger className="text-lg  opacity-100 -ml-3 hover:border-transparent -mt-2">
          <div className="text-gray-200 hover:text-indigo-200 flex items-center space-x-1">
            <Select.Value placeholder={t("Select a visualization type")} />
            <CaretDownIcon className="w-5 h-5" />
          </div>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content side="bottom" align="start" sideOffset={5}>
            <Select.Viewport>
              <h3
                className="px-2 py-1 text-sm text-gray-400 flex items-center space-x-3 pb-2"
                style={{ maxWidth: 340 }}
              >
                {supportedTypes.length === 1 && type === supportedTypes[0] && (
                  <InfoCircledIcon
                    className="w-8 h-8 pl-1"
                    style={{
                      fill: "transparent",
                      stroke: "currentColor",
                      strokeWidth: 0.2,
                    }}
                  />
                )}
                <span>
                  {supportedTypes.length === 1 && type === supportedTypes[0]
                    ? t(
                        "This dataset only supports the currently selected visualization type"
                      )
                    : t("Choose a visualization type")}
                </span>
              </h3>
              {supportedTypes.map((type) => (
                <Select.Item
                  key={type}
                  value={type}
                  style={{ maxWidth: 340, overflow: "hidden" }}
                >
                  <div className="px-1 overflow-hidden max-w-full">
                    <Select.ItemText>
                      <span>{type}</span>
                    </Select.ItemText>
                    {VisualizationTypeDescriptions[type] && (
                      <div className="text-sm text-gray-400 description mt-1">
                        {VisualizationTypeDescriptions[type]}
                      </div>
                    )}
                  </div>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {(type === undefined || !supportedTypes.includes(type)) && (
        <div
          className="flex items-center text-gray-200 text-sm py-2"
          style={{ textTransform: "none" }}
        >
          {/* <ExclamationTriangleIcon className="w-8 h-8" /> */}
          <p>
            <Trans ns="admin:data">
              The style for this layer could not be recognized using any of
              SeaSketch's templates. Please choose a visualization type if you
              would like to use the graphical style editor, or switch to the
              code editor to make changes.
            </Trans>
          </p>
        </div>
      )}
    </Editor.CardTitle>
  );
}
