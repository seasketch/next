import { Schema, Node, DOMSerializer } from "prosemirror-model";
import { Component, useEffect, useRef } from "react";
import { schema as baseSchema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { createPortal } from "react-dom";
import {
  FormElement,
  useUpdateFormElementMutation,
} from "../generated/graphql";
require("./prosemirror-body.css");
require("./unreset.css");

/**
 * Common props that will be supplied to all FormElement React Component
 * implementations. Components should use the ComponentSettings and ValueType
 * generics to narrow types down further.
 */
export interface FormElementProps<ComponentSettings, ValueType = {}> {
  id: number;
  /** ProseMirror document */
  body: any;
  isRequired: boolean;
  componentSettings: ComponentSettings;
  value?: ValueType;
  editable?: boolean;
  onChange: (value: ValueType, validationErrors: boolean) => void;
  /**
   * Set to true by SurveyApp if user attempts to proceed. Useful for showing validation messages only
   * after the user has finished their input
   * */
  submissionAttempted?: boolean;
  /**
   * Used to request that the controller advance to the next question. For example, on Enter keydown
   */
  onSubmit: () => void;
  editorContainer?: HTMLDivElement | null;
}

/**
 * ProseMirror schema used for FormElement.body content
 */
export const schema: Schema = new Schema({
  nodes: addListNodes(baseSchema.spec.nodes, "paragraph block*", "block"),
  marks: baseSchema.spec.marks,
});

/**
 * Render the given document for presentation to the user
 *
 * @param body ProseMirror Node/Document
 */
export function FormElementBody({
  body,
  required,
  isInput,
}: {
  body: Node;
  required?: boolean;
  isInput: boolean;
}) {
  const target = useRef<HTMLDivElement>(null);
  const serializer = useRef(DOMSerializer.fromSchema(schema));

  useEffect(() => {
    if (target.current && document) {
      target.current.innerHTML = "";
      target.current.appendChild(
        serializer.current.serializeFragment(
          Node.fromJSON(schema, body).content
        )
      );
    }
  }, [target, body]);

  return (
    <div
      className={`prosemirror-body ${required && "required"} ${
        isInput && "input"
      }`}
      ref={target}
    ></div>
  );
}

export class FormElementEditorPortal extends Component<{
  container?: HTMLDivElement | null;
}> {
  render() {
    if (this.props.container) {
      return createPortal(this.props.children, this.props.container);
    } else {
      return null;
    }
  }
}

export function useUpdateFormElement(id: number) {
  const [
    updateFormElement,
    updateFormElementState,
  ] = useUpdateFormElementMutation();
  return (
    variables: Partial<
      Pick<
        FormElement,
        "body" | "componentSettings" | "isRequired" | "exportId"
      >
    >
  ) => {
    updateFormElement({
      variables: {
        ...variables,
        id,
      },
    });
    // TODO: implement optimistic response
  };
}
