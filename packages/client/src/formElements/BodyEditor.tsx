import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { formElements as editorConfig } from "../editor/config";
import { EditorView } from "prosemirror-view";
import { useEffect, useRef, useState } from "react";
import {
  useUpdateComponentSettingsMutation,
  useUpdateFormElementBodyMutation,
  useUpdateFormElementMutation,
} from "../generated/graphql";
import { useDebouncedFn } from "beautiful-react-hooks";
import { useApolloClient } from "@apollo/client";
import gql from "graphql-tag";
import "prosemirror-menu/style/menu.css";
import "prosemirror-view/style/prosemirror.css";
import TooltipMenu from "../editor/TooltipMenu";

export default function BodyEditor({
  formElementId,
  body,
  isInput,
  componentSettings,
  componentSettingName,
}: {
  formElementId: number;
  body: Node;
  isInput: boolean;
  componentSettingName?: string;
  componentSettings?: any;
}) {
  const { schema, plugins } = isInput
    ? editorConfig.questions
    : editorConfig.content;

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

  const [update, updateState] = useUpdateFormElementBodyMutation();
  const [
    updateComponentSettings,
    updateComponentSettingsState,
  ] = useUpdateComponentSettingsMutation();
  const client = useApolloClient();
  const viewRef = useRef<EditorView>();
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<EditorState>();

  useEffect(() => {
    const doc = body ? Node.fromJSON(schema, body) : null;
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
          if (componentSettingName) {
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
  }, [formElementId]);

  const save = useDebouncedFn(
    (doc: any) => {
      if (componentSettingName) {
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
    [update, formElementId]
  );
  return (
    <div
      className="relative"
      onBlur={() => {
        setState(undefined);
      }}
    >
      <TooltipMenu view={viewRef.current} state={state} schema={schema} />
      <div className="prosemirror-body" ref={root}></div>
    </div>
  );
}
