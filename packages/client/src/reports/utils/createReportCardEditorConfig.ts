import { Schema } from "prosemirror-model";
import { exampleSetup } from "prosemirror-example-setup";
import {
  createSlashCommandPlugin,
  defaultSlashCommandItems,
} from "../../editor/slashCommands/plugin";
import ReportTitlePlaceholderPlugin from "../../editor/ReportTitlePlaceholderPlugin";
import { createReportCardSchema } from "./createReportCardSchema";

/**
 * Creates editor configuration (schema + plugins) for report card body or footer
 * with optional metrics support for metric node rendering.
 */
export function createReportCardEditorConfig(): {
  schema: Schema;
  plugins: any[];
} {
  const schema = createReportCardSchema();

  const plugins = [
    createSlashCommandPlugin(defaultSlashCommandItems),
    ...exampleSetup({ schema, menuBar: false }),
    ReportTitlePlaceholderPlugin(),
  ];

  return { schema, plugins };
}
