import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import RadioGroup from "../../components/RadioGroup";
import Spinner from "../../components/Spinner";
import {
  InteractivityType,
  useUpdateInteractivitySettingsMutation,
  useInteractivitySettingsByIdQuery,
  BasemapDetailsFragment,
} from "../../generated/graphql";
import * as CodeMirror from "react-codemirror2";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/material.css";
import "codemirror-colorpicker/dist/codemirror-colorpicker.css";
import "codemirror-colorpicker";
import "codemirror/addon/lint/lint.css";
import sanitizeHtml from "sanitize-html";
import Button from "../../components/Button";
import useSourcePropertyNames from "./useSourcePropertyNames";
import SetBasemapInteractivityLayers from "./SetBasemapInteractivityLayers";
require("codemirror/addon/lint/lint");
require("codemirror/addon/lint/json-lint");
require("codemirror/mode/javascript/javascript");
require("codemirror/mode/xml/xml");
require("codemirror/mode/handlebars/handlebars");

export default function InteractivitySettings({
  id,
  dataSourceId,
  sublayer,
  basemap,
}: {
  id: number;
  dataSourceId?: number;
  sublayer?: string | null;
  basemap?: BasemapDetailsFragment;
}) {
  const { t } = useTranslation("admin");
  const { data, loading } = useInteractivitySettingsByIdQuery({
    variables: {
      id,
    },
  });
  const [type, setType] = useState<InteractivityType>();

  const [mutate, mutationState] = useUpdateInteractivitySettingsMutation();

  const settings = data?.interactivitySetting;

  const attributeNames = useSourcePropertyNames(dataSourceId || 0, sublayer);
  const [shortTemplate, setShortTemplate] = useState(settings?.shortTemplate);
  const [longTemplate, setLongTemplate] = useState(settings?.longTemplate);
  const [pickLayersOpen, setPickLayersOpen] = useState(false);

  useEffect(() => {
    if (settings && settings.shortTemplate && shortTemplate === undefined) {
      setShortTemplate(settings.shortTemplate);
    }
    if (settings && settings.longTemplate && longTemplate === undefined) {
      setLongTemplate(settings.longTemplate);
    }
    if (settings && type === undefined) {
      setType(settings.type);
    }
  }, [settings, type]);

  const save = () => {
    if (settings) {
      mutate({
        variables: {
          id: settings.id,
          type,
          longTemplate,
          shortTemplate,
        },
      });
    }
  };

  function sanitizeInput(input: string) {
    input = input.replace(/\{\{\{/g, "{{");
    input = input.replace(/\{\{\&/g, "{{");
    input = input.replace(/\}\}\}/g, "}}");
    input = sanitizeHtml(input, {
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        "*": ["style"],
      },
    });
    return input;
  }

  const sanitizeTemplate = (propName: "longTemplate" | "shortTemplate") => {
    if (propName === "longTemplate") {
      setLongTemplate(sanitizeInput(longTemplate || ""));
    } else {
      setShortTemplate(sanitizeInput(shortTemplate || ""));
    }
    save();
  };

  useEffect(() => {
    if (type && settings && type !== settings.type) {
      save();
    }
  }, [type]);

  const selectedType = type || settings?.type || InteractivityType.None;
  return (
    <div>
      {pickLayersOpen && (
        <SetBasemapInteractivityLayers
          initialLayers={(data?.interactivitySetting?.layers || []) as string[]}
          id={data!.interactivitySetting!.id}
          styleUrl={basemap!.url}
          onRequestClose={() => setPickLayersOpen(false)}
        />
      )}
      {loading && <Spinner />}
      {data && (
        <RadioGroup
          legend="Interactivity"
          state={
            mutationState.called
              ? mutationState.loading
                ? "SAVING"
                : "SAVED"
              : "NONE"
          }
          items={[
            {
              label: t("None"),
              value: InteractivityType.None,
            },
            ...(!sublayer
              ? [
                  {
                    label: t("Banner"),
                    description: basemap
                      ? t(
                          "Short text can be displayed towards the top of the map when the user hovers over features in the selected basemap layers."
                        )
                      : t(
                          "Short text can be displayed towards the top of the map when the user hovers over features."
                        ),
                    value: InteractivityType.Banner,
                    children: (
                      <>
                        <TemplateEditor
                          type={InteractivityType.Banner}
                          selectedType={selectedType}
                          propName={"shortTemplate"}
                          templateValue={shortTemplate || undefined}
                          onSave={sanitizeTemplate}
                          onChange={(value) => setShortTemplate(value)}
                          attributeNames={attributeNames}
                          basemap={basemap}
                          layers={data.interactivitySetting?.layers as string[]}
                          onSelectLayers={() => setPickLayersOpen(true)}
                        />
                      </>
                    ),
                  },
                  {
                    label: t("Tooltip"),
                    description:
                      "Short text is displayed next to the mouse cursor.",
                    value: InteractivityType.Tooltip,
                    children: (
                      <>
                        <TemplateEditor
                          type={InteractivityType.Tooltip}
                          selectedType={selectedType}
                          propName={"shortTemplate"}
                          templateValue={shortTemplate || undefined}
                          onSave={sanitizeTemplate}
                          onChange={(value) => setShortTemplate(value)}
                          attributeNames={attributeNames}
                          basemap={basemap}
                          layers={data.interactivitySetting?.layers as string[]}
                          onSelectLayers={() => setPickLayersOpen(true)}
                        />
                      </>
                    ),
                  },
                ]
              : []),
            ...(!sublayer
              ? [
                  {
                    label: "Custom Popup",
                    description:
                      "Popup windows can be opened and closed to show detailed information.",
                    value: InteractivityType.Popup,
                    children: (
                      <>
                        <TemplateEditor
                          type={InteractivityType.Popup}
                          selectedType={selectedType}
                          propName={"longTemplate"}
                          templateValue={longTemplate || undefined}
                          onSave={sanitizeTemplate}
                          onChange={(value) => setLongTemplate(value)}
                          attributeNames={attributeNames}
                          basemap={basemap}
                          layers={data.interactivitySetting?.layers as string[]}
                          onSelectLayers={() => setPickLayersOpen(true)}
                        />
                      </>
                    ),
                  },
                ]
              : []),
            {
              label: "Popup with all columns",
              description: "Popup window which includes all column values.",
              value: InteractivityType.AllPropertiesPopup,
            },
            // {
            //   label: "Fixed Block",
            //   description:
            //     "Content will be displayed in the corner of the map whenever the layer is turned on.",
            //   value: InteractivityType.FixedBlock,
            //   children: (
            //     <TemplateEditor
            //       type={InteractivityType.FixedBlock}
            //       selectedType={selectedType}
            //       propName={"longTemplate"}
            //       templateValue={longTemplate || undefined}
            //       onSave={sanitizeTemplate}
            //       onChange={(value) => setLongTemplate(value)}
            //       attributeNames={attributeNames}
            //     />
            //   ),
            // },
          ]}
          value={selectedType}
          onChange={(type) => {
            setType(type);
          }}
        />
      )}
    </div>
  );
}

function TemplateEditor(props: {
  type: InteractivityType;
  selectedType: InteractivityType;
  propName: "shortTemplate" | "longTemplate";
  templateValue: string | undefined;
  onSave: (propName: "shortTemplate" | "longTemplate") => void;
  onChange: (value: string) => void;
  attributeNames: string[];
  layers?: string[];
  basemap?: any;
  onSelectLayers?: () => void;
}) {
  const { t } = useTranslation("admin");
  const onSave = () => props.onSave(props.propName);
  if (props.selectedType === props.type) {
    return (
      <div className="mt-1">
        <CodeMirror.Controlled
          className="border my-2 w-96"
          value={props.templateValue || ""}
          options={{
            mode: { name: "handlebars", base: "text/html" },
            extraKeys: {
              "Cmd-S": onSave,
              "Ctrl-S": onSave,
            },
          }}
          onBeforeChange={(editor, data, value) => {
            props.onChange(value);
          }}
          onChange={(editor, data, value) => {}}
        />
        <Button small label={t("save")} onClick={onSave} />
        {props.basemap && (
          <Button
            className="ml-1"
            small
            label={
              t("Select applicable layers") + ` (${props.layers?.length || 0})`
            }
            onClick={props.onSelectLayers}
          />
        )}
        <div className="w-96 mt-2">
          {props.attributeNames.map((attr) => (
            <span
              key={attr}
              className="float-left px-1 text-sm rounded font-mono bg-blue-50 bg-opacity-50 border-gray-500  border m-1"
            >
              {`{{${attr}}}`}
            </span>
          ))}
        </div>
      </div>
    );
  } else {
    return null;
  }
}
