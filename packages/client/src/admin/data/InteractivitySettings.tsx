import { useContext, useEffect, useMemo, useState } from "react";
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
import { MapContext } from "../../dataLayers/MapContextManager";
import { GeostatsLayer } from "@seasketch/geostats-types";
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
  geostats,
}: {
  id: number;
  dataSourceId?: number;
  sublayer?: string | null;
  basemap?: BasemapDetailsFragment;
  geostats?: GeostatsLayer;
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
  const [title, setTitle] = useState(settings?.title);
  const [pickLayersOpen, setPickLayersOpen] = useState(false);

  useEffect(() => {
    if (settings && settings.shortTemplate && shortTemplate === undefined) {
      setShortTemplate(settings.shortTemplate);
    }
    if (settings && settings.longTemplate && longTemplate === undefined) {
      setLongTemplate(settings.longTemplate);
    }
    if (settings && settings.title && title === undefined) {
      setTitle(settings.title);
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
          title,
        },
      });
    }
  };

  function sanitizeInput(input: string) {
    input = input.replace(/\{\{\{/g, "{{");
    input = input.replace(/\{\{\&/g, "{{");
    input = input.replace(/\}\}\}/g, "}}");
    input = sanitizeHtml(input, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        "*": ["style", "class"],
      },
    });
    return input;
  }

  const sanitizeTemplate = (
    propName: "longTemplate" | "shortTemplate" | "title"
  ) => {
    if (propName === "title") {
      setTitle(title || "");
    }
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
  }, [save, type, settings?.type]);

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
                          geostats={geostats}
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
                          geostats={geostats}
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
                          geostats={geostats}
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
            {
              label: "Sidebar",
              description:
                "Similar to a popup, but the content is displayed in a sidebar.",
              value: InteractivityType.SidebarOverlay,
              children: (
                <>
                  {selectedType === InteractivityType.SidebarOverlay && (
                    <div className="mt-4">
                      <h4 className="text-sm font-normal">
                        {t("Sidebar title")}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {t(
                          "You may reference feature properties in the title but html tags will not be rendered"
                        )}
                      </p>
                      <TemplateEditor
                        type={InteractivityType.SidebarOverlay}
                        selectedType={selectedType}
                        propName={"title"}
                        templateValue={title || undefined}
                        onSave={sanitizeTemplate}
                        onChange={(value) => setTitle(value)}
                        attributeNames={attributeNames}
                        basemap={basemap}
                        layers={data.interactivitySetting?.layers as string[]}
                        onSelectLayers={() => setPickLayersOpen(true)}
                      />
                      <h4 className="mt-4 text-sm font-normal">
                        {t("Sidebar content")}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {t(
                          "Content can reference feature properties and include html content."
                        )}
                      </p>
                      <TemplateEditor
                        type={InteractivityType.SidebarOverlay}
                        selectedType={selectedType}
                        propName={"longTemplate"}
                        templateValue={longTemplate || undefined}
                        onSave={sanitizeTemplate}
                        onChange={(value) => setLongTemplate(value)}
                        attributeNames={attributeNames}
                        geostats={geostats}
                        layers={data.interactivitySetting?.layers as string[]}
                        onSelectLayers={() => setPickLayersOpen(true)}
                        basemap={basemap}
                      />
                      <h4 className="mt-4 text-sm font-normal">
                        {t("Tooltip (optional)")}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {t(
                          "If set, a tooltip will appear as a preview before the user clicks on a feature to show the full sidebar."
                        )}
                      </p>
                      <TemplateEditor
                        type={InteractivityType.Tooltip}
                        selectedType={InteractivityType.Tooltip}
                        propName={"shortTemplate"}
                        templateValue={shortTemplate || undefined}
                        onSave={sanitizeTemplate}
                        onChange={(value) => setShortTemplate(value)}
                        attributeNames={[]}
                        basemap={basemap}
                        // geostats={geostats}
                      />
                    </div>
                  )}
                </>
              ),
            },
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
  propName: "shortTemplate" | "longTemplate" | "title";
  templateValue: string | undefined;
  onSave: (propName: "shortTemplate" | "longTemplate" | "title") => void;
  onChange: (value: string) => void;
  attributeNames: string[];
  layers?: string[];
  basemap?: any;
  onSelectLayers?: () => void;
  geostats?: GeostatsLayer;
}) {
  const { t } = useTranslation("admin");
  const onSave = () => props.onSave(props.propName);
  const mapContext = useContext(MapContext);

  const attributes = useMemo(() => {
    if (props.geostats) {
      return props.geostats.attributes.map((a) => a.attribute);
    }
    if (props.attributeNames.length > 0) {
      return props.attributeNames;
    }
    if (props.basemap && props.layers && mapContext.manager?.map) {
      const features = mapContext.manager?.map.queryRenderedFeatures(
        undefined,
        {
          layers: [props.layers[0]],
        }
      );
      if (features && features.length > 0) {
        const feature = features[0];
        const props = Object.keys(feature.properties || {});
        return props;
      }
    }
    return [];
  }, [
    props.geostats,
    props.layers,
    mapContext.manager?.map,
    props.basemap,
    props.attributeNames,
  ]);

  if (props.selectedType === props.type) {
    return (
      <div className="mt-1">
        <CodeMirror.Controlled
          className="border my-2 w-96 max-h-160 overflow-y-auto"
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
        {props.propName === "longTemplate" && attributes.length > 0 && (
          <Button
            className="ml-1"
            small
            label={t("insert property list")}
            onClick={() => {
              const value = props.templateValue || "";
              const newValue =
                value +
                `
<h2>Properties</h2>
<dl>
${attributes
  .map((attr) => {
    return `  <div>
    <dt>${attr}</dt>
    <dd>{{${attr}}}</dd>
  </div>                
`;
  })
  .join("")}
</dl>
`;
              props.onChange(newValue);
            }}
          />
        )}
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
          {attributes.map((attr) => (
            <span
              key={attr}
              className="float-left px-1 text-sm rounded font-mono bg-blue-50 bg-opacity-50 border-gray-500  border m-1"
            >
              {`{{${attr}}}`}
            </span>
          ))}
        </div>
        <div className="clear-both" />
      </div>
    );
  } else {
    return null;
  }
}
