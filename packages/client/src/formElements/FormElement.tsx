import { Schema, Node, DOMSerializer } from "prosemirror-model";
import { useEffect, useRef } from "react";
import { schema as baseSchema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
require("./prosemirror-body.css");

/**
 * Common props that will be supplied to all FormElement React Component
 * implementations. Components should use the ComponentSettings and ValueType
 * generics to narrow types down further.
 */
export interface FormElementProps<ComponentSettings, ValueType = {}> {
  id: number;
  body: Node;
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
export function FormElementBody({ body }: { body: Node }) {
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

  return <div className="prosemirror-body" ref={target}></div>;
}
