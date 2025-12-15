import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { formElements as editorConfig } from "../editor/config";
import { EditorView } from "prosemirror-view";
import { useContext, useEffect, useRef, useState } from "react";
import {
  useUpdateAlternateLanguageSettingsMutation,
  useUpdateComponentSettingsMutation,
  useUpdateFormElementBodyMutation,
} from "../generated/graphql";
import { useDebouncedFn } from "beautiful-react-hooks";
import { useApolloClient } from "@apollo/client";
import gql from "graphql-tag";
import "prosemirror-menu/style/menu.css";
import "prosemirror-view/style/prosemirror.css";
import TooltipMenu from "../editor/TooltipMenu";
import { FormLanguageContext, SurveyContext } from "./FormElement";
import EditorLanguageSelector from "../surveys/EditorLanguageSelector";

export default function BodyEditor({
  formElementId,
  isInput,
  componentSettings,
  componentSettingName,
  body: defaultBody,
  alternateLanguageSettings,
}: {
  formElementId: number;
  body: Node;
  isInput: boolean;
  componentSettingName?: string;
  componentSettings?: any;
  alternateLanguageSettings: { [key: string]: any };
}) {
  const { schema, plugins } = isInput
    ? editorConfig.questions
    : editorConfig.content;

  const context = useContext(FormLanguageContext);
  const surveyContext = useContext(SurveyContext);
  const selectedLanguage = context?.lang.code || "EN";

  let body = defaultBody;
  if (
    selectedLanguage !== "EN" &&
    alternateLanguageSettings[selectedLanguage]
  ) {
    body = alternateLanguageSettings[componentSettingName || "body"] || {
      ...defaultBody,
    };
  }

  if (componentSettings || componentSettingName) {
    if (!componentSettingName) {
      throw new Error(
        // eslint-disable-next-line i18next/no-literal-string
        `If using BodyEditor on componentSettings, a componentSettingName must be specified`
      );
    }
    if (!componentSettings) {
      throw new Error(
        // eslint-disable-next-line i18next/no-literal-string
        `If using BodyEditor on componentSettings, a componentSetting prop must be provided`
      );
    }
  }

  const [update] = useUpdateFormElementBodyMutation();
  const [updateComponentSettings] = useUpdateComponentSettingsMutation();
  const [updateAlternateLanguageSettings] =
    useUpdateAlternateLanguageSettingsMutation();
  const client = useApolloClient();
  const viewRef = useRef<EditorView>();
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<EditorState>();

  useEffect(() => {
    const doc = body ? Node.fromJSON(schema, body) : undefined;
    const view = new EditorView(root.current!, {
      state: EditorState.create({
        schema,
        plugins,
        doc,
      }),
      dispatchTransaction: (transaction) => {
        const view = viewRef.current!;
        const newState = view.state.apply(transaction);
        view.updateState(newState);
        setState(newState);

        if (transaction.docChanged) {
          if (selectedLanguage !== "EN") {
            const propName = componentSettingName || "body";
            client.writeFragment({
              id: `FormElement:${formElementId}`,
              fragment: gql`
                fragment UpdateAlternateLanguageSettings on FormElement {
                  alternateLanguageSettings
                }
              `,
              data: {
                alternateLanguageSettings: {
                  ...alternateLanguageSettings,
                  [selectedLanguage]: {
                    ...alternateLanguageSettings[selectedLanguage],
                    [propName]: newState.doc.toJSON(),
                  },
                },
              },
            });
          } else if (componentSettingName) {
            client.writeFragment({
              id: `FormElement:${formElementId}`,
              fragment: gql`
                fragment UpdateComponentSettings on FormElement {
                  componentSettings
                }
              `,
              data: {
                componentSettings: {
                  ...componentSettings,
                  [componentSettingName]: newState.doc.toJSON(),
                },
              },
            });
          } else {
            client.writeFragment({
              id: `FormElement:${formElementId}`,
              fragment: gql`
                fragment UpdateBody on FormElement {
                  body
                }
              `,
              data: {
                body: newState.doc.toJSON(),
              },
            });
          }
          save(newState.doc);
        }
      },
    });
    viewRef.current = view;
    return () => {
      view.destroy();
    };
  }, [formElementId, selectedLanguage]);

  const save = useDebouncedFn(
    (doc: any) => {
      if (selectedLanguage !== "EN") {
        const propName = componentSettingName || "body";
        updateAlternateLanguageSettings({
          variables: {
            id: formElementId,
            alternateLanguageSettings: {
              ...alternateLanguageSettings,
              [selectedLanguage]: {
                ...alternateLanguageSettings[selectedLanguage],
                [propName]: doc.toJSON(),
              },
            },
          },
          optimisticResponse: {
            __typename: "Mutation",
            updateFormElement: {
              __typename: "UpdateFormElementPayload",
              formElement: {
                __typename: "FormElement",
                alternateLanguageSettings: {
                  ...alternateLanguageSettings,
                  [selectedLanguage]: {
                    ...alternateLanguageSettings[selectedLanguage],
                    [propName]: doc.toJSON(),
                  },
                },
                id: formElementId,
              },
            },
          },
        });
      } else if (componentSettingName) {
        updateComponentSettings({
          variables: {
            id: formElementId,
            componentSettings: {
              ...componentSettings,
              [componentSettingName]: doc.toJSON(),
            },
          },
          optimisticResponse: {
            __typename: "Mutation",
            updateFormElement: {
              __typename: "UpdateFormElementPayload",
              formElement: {
                __typename: "FormElement",
                componentSettings: {
                  ...componentSettings,
                  [componentSettingName]: doc.toJSON(),
                },
                id: formElementId,
              },
            },
          },
        });
      } else {
        update({
          variables: {
            id: formElementId,
            body: doc.toJSON(),
          },
          optimisticResponse: {
            updateFormElement: {
              formElement: {
                id: formElementId,
                body: doc,
              },
            },
          },
        });
      }
    },
    250,
    { leading: true, trailing: true },
    [update, formElementId, selectedLanguage]
  );
  return (
    <div
      className="relative"
      onBlur={(e) => {
        const next = e.relatedTarget as HTMLElement | null;
        if (next && next.closest("[data-report-tooltip='true']")) {
          return;
        }
        setState(undefined);
      }}
    >
      <TooltipMenu view={viewRef.current} state={state} schema={schema} />
      <div className="ProseMirrorBody" ref={root}></div>
      {surveyContext && (
        <EditorLanguageSelector className="absolute -top-10 left-0 opacity-50 hover:opacity-100 active:opacity-100" />
      )}
    </div>
  );
}
