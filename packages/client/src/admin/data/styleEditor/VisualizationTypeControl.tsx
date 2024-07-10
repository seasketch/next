import { CaretDownIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import * as Editor from "./Editors";
import { ReactNode, useContext } from "react";
import Warning from "../../../components/Warning";
import { Trans } from "react-i18next";

export default function VisualizationTypeControl({
  buttons,
}: {
  buttons?: ReactNode;
}) {
  const { type, setVisualizationType, supportedTypes, t } = useContext(
    Editor.GUIEditorContext
  );
  const Select = Editor.Select;

  return (
    <Editor.CardTitle buttons={buttons}>
      <Select.Root value={type} onValueChange={setVisualizationType}>
        <Select.Trigger className="text-lg  opacity-100 -ml-3 hover:border-transparent">
          <div className="text-gray-200 hover:text-indigo-200 flex items-center">
            <Select.Value placeholder={t("Select a visualization type")} />
            <CaretDownIcon className="w-5 h-5" />
          </div>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content side="bottom" align="end" sideOffset={5}>
            <Select.Viewport>
              {supportedTypes.map((type) => (
                <Select.Item key={type} value={type}>
                  <Select.ItemText>{type}</Select.ItemText>
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
