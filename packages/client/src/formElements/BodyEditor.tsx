import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { formElements as editorConfig } from "../editor/config";
import { EditorView } from "prosemirror-view";
import { useEffect, useRef, useState } from "react";
import { useUpdateFormElementBodyMutation } from "../generated/graphql";
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
}: {
  formElementId: number;
  body: Node;
  isInput: boolean;
}) {
  const { schema, plugins } = isInput
    ? editorConfig.questions
    : editorConfig.content;

  const [update, updateState] = useUpdateFormElementBodyMutation();
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
