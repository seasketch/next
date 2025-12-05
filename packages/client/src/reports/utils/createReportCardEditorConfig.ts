import { Schema } from "prosemirror-model";
import { exampleSetup } from "prosemirror-example-setup";
import {
  createSlashCommandPlugin,
  defaultSlashCommandItems,
} from "../../editor/slashCommands/plugin";
import ReportTitlePlaceholderPlugin from "../../editor/ReportTitlePlaceholderPlugin";
import PresenceAbsenceBlockPlaceholderPlugin from "../../editor/PresenceAbsenceBlockPlaceholderPlugin";
import FooterTitlePlaceholderPlugin from "../../editor/FooterTitlePlaceholderPlugin";
import { createReportCardSchema } from "./createReportCardSchema";
import { MetricResolver } from "./resolveMetric";

/**
 * Creates editor configuration (schema + plugins) for report card body or footer
 * with optional metrics support for metric node rendering.
 */
export function createReportCardEditorConfig(
  isFooter: boolean,
  metricResolver?: MetricResolver
): { schema: Schema; plugins: any[] } {
  const schema = createReportCardSchema(isFooter, metricResolver);

  const plugins = [
    createSlashCommandPlugin(defaultSlashCommandItems),
    ...exampleSetup({ schema, menuBar: false }),
    isFooter ? FooterTitlePlaceholderPlugin() : ReportTitlePlaceholderPlugin(),
    ...(isFooter ? [] : [PresenceAbsenceBlockPlaceholderPlugin()]),
  ];

  return { schema, plugins };
}
