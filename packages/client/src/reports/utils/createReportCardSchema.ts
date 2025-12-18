import { Schema } from "prosemirror-model";
import { reportBodySchema } from "../widgets/prosemirror/reportBodySchema";

// Backwards compatibility shim: previously a function factory; now returns the shared schema.
export function createReportCardSchema(): Schema {
  return reportBodySchema;
}

export { reportBodySchema };

